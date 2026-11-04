
import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Candidate } from "./candidate.model.js";
import { CandidateSubmission } from "./candidate-submission.model.js";
import { Requisition } from "../requisitions/requisition.model.js";
import {
  requireAuth,
  requireRecruiter,
  requireClient,
} from "../../middleware/auth.middleware.js";
import { CandidateConsent } from "./candidate-consent.model.js";
export const candidateSubmissionRouter = Router();

const createSubmissionSchema = z.object({
  candidateId: z.string().refine(mongoose.isValidObjectId, {
    message: "Invalid candidate ID",
  }),
  requisitionId: z.string().refine(mongoose.isValidObjectId, {
    message: "Invalid requisition ID",
  }),
});

candidateSubmissionRouter.post(
  "/",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    const parsed = createSubmissionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const [candidate, requisition] = await Promise.all([
        Candidate.findById(parsed.data.candidateId).select("_id"),
        Requisition.findById(parsed.data.requisitionId).select(
          "_id clientOrganizationId status",
        ),
      ]);

      if (!candidate) {
        res.status(404).json({
          error: "CANDIDATE_NOT_FOUND",
          message: "Candidate not found",
        });
        return;
      }

      if (!requisition) {
        res.status(404).json({
          error: "REQUISITION_NOT_FOUND",
          message: "Requisition not found",
        });
        return;
      }

      if (!requisition.clientOrganizationId) {
        res.status(400).json({
          error: "REQUISITION_CLIENT_MISSING",
          message: "Assign this requisition to a client organization first",
        });
        return;
      }

      if (requisition.status !== "open") {
        res.status(400).json({
          error: "REQUISITION_NOT_OPEN",
          message: "Candidates can only be submitted to open requisitions",
        });
        return;
      }
const consent = await CandidateConsent.findOne({
  candidateId: candidate._id,
  purpose: "recruitment_screening",
  status: "granted",
  withdrawnAt: null,
}).sort({ createdAt: -1 });

if (!consent) {
  res.status(403).json({
    error: "CANDIDATE_CONSENT_REQUIRED",
    message:
      "Recorded candidate consent for recruitment screening is required before submission.",
  });
  return;
}


      const submission = await CandidateSubmission.create({
        candidateId: candidate._id,
        requisitionId: requisition._id,
        clientOrganizationId: requisition.clientOrganizationId,
        submittedBy: req.authUser!.id,
      });

      res.status(201).json({ data: submission });
    } catch (error) {
      if (
        error instanceof mongoose.Error &&
        error.name === "ValidationError"
      ) {
        res.status(400).json({
          error: "VALIDATION_ERROR",
          message: error.message,
        });
        return;
      }

      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      ) {
        res.status(409).json({
          error: "ALREADY_SUBMITTED",
          message: "This candidate was already submitted to this requisition",
        });
        return;
      }

      console.error("Failed to submit candidate:", error);
      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not submit candidate",
      });
    }
  },
);


const reviewSubmissionSchema = z
  .object({
    status: z.enum([
      "shortlisted",
      "rejected",
      "interview_proposed",
    ]),
    rejectionReason: z.string().trim().max(1000).optional(),
    interviewSlot: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "rejected" && !data.rejectionReason) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "A rejection reason is required",
      });
    }

    if (data.status === "interview_proposed") {
      if (
        !data.interviewSlot ||
        Number.isNaN(data.interviewSlot.getTime()) ||
        data.interviewSlot <= new Date()
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["interviewSlot"],
          message: "Provide a valid future interview date and time",
        });
      }
    }
  });

candidateSubmissionRouter.patch(
  "/:id/review",
  requireAuth,
  requireClient,
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({
        error: "INVALID_SUBMISSION_ID",
        message: "Invalid submission ID",
      });
      return;
    }

    const parsed = reviewSubmissionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const submission = await CandidateSubmission.findOne({
        _id: req.params.id,
        clientOrganizationId: req.authUser!.clientOrganizationId,
      });

      if (!submission) {
        res.status(404).json({
          error: "SUBMISSION_NOT_FOUND",
          message: "Submission not found",
        });
        return;
      }

      submission.status = parsed.data.status;
      submission.rejectionReason =
        parsed.data.status === "rejected"
          ? parsed.data.rejectionReason!
          : null;
      submission.interviewSlot =
        parsed.data.status === "interview_proposed"
          ? parsed.data.interviewSlot!
          : null;

      await submission.save();

      res.status(200).json({
        message: "Submission updated",
        data: {
          id: submission._id,
          status: submission.status,
          rejectionReason: submission.rejectionReason,
          interviewSlot: submission.interviewSlot,
        },
      });
    } catch (error) {
      console.error("Failed to review submission:", error);
      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not update submission",
      });
    }
  },
);


candidateSubmissionRouter.get(
  "/client",
  requireAuth,
  requireClient,
  async (req, res) => {
    try {
      const submissions = await CandidateSubmission.find({
        clientOrganizationId: req.authUser!.clientOrganizationId,
      })
        .sort({ createdAt: -1 })
        .populate({
          path: "candidateId",
          select:
            "fullName totalExperience skills parsingStatus",
        })
        .populate({
          path: "requisitionId",
          select: "title location status",
        })
        .lean();

      const data = submissions
        .filter(
          (submission) =>
            submission.candidateId &&
            typeof submission.candidateId === "object" &&
            "fullName" in submission.candidateId,
        )
        .map((submission) => ({
          id: submission._id,
          status: submission.status,
          rejectionReason: submission.rejectionReason,
          interviewSlot: submission.interviewSlot,
          submittedAt: submission.createdAt,
          candidate: submission.candidateId,
          requisition: submission.requisitionId,
        }));

      res.status(200).json({
        data,
        count: data.length,
      });
    } catch (error) {
      console.error("Failed to load client submissions:", error);
      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not load submitted candidates",
      });
    }
  },
);

