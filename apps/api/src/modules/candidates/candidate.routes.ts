
import { Router } from "express";
import multer from "multer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { Candidate } from "./candidate.model.js";
import { parseResume } from "./resume.parser.js";
import { requireAuth, requireRecruiter } from "../../middleware/auth.middleware.js";

export const candidateRouter = Router();

const storageDirectory = path.resolve(process.cwd(), "storage", "resumes");
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

async function extractResumeText(
  buffer: Buffer,
  extension: string,
): Promise<string> {
  if (extension === ".pdf") {
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

candidateRouter.post("/upload",requireAuth, requireRecruiter,  (req, res, next) => {
  upload.single("resume")(req, res, (error) => {
    if (error) {
      res.status(400).json({
        error:
          error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
            ? "Resume must be 5 MB or smaller."
            : "Unable to accept the uploaded file.",
      });
      return;
    }

    next();
  });
}, async (req, res) => {
  let savedFilePath: string | undefined;

  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Attach a file using the "resume" field.' });
      return;
    }

    const extension = path.extname(file.originalname).toLowerCase();

    if (![".pdf", ".docx"].includes(extension)) {
      res.status(400).json({ error: "Only PDF and DOCX resumes are supported." });
      return;
    }

    const isPdf = extension === ".pdf" &&
      file.buffer.subarray(0, 5).toString() === "%PDF-";
    const isDocx = extension === ".docx" &&
      file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    if (!isPdf && !isDocx) {
      res.status(400).json({ error: "The file content does not match its extension." });
      return;
    }

    const sha256 = createHash("sha256").update(file.buffer).digest("hex");

    const duplicate = await Candidate.findOne({ "resume.sha256": sha256 }).lean();

    if (duplicate) {
      res.status(409).json({
        error: "This exact resume file has already been uploaded.",
        candidateId: duplicate._id,
      });
      return;
    }
    const extractedText = await extractResumeText(file.buffer, extension);

    if (!extractedText) {
      res.status(422).json({
        error: "No readable text was found. Scanned PDFs may need OCR before upload.",
      });
      return;
    }
    const parsed = parseResume(extractedText);

    await mkdir(storageDirectory, { recursive: true });



    const storageKey = `${randomUUID()}${extension}`;
    savedFilePath = path.join(storageDirectory, storageKey);

    await writeFile(savedFilePath, file.buffer, { flag: "wx" });
const candidate = await Candidate.create({
  fullName: parsed.fullName ?? "Needs review",
  email: parsed.email,
  phone: parsed.phone,
  skills: parsed.skills,
  resume: {
    originalName: path.basename(file.originalname).slice(0, 255),
    storageKey,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256,
  },
  extractedText,
  parsingStatus: parsed.fullName && parsed.email ? "completed" : "needs_review",
  parsingWarnings: parsed.warnings,
});

    res.status(201).json({
      message: "Resume uploaded and text extracted successfully.",
      data: {
        id: candidate._id,
        fullName: candidate.fullName,
        parsingStatus: candidate.parsingStatus,
originalName: path.basename(file.originalname).slice(0, 255),
sizeBytes: file.size,
    },
    });
  } catch (error) {
    if (savedFilePath) {
      await unlink(savedFilePath).catch(() => undefined);
    }

    console.error("Resume upload failed:", error);
    res.status(500).json({ error: "Resume upload failed. Please try again." });
  }
});


candidateRouter.get("/", requireAuth,requireRecruiter, async (_req, res) => {
  try {
    const candidates = await Candidate.find()
      .select("-extractedText")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      data: candidates,
      count: candidates.length,
    });
  } catch (error) {
    console.error("Failed to list candidates:", error);
    res.status(500).json({ error: "Failed to retrieve candidates." });
  }
});

candidateRouter.get("/:id",requireAuth,requireRecruiter, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id)
      .select("+extractedText")
      .lean();

    if (!candidate) {
      res.status(404).json({ error: "Candidate not found." });
      return;
    }

    res.status(200).json({ data: candidate });
  } catch (error) {
    if (error instanceof Error && error.name === "CastError") {
      res.status(400).json({ error: "Invalid candidate ID." });
      return;
    }

    console.error("Failed to retrieve candidate:", error);
    res.status(500).json({ error: "Failed to retrieve candidate." });
  }
});


candidateRouter.patch("/:id/stage", requireAuth,requireRecruiter, async (req, res) => {
  try {
    const allowedStages = [
      "new",
      "screening",
      "shortlisted",
      "interview",
      "offered",
      "hired",
      "rejected",
    ] as const;

    const { stage } = req.body;

    if (
      typeof stage !== "string" ||
      !allowedStages.includes(stage as (typeof allowedStages)[number])
    ) {
      return res.status(400).json({
        message: "Invalid recruitment stage.",
        allowedStages,
      });
    }

    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { $set: { recruitmentStage: stage } },
      { new: true, runValidators: true },
    )
      .select("-extractedText")
      .lean();

    if (!candidate) {
      return res.status(404).json({
        message: "Candidate not found.",
      });
    }

    return res.status(200).json({
      message: "Recruitment stage updated successfully.",
      data: candidate,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid candidate ID.",
      });
    }

    console.error("Failed to update recruitment stage:", error);

    return res.status(500).json({
      message: "Unable to update recruitment stage.",
    });
  }
});
