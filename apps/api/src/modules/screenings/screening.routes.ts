
import { Router } from "express";
import multer from "multer";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { cleanupCancelledScreeningJob } from "./screening-cleanup.service.js";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
// import{scorecardRouter} from "./scorecard.routes.js";
import {Scorecard} from "./scorecard.model.js";
import { ResumeSubmission } from "./resume-submission.model.js";
import { parseResume } from "../candidates/resume.parser.js";
import { Requisition } from "../requisitions/requisition.model.js";
import { ScreeningJob } from "./screening-job.model.js";
import { Screening } from "./screening.model.js";
import {
  requireAuth,
  requireRecruiter,
} from "../../middleware/auth.middleware.js";
export const screeningRouter = Router();
screeningRouter.use(
  "/jobs/:jobId",
  requireAuth,
  requireRecruiter,
  async (req, res, next) => {
    try {
      const jobId = req.params.jobId;

      if (
        typeof jobId !== "string" ||
        !/^[a-f\d]{24}$/i.test(jobId)
      ) {
        res.status(400).json({ error: "Invalid screening batch ID." });
        return;
      }

      const job = await ScreeningJob.findById(jobId)
        .select("requisitionId")
        .lean();

      if (!job) {
        res.status(404).json({ error: "Screening batch not found." });
        return;
      }

      const ownsRequisition = await Requisition.exists({
        _id: job.requisitionId,
        createdBy: req.authUser!.id,
      });

      if (!ownsRequisition) {
        res.status(404).json({ error: "Screening batch not found." });
        return;
      }

      next();
    } catch (error) {
      console.error("Screening ownership check failed:", error);
      res.status(500).json({
        error: "Unable to verify screening batch access.",
      });
    }
  },
);
const MAX_FILES = 500;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const tempDirectory = path.resolve(
  process.cwd(),
  "storage",
  "temp-resumes",
);

const storageDirectory = path.resolve(
  process.cwd(),
  "storage",
  "resumes",
);
// Securely view or download an uploaded resume.
screeningRouter.get(
  "/submissions/:submissionId/resume",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const { submissionId } = req.params;

      if (
        typeof submissionId !== "string" ||
        !/^[a-f\d]{24}$/i.test(submissionId)
      ) {
        res.status(400).json({ error: "Invalid resume ID." });
        return;
      }

      const submission = await ResumeSubmission.findById(submissionId)
        .select("requisitionId resume")
        .lean();

      if (!submission) {
        res.status(404).json({ error: "Resume not found." });
        return;
      }

      // Only the recruiter who owns the requisition can access this file.
      const ownsRequisition = await Requisition.exists({
        _id: submission.requisitionId,
        createdBy: req.authUser!.id,
      });

      if (!ownsRequisition) {
        res.status(404).json({ error: "Resume not found." });
        return;
      }

      const storageKey = submission.resume?.storageKey;

      if (
        typeof storageKey !== "string" ||
        !/^[a-f\d-]{36}\.(pdf|docx)$/i.test(storageKey)
      ) {
        res.status(404).json({ error: "Resume file not found." });
        return;
      }

      const filePath = path.resolve(storageDirectory, storageKey);

      if (!filePath.startsWith(storageDirectory + path.sep)) {
        res.status(400).json({ error: "Invalid resume file path." });
        return;
      }

      const buffer = await readFile(filePath);
      const isPdf = storageKey.toLowerCase().endsWith(".pdf");

      res.setHeader(
        "Content-Type",
        isPdf
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );

      res.setHeader(
        "Content-Disposition",
        `${isPdf ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(
submission.resume?.originalName || "resume",        )}`,
      );

      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, no-store");

      res.status(200).send(buffer);
    } catch (error) {
      console.error("Failed to retrieve resume:", error);

      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        res.status(404).json({ error: "Resume file not found." });
        return;
      }

      res.status(500).json({
        error: "Unable to retrieve resume.",
      });
    }
  },
);
const allowedExtensions = [".pdf", ".docx"];

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      mkdir(tempDirectory, { recursive: true })
        .then(() => callback(null, tempDirectory))
        .catch((error) => callback(error, tempDirectory));
    },
    filename: (_req, _file, callback) => {
      callback(null, `${randomUUID()}.upload`);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      callback(new Error("Only PDF and DOCX resumes are supported."));
      return;
    }

    callback(null, true);
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

function isValidFileContent(
  buffer: Buffer,
  extension: string,
): boolean {
  if (extension === ".pdf") {
    return buffer.subarray(0, 5).toString() === "%PDF-";
  }

  return (
    extension === ".docx" &&
    buffer
      .subarray(0, 4)
      .equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  );
}

// Create a screening batch for one requisition.
screeningRouter.post(
  "/jobs",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const { requisitionId, name, topN } = req.body;

      if (
        typeof requisitionId !== "string" ||
        !/^[a-f\d]{24}$/i.test(requisitionId)
      ) {
        res.status(400).json({ error: "A valid requisitionId is required." });
        return;
      }

      const parsedTopN =
        topN === undefined || topN === null || topN === ""
          ? 50
          : Number(topN);

      if (
        !Number.isInteger(parsedTopN) ||
        parsedTopN < 1 ||
        parsedTopN > 500
      ) {
        res.status(400).json({
          error: "topN must be an integer between 1 and 500.",
        });
        return;
      }

const requisition = await Requisition.findOne({
  _id: requisitionId,
  createdBy: req.authUser!.id,
}).lean();
      if (!requisition) {
        res.status(404).json({ error: "Requisition not found." });
        return;
      }

      if (requisition.status !== "open") {
        res.status(400).json({
          error: "Screening can only be created for an open requisition.",
        });
        return;
      }
// Find unfinished batches belonging to this requisition.
const previousJobs = await ScreeningJob.find({
  requisitionId: requisition._id,
  status: { $in: ["uploading", "queued", "processing"] },
  cancelRequested: { $ne: true },
})
  .select("_id")
  .lean();

const cancelledJobIds: string[] = [];

// Request cancellation atomically for each previous batch.
for (const previousJob of previousJobs) {
  const cancelledJob = await ScreeningJob.findOneAndUpdate(
    {
      _id: previousJob._id,
      requisitionId: requisition._id,
      status: { $in: ["uploading", "queued", "processing"] },
      cancelRequested: { $ne: true },
    },
    {
      $set: {
        status: "cancelling",
        cancelRequested: true,
        cancelRequestedAt: new Date(),
        interruptionReason: "USER_STARTED_NEW_BATCH",
        cleanupStatus: "pending",
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (cancelledJob) {
    cancelledJobIds.push(cancelledJob._id.toString());
  }
}

// Create the new batch.
const job = await ScreeningJob.create({
  requisitionId: requisition._id,
  name:
    typeof name === "string" && name.trim()
      ? name.trim().slice(0, 120)
      : "Resume screening batch",
  topN: parsedTopN,
});
      res.status(201).json({
        message: "Screening batch created.",
        data: job,
      });
      // Start cleanup of previous batches in the background.
for (const previousJobId of cancelledJobIds) {
  void cleanupCancelledScreeningJob(previousJobId).catch((error) => {
    console.error(
      `Cleanup failed for previous screening batch ${previousJobId}:`,
      error,
    );
  });
}
    } catch (error) {
      console.error("Failed to create screening batch:", error);
      res.status(500).json({
        error: "Unable to create screening batch.",
      });
    }
  },
);


const releaseUploadLease = async (jobId: string) => {
  await ScreeningJob.updateOne(
    {
      _id: jobId,
      activeUploads: { $gt: 0 },
    },
    {
      $inc: { activeUploads: -1 },
    },
  );
};



// Upload up to 500 resumes into an existing batch.
screeningRouter.post(
  "/jobs/:jobId/files",
  requireAuth,
  requireRecruiter,
  // Acquire the lease BEFORE Multer starts writing files. This prevents
  // complete-upload or cancellation cleanup from racing an active upload.
  async (req, res, next) => {
    const jobId = req.params.jobId;

    if (typeof jobId !== "string" || !/^[a-f\d]{24}$/i.test(jobId)) {
      res.status(400).json({ error: "Invalid screening batch ID." });
      return;
    }

    try {
      const job = await ScreeningJob.findOneAndUpdate(
        {
          _id: jobId,
          status: "uploading",
          uploadComplete: false,
          cancelRequested: { $ne: true },
        },
        { $inc: { activeUploads: 1 } },
        { returnDocument: "after" },
      );

      if (!job) {
        res.status(409).json({
          error: "This batch is no longer accepting uploads.",
        });
        return;
      }

      res.locals.uploadLeaseJobId = job._id.toString();
      next();
    } catch (error) {
      next(error);
    }
  },
  async (req, res, next) => {
    try {
      await mkdir(tempDirectory, { recursive: true });
      next();
    } catch (error) {
      const leaseJobId = res.locals.uploadLeaseJobId as string | undefined;
      if (leaseJobId) {
        await releaseUploadLease(leaseJobId).catch((releaseError) => {
          console.error("Failed to release upload lease after temp directory error:", releaseError);
        });
        res.locals.uploadLeaseJobId = undefined;
      }
      next(error);
    }
  },
  (req, res, next) => {
    upload.array("resumes", MAX_FILES)(req, res, async (error) => {
      if (error) {
        console.error("BULK UPLOAD MIDDLEWARE ERROR:", error);

        const leaseJobId = res.locals.uploadLeaseJobId as string | undefined;
        if (leaseJobId) {
          await releaseUploadLease(leaseJobId).catch((releaseError) => {
            console.error("Failed to release upload lease after Multer error:", releaseError);
          });
          res.locals.uploadLeaseJobId = undefined;
        }

        if (error instanceof multer.MulterError) {
          const message =
            error.code === "LIMIT_FILE_SIZE"
              ? "Each resume must be 5 MB or smaller."
              : error.code === "LIMIT_FILE_COUNT"
                ? "A maximum of 500 resumes can be uploaded per request."
                : `Multer rejected the upload: ${error.message}`;

          res.status(400).json({ error: message, code: error.code });
          return;
        }

        res.status(400).json({
          error: error instanceof Error
            ? error.message
            : "Unable to accept the uploaded files.",
        });
        return;
      }

      next();
    });
  },
  async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[];
    const leaseJobId = res.locals.uploadLeaseJobId as string | undefined;
    const results: Array<{
      originalName: string;
      status: "uploaded" | "duplicate" | "rejected" | "failed";
      resumeSubmissionId?: string;
      message?: string;
    }> = [];
    const counts = {
      total: 0,
      uploaded: 0,
      duplicate: 0,
      rejected: 0,
      failed: 0,
      queued: 0,
    };

    const cleanupTempFiles = async () => {
      await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)));
    };

    // Every outcome is committed together with its counter update. The
    // conditional batch update is also the cancellation gate: if cancellation
    // wins, this transaction cannot add a resume after cancellation.
    const recordOutcome = async (
      outcome: "duplicate" | "rejected" | "failed",
    ): Promise<boolean> => {
      const session = await ScreeningJob.startSession();
      let committed = false;
      try {
        await session.withTransaction(async () => {
          const updated = await ScreeningJob.updateOne(
            {
              _id: leaseJobId,
              status: "uploading",
              uploadComplete: false,
              cancelRequested: { $ne: true },
            },
            {
              $inc: {
                "counts.total": 1,
                [`counts.${outcome}`]: 1,
              },
            },
            { session },
          );
          committed = updated.modifiedCount === 1;
        });
        return committed;
      } finally {
        await session.endSession();
      }
    };

    try {
      if (!leaseJobId) {
        res.status(409).json({ error: "Upload lease was not acquired." });
        return;
      }

      if (files.length === 0) {
        res.status(400).json({ error: 'Attach files using the "resumes" field.' });
        return;
      }

      const job = await ScreeningJob.findOne({
        _id: leaseJobId,
        status: "uploading",
        uploadComplete: false,
        cancelRequested: { $ne: true },
      }).select("_id requisitionId").lean();

      if (!job) {
        res.status(409).json({ error: "This batch is no longer accepting uploads." });
        return;
      }

      await mkdir(storageDirectory, { recursive: true });
      const hashesInThisRequest = new Set<string>();

      for (const file of files) {
        // Stop processing additional files as soon as cancellation is requested.
        const acceptingUploads = await ScreeningJob.exists({
          _id: job._id,
          status: "uploading",
          uploadComplete: false,
          cancelRequested: { $ne: true },
        });
        if (!acceptingUploads) break;

        const originalName = path.basename(file.originalname).slice(0, 255);
        let savedFilePath: string | undefined;

        try {
          const extension = path.extname(originalName).toLowerCase();
          if (!allowedExtensions.includes(extension)) {
            if (!(await recordOutcome("rejected"))) break;
            counts.total++;
            counts.rejected++;
            results.push({ originalName, status: "rejected", message: "Only PDF and DOCX resumes are supported." });
            continue;
          }

          const buffer = await readFile(file.path);
          if (!isValidFileContent(buffer, extension)) {
            if (!(await recordOutcome("rejected"))) break;
            counts.total++;
            counts.rejected++;
            results.push({ originalName, status: "rejected", message: "File content does not match its extension." });
            continue;
          }

          const sha256 = createHash("sha256").update(buffer).digest("hex");
          if (hashesInThisRequest.has(sha256)) {
            if (!(await recordOutcome("duplicate"))) break;
            counts.total++;
            counts.duplicate++;
            results.push({ originalName, status: "duplicate", message: "This resume already appears in this upload batch." });
            continue;
          }

          const existingFile = await ResumeSubmission.findOne({
            "resume.sha256": sha256,
            requisitionId: job.requisitionId,
          }).select("_id").lean();

          if (existingFile) {
            hashesInThisRequest.add(sha256);
            if (!(await recordOutcome("duplicate"))) break;
            counts.total++;
            counts.duplicate++;
            results.push({
              originalName,
              status: "duplicate",
              resumeSubmissionId: existingFile._id.toString(),
              message: "This resume has already been uploaded for this requisition.",
            });
            continue;
          }

          const extractedText = await extractResumeText(buffer, extension);
          if (!extractedText) {
            if (!(await recordOutcome("rejected"))) break;
            counts.total++;
            counts.rejected++;
            results.push({ originalName, status: "rejected", message: "No readable text found. Scanned PDFs may require OCR." });
            continue;
          }

          const parsed = parseResume(extractedText);
          const normalizedEmail = parsed.email ? parsed.email.trim().toLowerCase() : null;
          const normalizedPhone = parsed.phone ? parsed.phone.replace(/\D/g, "") : null;

          let identityStatus: "unverified" | "matched" | "possible_duplicate" | "manual_review" = "unverified";
          let identityGroup: typeof job._id | null = null;

          if (normalizedEmail || normalizedPhone) {
            const identityMatches = await ResumeSubmission.find({
              requisitionId: job.requisitionId,
              $or: [
                ...(normalizedEmail ? [{ normalizedEmail }] : []),
                ...(normalizedPhone ? [{ normalizedPhone }] : []),
              ],
            }).select("_id normalizedEmail normalizedPhone identityGroup").lean();

            if (identityMatches.length > 0) {
              const emailMatches = normalizedEmail
                ? identityMatches.filter((item) => item.normalizedEmail === normalizedEmail)
                : [];
              const phoneMatches = normalizedPhone
                ? identityMatches.filter((item) => item.normalizedPhone === normalizedPhone)
                : [];
              const hasConflict =
                emailMatches.some((item) => item.normalizedPhone && normalizedPhone && item.normalizedPhone !== normalizedPhone) ||
                phoneMatches.some((item) => item.normalizedEmail && normalizedEmail && item.normalizedEmail !== normalizedEmail);
              const matchedRecords = normalizedEmail && normalizedPhone
                ? identityMatches.filter((item) => item.normalizedEmail === normalizedEmail && item.normalizedPhone === normalizedPhone)
                : identityMatches;

              if (hasConflict) {
                identityStatus = "manual_review";
              } else if (matchedRecords.length > 0) {
                identityStatus = "possible_duplicate";
                identityGroup = (matchedRecords[0].identityGroup as typeof job._id) ?? matchedRecords[0]._id;
              } else {
                identityStatus = "manual_review";
              }
            }
          }

          const storageKey = `${randomUUID()}${extension}`;
          savedFilePath = path.join(storageDirectory, storageKey);
          await writeFile(savedFilePath, buffer, { flag: "wx" });

          const session = await ScreeningJob.startSession();
          let submissionId: string | undefined;
          try {
            await session.withTransaction(async () => {
              // This write conflicts with cancellation's update to the same job.
              const batchUpdate = await ScreeningJob.updateOne(
                {
                  _id: job._id,
                  status: "uploading",
                  uploadComplete: false,
                  cancelRequested: { $ne: true },
                },
                {
                  $inc: {
                    "counts.total": 1,
                    "counts.uploaded": 1,
                    "counts.queued": 1,
                  },
                },
                { session },
              );
              if (batchUpdate.modifiedCount !== 1) {
                throw new Error("SCREENING_BATCH_NOT_ACCEPTING_UPLOADS");
              }

              const [submission] = await ResumeSubmission.create([{
                screeningJobId: job._id,
                requisitionId: job.requisitionId,
                fullName: parsed.fullName ?? "Needs review",
                email: normalizedEmail,
                phone: parsed.phone ?? null,
                normalizedEmail,
                normalizedPhone,
                skills: parsed.skills ?? [],
                resume: {
                  originalName,
                  storageKey,
                  mimeType: file.mimetype,
                  sizeBytes: file.size,
                  sha256,
                },
                extractedText,
                parsingStatus: parsed.fullName && normalizedEmail ? "completed" : "needs_review",
                parsingWarnings: parsed.warnings ?? [],
                identityStatus,
                identityGroup,
              }], { session });

              await Screening.create([{
                screeningJobId: job._id,
                requisitionId: job.requisitionId,
                resumeSubmissionId: submission._id,
                status: "queued",
                nextRunAt: new Date(),
              }], { session });
              submissionId = submission._id.toString();
            });
          } finally {
            await session.endSession();
          }

          // Only retain the file after both database records commit.
          savedFilePath = undefined;
          hashesInThisRequest.add(sha256);
          counts.total++;
          counts.uploaded++;
          counts.queued++;
          results.push({
            originalName,
            status: "uploaded",
            resumeSubmissionId: submissionId,
            message: identityStatus === "possible_duplicate"
              ? "Resume uploaded. Possible duplicate identity requires review."
              : identityStatus === "manual_review"
                ? "Resume uploaded. Candidate identity requires manual review."
                : "Resume added to the screening queue.",
          });
        } catch (error) {
          if (savedFilePath) await unlink(savedFilePath).catch(() => undefined);

          if (error instanceof Error && error.message === "SCREENING_BATCH_NOT_ACCEPTING_UPLOADS") {
            break;
          }

          console.error(`Bulk resume processing failed: ${originalName}`, error);
          if (!(await recordOutcome("failed"))) break;
          counts.total++;
          counts.failed++;
          results.push({ originalName, status: "failed", message: "Unable to process this resume." });
        }
      }

      res.status(200).json({
        message: "Bulk upload processing finished.",
        data: { jobId: job._id, counts, results },
      });
    } catch (error) {
      console.error("Bulk resume upload failed:", error);
      res.status(500).json({ error: "Bulk resume upload failed." });
    } finally {
      await cleanupTempFiles();
      if (leaseJobId) {
        await releaseUploadLease(leaseJobId).catch((error) => {
          console.error(`Failed to release upload lease for batch ${leaseJobId}:`, error);
        });
        res.locals.uploadLeaseJobId = undefined;
      }
    }
  },
);

screeningRouter.post(
  "/jobs/:jobId/complete-upload",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const jobId = req.params.jobId;

      if (
        typeof jobId !== "string" ||
        !/^[a-f\d]{24}$/i.test(jobId)
      ) {
        res.status(400).json({
          error: "Invalid screening batch ID.",
        });
        return;
      }

      // Atomically finalize uploads only when no upload is active.
      const job = await ScreeningJob.findOneAndUpdate(
        {
          _id: jobId,
          status: "uploading",
          uploadComplete: false,
          cancelRequested: { $ne: true },
          activeUploads: 0,
        },
        [
          {
            $set: {
              uploadComplete: true,
              status: {
                $cond: [
                  { $gt: ["$counts.queued", 0] },
                  "queued",
                  "failed",
                ],
              },
              lastError: {
                $cond: [
                  { $gt: ["$counts.queued", 0] },
                  null,
                  "No valid resumes were added to this batch.",
                ],
              },
              completedAt: {
                $cond: [
                  { $gt: ["$counts.queued", 0] },
                  null,
                  new Date(),
                ],
              },
            },
          },
        ],
        {          
 returnDocument: "after",
  updatePipeline: true,
        },
      );

      if (!job) {
        const existingJob = await ScreeningJob.findById(jobId);

        if (!existingJob) {
          res.status(404).json({
            error: "Screening batch not found.",
          });
          return;
        }

        if (existingJob.cancelRequested ||
            ["cancelling", "cancelled", "interrupted"].includes(
              existingJob.status,
            )) {
          res.status(409).json({
            error: "This batch is being cancelled or has already been cancelled.",
          });
          return;
        }

        if (existingJob.uploadComplete) {
          res.status(200).json({
            message: "Upload was already completed.",
            data: existingJob,
          });
          return;
        }

        if ((existingJob.activeUploads ?? 0) > 0) {
          res.status(409).json({
            error: "Wait for active resume uploads to finish.",
          });
          return;
        }

        res.status(409).json({
          error: "This batch cannot be completed in its current state.",
        });
        return;
      }

      res.status(200).json({
        message: "Upload phase completed.",
        data: job,
      });
    } catch (error) {
      console.error("Failed to complete screening upload:", error);

      res.status(500).json({
        error: "Unable to complete screening upload.",
      });
    }
  },
);


// Request cancellation of an active screening batch.
screeningRouter.post(
  "/jobs/:jobId/cancel",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const jobId = req.params.jobId;

      if (
        typeof jobId !== "string" ||
        !/^[a-f\d]{24}$/i.test(jobId)
      ) {
        res.status(400).json({
          error: "Invalid screening batch ID.",
        });
        return;
      }

      const job = await ScreeningJob.findOneAndUpdate(
        {
          _id: jobId,
          status: { $in: ["uploading", "queued", "processing"] },
          cancelRequested: { $ne: true },
        },
        {
          $set: {
            status: "cancelling",
            cancelRequested: true,
            cancelRequestedAt: new Date(),
            interruptionReason:
  req.body?.reason === "USER_STARTED_NEW_BATCH"
    ? "USER_STARTED_NEW_BATCH"
    : "USER_CANCELLED",
            cleanupStatus: "pending",
          },
        },
        {
          returnDocument: "after",
        },
      );

      if (!job) {
        const existingJob = await ScreeningJob.findById(jobId);

        if (!existingJob) {
          res.status(404).json({
            error: "Screening batch not found.",
          });
          return;
        }

        if (
          ["cancelling", "interrupted", "cancelled"].includes(
            existingJob.status,
          )
        ) {
          res.status(200).json({
            message: "Cancellation has already been requested.",
            data: existingJob,
          });
          return;
        }

        if (
          ["completed", "partially_failed", "failed"].includes(
            existingJob.status,
          )
        ) {
          res.status(409).json({
            error: "This screening batch has already finished.",
            data: existingJob,
          });
          return;
        }

        res.status(409).json({
          error: "This batch cannot be cancelled in its current state.",
        });
        return;
      }

     // Return immediately; cleanup may need to wait for active uploads
// or currently processing screenings.
res.status(202).json({
  message: "Cancellation requested. Cleanup will run in the background.",
  data: job,
});

// Attempt cleanup immediately. The worker will retry if it is not
// safe to clean up yet.
void cleanupCancelledScreeningJob(jobId).catch((error) => {
  console.error(
    `Initial cleanup attempt failed for screening batch ${jobId}:`,
    error,
  );
});
    } catch (error) {
      console.error("Failed to request screening cancellation:", error);

      res.status(500).json({
        error: "Unable to cancel screening batch.",
      });
    }
  },
);


screeningRouter.get(
  "/jobs/:jobId/debug",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const jobId = req.params.jobId;

      if (typeof jobId !== "string" || !/^[a-f\d]{24}$/i.test(jobId)) {
        res.status(400).json({ error: "Invalid screening batch ID." });
        return;
      }

      const job = await ScreeningJob.findById(jobId).lean();

      if (!job) {
        res.status(404).json({ error: "Screening job not found." });
        return;
      }

      const screeningCount = await Screening.countDocuments({
        screeningJobId: job._id,
      });

      const statusCounts = await Screening.aggregate([
        {
          $match: {
            screeningJobId: job._id,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      res.status(200).json({
        job: {
          id: job._id,
          status: job.status,
          uploadComplete: job.uploadComplete,
          startedAt: job.startedAt,
          counts: job.counts,
        },
        screeningCount,
        statusCounts,
      });
    } catch (error) {
      console.error("[SCREENING DEBUG ERROR]", error);

      res.status(500).json({
        error: "Unable to inspect screening job.",
      });
    }
  },
);

// Generate AI scorecard suggestions for a requisition.



// Explicitly start AI screening for a completed upload batch.

screeningRouter.post(
  "/jobs/:jobId/start",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const jobId = req.params.jobId;

      if (
        typeof jobId !== "string" ||
        !/^[a-f\d]{24}$/i.test(jobId)
      ) {
        res.status(400).json({
          error: "Invalid screening batch ID.",
        });
        return;
      }

      const job = await ScreeningJob.findById(jobId);

      if (!job) {
        res.status(404).json({
          error: "Screening batch not found.",
        });
        return;
      }

      if (job.cancelRequested ||
          ["cancelling", "cancelled", "interrupted"].includes(
            job.status,
          )) {
        res.status(409).json({
          error: "This batch has been cancelled or is being cancelled.",
        });
        return;
      }

      if (!job.uploadComplete) {
        res.status(409).json({
          error: "Complete the upload phase before starting screening.",
        });
        return;
      }

      // Idempotent: do not restart an already-started batch.
      if (job.startedAt) {
        res.status(200).json({
          message: "Screening has already been started.",
          data: job,
        });
        return;
      }

      const queuedCount = job.counts?.queued ?? 0;

      if (queuedCount === 0) {
        res.status(400).json({
          error: "There are no valid resumes available for screening.",
        });
        return;
      }

      // A requisition must have a saved scorecard before screening starts.
      const scorecard = await Scorecard.findOne({
        requisitionId: job.requisitionId,
      });

      if (!scorecard || !scorecard.criteria?.length) {
        res.status(409).json({
          error: "A valid evaluation scorecard must be saved before screening.",
        });
        return;
      }

      // Lock the scorecard on the first screening start.
      if (!scorecard.lockedAt) {
        await Scorecard.updateOne(
          {
            _id: scorecard._id,
            lockedAt: null,
          },
          {
            $set: {
              lockedAt: new Date(),
            },
          },
        );
      }

      // Atomically start only if the batch is still eligible.
      const startedJob = await ScreeningJob.findOneAndUpdate(
        {
          _id: job._id,
          status: "queued",
          uploadComplete: true,
          startedAt: null,
          cancelRequested: { $ne: true },
        },
        {
          $set: {
            startedAt: new Date(),
            status: "queued",
            completedAt: null,
            lastError: null,
          },
        },
        {
          returnDocument: "after",
        },
      );

      if (!startedJob) {
        const latestJob = await ScreeningJob.findById(job._id);

        if (!latestJob) {
          res.status(404).json({
            error: "Screening batch not found.",
          });
          return;
        }

        if (latestJob.startedAt) {
          res.status(200).json({
            message: "Screening has already been started.",
            data: latestJob,
          });
          return;
        }

        res.status(409).json({
          error: "This batch is no longer eligible to start.",
          data: latestJob,
        });
        return;
      }

      res.status(200).json({
        message: "AI screening started. Candidates are being processed.",
        data: startedJob,
      });
    } catch (error) {
      console.error("Failed to start screening:", error);

      res.status(500).json({
        error: "Unable to start AI screening.",
      });
    }
  },
);

// Get screening batch details and progress.
screeningRouter.get(
  "/jobs/:jobId",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const jobId = req.params.jobId;

      if (typeof jobId !== "string" || !/^[a-f\d]{24}$/i.test(jobId)) {
        res.status(400).json({ error: "Invalid screening batch ID." });
        return;
      }

      const job = await ScreeningJob.findById(jobId).lean();

      if (!job) {
        res.status(404).json({ error: "Screening batch not found." });
        return;
      }

      const counts = job.counts;

      const total = counts?.total ?? 0;
      const completed = counts?.completed ?? 0;
      const failed = counts?.failed ?? 0;
      const queued = counts?.queued ?? 0;
      const processing = counts?.processing ?? 0;

      const processed = completed + failed;

      res.status(200).json({
        data: {
          ...job,
          progress: {
            total,
            processed,
            completed,
            failed,
            queued,
            processing,
            percentage:
              total > 0
                ? Math.round((processed / total) * 100)
                : 0,
          },
        },
      });
    } catch (error) {
      console.error("Failed to fetch screening batch:", error);

      res.status(500).json({
        error: "Unable to fetch screening batch.",
      });
    }
  },
);

// Get screening results, ranked by overall score.
screeningRouter.get(
  "/jobs/:jobId/results",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const jobId = req.params.jobId;

      if (typeof jobId !== "string" || !/^[a-f\d]{24}$/i.test(jobId)) {
        res.status(400).json({ error: "Invalid screening batch ID." });
        return;
      }

      const job = await ScreeningJob.findById(jobId)
        .select("_id status topN counts")
        .lean();

      if (!job) {
        res.status(404).json({ error: "Screening batch not found." });
        return;
      }

      const pageValue = Number(req.query.page ?? 1);
      const limitValue = Number(req.query.limit ?? 20);

      const page = Number.isInteger(pageValue) && pageValue > 0
        ? pageValue
        : 1;

      const limit = Number.isInteger(limitValue) && limitValue > 0
        ? Math.min(limitValue, 100)
        : 20;

      const status = req.query.status;

      const allowedStatuses = [
        "queued",
        "processing",
        "completed",
        "failed",
      ];

      if (
        status !== undefined &&
        (typeof status !== "string" ||
          !allowedStatuses.includes(status))
      ) {
        res.status(400).json({
          error: "Invalid screening status filter.",
        });
        return;
      }

      const filter: Record<string, unknown> = {
        screeningJobId: job._id,
      };

      if (typeof status === "string") {
        filter.status = status;
      }

      const [results, totalResults] = await Promise.all([
        Screening.find(filter)
         .populate({
  path: "resumeSubmissionId",
  select:
    "fullName email phone skills totalExperience parsingStatus identityStatus resume.originalName resume.mimeType resume.sizeBytes",
})
          .sort({
            overallScore: -1,
            evaluatedAt: -1,
            createdAt: -1,
          })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),

        Screening.countDocuments(filter),
      ]);

      res.status(200).json({
        data: {
          job,
          results,
          pagination: {
            page,
            limit,
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            hasNextPage: page * limit < totalResults,
            hasPreviousPage: page > 1,
          },
        },
      });
    } catch (error) {
      console.error("Failed to fetch screening results:", error);

      res.status(500).json({
        error: "Unable to fetch screening results.",
      });
    }
  },
);

// Get cumulative, deduplicated candidate rankings across all batches
// belonging to a requisition.
screeningRouter.get(
  "/requisitions/:requisitionId/ranked-candidates",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const requisitionId = req.params.requisitionId;

      if (
        typeof requisitionId !== "string" ||
        !/^[a-f\d]{24}$/i.test(requisitionId)
      ) {
        res.status(400).json({
          error: "Invalid requisition ID.",
        });
        return;
      }

      // Verify that this requisition belongs to the logged-in recruiter.
      const requisition = await Requisition.findOne({
        _id: requisitionId,
        createdBy: req.authUser!.id,
      })
        .select("_id status")
        .lean();

      if (!requisition) {
        res.status(404).json({
          error: "Requisition not found.",
        });
        return;
      }

      const pageValue = Number(req.query.page ?? 1);
      const limitValue = Number(req.query.limit ?? 50);

      const page =
        Number.isInteger(pageValue) && pageValue > 0
          ? pageValue
          : 1;

      const limit =
        Number.isInteger(limitValue) && limitValue > 0
          ? Math.min(limitValue, 100)
          : 50;

      // Fetch completed screenings from every batch under this requisition.
      // Sort BEFORE deduplication so the best resume version is retained.
    const screenings = await Screening.find({
  requisitionId: requisition._id,
  status: "completed",
}).populate({
          path: "resumeSubmissionId",
          select:
            "fullName email phone normalizedEmail normalizedPhone skills totalExperience parsingStatus identityStatus identityGroup candidateId resume.originalName resume.mimeType resume.sizeBytes screeningJobId",
        })
        .sort({
          overallScore: -1,
          evaluatedAt: -1,
          createdAt: -1,
          _id: 1,
        })
        .lean();

      const seenCandidates = new Set<string>();

      const uniqueResults = screenings.filter((screening) => {
        const resume = screening.resumeSubmissionId as unknown as
          | {
              _id: unknown;
              candidateId?: unknown;
              identityGroup?: unknown;
              identityStatus?: string;
              normalizedEmail?: string | null;
              normalizedPhone?: string | null;
            }
          | null;

        // Ignore screenings whose associated resume no longer exists.
        if (!resume) {
          return false;
        }

        let identityKey: string;

        // Rule 1: Same promoted candidate ID.
        if (resume.candidateId) {
          identityKey = `candidate:${String(resume.candidateId)}`;
        }

        // Rule 2: Merge an identity group only after confirmation.
        else if (
          resume.identityStatus === "matched" &&
          resume.identityGroup
        ) {
          identityKey = `identity:${String(resume.identityGroup)}`;
        }

        // Rule 3: Exact email + phone match.
        // Do not automatically merge records marked for manual review.
        else if (
          resume.identityStatus !== "manual_review" &&
          resume.normalizedEmail &&
          resume.normalizedPhone
        ) {
          identityKey = `contact:${resume.normalizedEmail}:${resume.normalizedPhone}`;
        }

        // Rule 4: Uncertain identity. Keep this resume as a separate entry.
        else {
          identityKey = `resume:${String(resume._id)}`;
        }

        if (seenCandidates.has(identityKey)) {
          return false;
        }

        seenCandidates.add(identityKey);
        return true;
      });

      // Pagination happens AFTER deduplication.
      const totalResults = uniqueResults.length;
      const startIndex = (page - 1) * limit;

      const results = uniqueResults
        .slice(startIndex, startIndex + limit)
        .map((screening, index) => ({
          ...screening,
          rank: startIndex + index + 1,
        }));

      res.status(200).json({
        data: {
          requisition,
          results,
          pagination: {
            page,
            limit,
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            hasNextPage: page * limit < totalResults,
            hasPreviousPage: page > 1,
          },
        },
      });
    } catch (error) {
      console.error(
        "Failed to fetch cumulative candidate rankings:",
        error,
      );

      res.status(500).json({
        error: "Unable to fetch cumulative candidate rankings.",
      });
    }
  },
);

// Retry every failed screening in a batch.

screeningRouter.post(
  "/jobs/:jobId/retry-failed",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    const session = await ScreeningJob.startSession();

    try {
      const jobId = req.params.jobId;

      if (
        typeof jobId !== "string" ||
        !/^[a-f\d]{24}$/i.test(jobId)
      ) {
        res.status(400).json({
          error: "Invalid screening batch ID.",
        });
        return;
      }

      const job = await ScreeningJob.findById(jobId);

      if (!job) {
        res.status(404).json({
          error: "Screening batch not found.",
        });
        return;
      }

      if (
        job.cancelRequested ||
        ["cancelling", "cancelled", "interrupted"].includes(job.status)
      ) {
        res.status(409).json({
          error: "Failed screenings cannot be retried because this batch is being cancelled or has been cancelled.",
        });
        return;
      }

      if (!job.uploadComplete || !job.startedAt) {
        res.status(409).json({
          error: "This batch has not been started for screening.",
        });
        return;
      }

      if (!["failed", "partially_failed"].includes(job.status)) {
        res.status(409).json({
          error: "Failed screenings can only be retried for failed or partially failed batches.",
        });
        return;
      }

      let retriedCount = 0;

      await session.withTransaction(async () => {
        // Requeue failed screenings inside the transaction.
        const result = await Screening.updateMany(
          {
            screeningJobId: job._id,
            status: "failed",
          },
          {
            $set: {
              status: "queued",
              attempts: 0,
              nextRunAt: new Date(),
              lockedAt: null,
              lockedBy: null,
              lastError: null,
            },
          },
          { session },
        );

        retriedCount = result.modifiedCount;

        if (retriedCount === 0) {
          return;
        }

        // Update batch counters only if the batch is still eligible.
        const updatedJob = await ScreeningJob.findOneAndUpdate(
          {
            _id: job._id,
            uploadComplete: true,
            startedAt: { $ne: null },
            status: { $in: ["failed", "partially_failed"] },
            cancelRequested: { $ne: true },
          },
          {
            $inc: {
              "counts.queued": retriedCount,
              "counts.failed": -retriedCount,
            },
            $set: {
              status: "queued",
              completedAt: null,
              lastError: null,
            },
          },
          {
            new: true,
            session,
          },
        );

        // Throwing aborts the transaction, including the Screening updates.
        if (!updatedJob) {
          throw new Error("SCREENING_BATCH_NO_LONGER_ELIGIBLE");
        }
      });

      if (retriedCount === 0) {
        const latestJob = await ScreeningJob.findById(job._id);

        res.status(200).json({
          message: "There are no failed screenings to retry.",
          retriedCount: 0,
          data: latestJob,
        });
        return;
      }

      const updatedJob = await ScreeningJob.findById(job._id);

      res.status(200).json({
        message: `${retriedCount} failed screenings have been queued for retry.`,
        retriedCount,
        data: updatedJob,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "SCREENING_BATCH_NO_LONGER_ELIGIBLE"
      ) {
        res.status(409).json({
          error: "This batch is no longer eligible for retry. It may have been cancelled or changed state.",
        });
        return;
      }

      console.error("Failed to retry screenings:", error);

      res.status(500).json({
        error: "Unable to retry failed screenings.",
      });
    } finally {
      await session.endSession();
    }
  },
);

