
import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";

import { Screening } from "../screenings/screening.model.js";
import { ResumeSubmission } from "../screenings/resume-submission.model.js";
import { CandidateSubmission } from "./candidate-submission.model.js";
import { Requisition } from "../requisitions/requisition.model.js";

import {
  requireAuth,
  requireRecruiter,
  requireClient,
} from "../../middleware/auth.middleware.js";

export const candidateSubmissionRouter = Router();

const objectIdSchema = z.string().refine(mongoose.isValidObjectId, {
  message: "Invalid ID",
});

const createSubmissionSchema = z.object({
  requisitionId: objectIdSchema,
  round: z.number().int().min(1),
  title: z.string().trim().max(120).optional(),
  candidates: z
    .array(
      z.object({
        screeningId: objectIdSchema,
      }),
    )
    .min(1, "Select at least one candidate"),
});

const candidateFeedbackSchema = z.object({
  feedback: z.enum(["interested", "reject", "interview"]),
  feedbackNote: z.string().trim().max(1000).optional(),
});

type ResumeIdentity = {
  _id: mongoose.Types.ObjectId;
  candidateId?: mongoose.Types.ObjectId | null;
  identityGroup?: mongoose.Types.ObjectId | null;
  identityStatus?: string;
  normalizedEmail?: string | null;
  normalizedPhone?: string | null;
  fullName?: string;
  email?: string | null;
  skills?: string[];
  totalExperience?: number | null;
  resume?: {
    originalName?: string;
  };
};

function getIdentityKey(
  resume: ResumeIdentity,
  screeningId: string,
): string {
  if (resume.identityStatus === "manual_review") {
    return `screening:${screeningId}`;
  }

  if (resume.candidateId) {
    return `candidate:${resume.candidateId.toString()}`;
  }

  if (resume.identityGroup) {
    return `group:${resume.identityGroup.toString()}`;
  }

  if (resume.normalizedEmail && resume.normalizedPhone) {
    return `identity:${resume.normalizedEmail}:${resume.normalizedPhone}`;
  }

  return `screening:${screeningId}`;
}

/**
 * Recruiter submits a group of candidates to a client.
 * Candidate details, scores and ranks are derived from MongoDB.
 */
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
      const { requisitionId, round, title, candidates } = parsed.data;

      const screeningIds = candidates.map(
        (candidate) => candidate.screeningId,
      );

      // Reject repeated screening IDs in the same request.
      if (new Set(screeningIds).size !== screeningIds.length) {
        res.status(400).json({
          error: "DUPLICATE_SCREENING_SELECTION",
          message: "A screening can only be selected once.",
        });
        return;
      }

      const requisition = await Requisition.findOne({
        _id: requisitionId,
        createdBy: req.authUser!.id,
      }).select("_id clientOrganizationId status");

      if (!requisition) {
        res.status(404).json({
          error: "REQUISITION_NOT_FOUND",
          message: "Requisition not found or you do not have access to it.",
        });
        return;
      }

      if (!requisition.clientOrganizationId) {
        res.status(400).json({
          error: "REQUISITION_CLIENT_MISSING",
          message: "Assign a client organization to this requisition first.",
        });
        return;
      }

      if (requisition.status !== "open") {
        res.status(400).json({
          error: "REQUISITION_NOT_OPEN",
          message: "Candidates can only be submitted to open requisitions.",
        });
        return;
      }

      // Load only completed screenings belonging to this requisition.
      const selectedScreenings = await Screening.find({
        _id: { $in: screeningIds },
        requisitionId: requisition._id,
        status: "completed",
      }).select("_id resumeSubmissionId overallScore");

      if (selectedScreenings.length !== screeningIds.length) {
        res.status(400).json({
          error: "INVALID_SCREENING_SELECTION",
          message:
            "One or more selected candidates do not have a completed screening for this requisition.",
        });
        return;
      }

      const resumeIds = selectedScreenings.map((screening) =>
        screening.resumeSubmissionId.toString(),
      );

      // A single resume version must not be submitted twice.
      if (new Set(resumeIds).size !== resumeIds.length) {
        res.status(400).json({
          error: "DUPLICATE_RESUME_SELECTION",
          message: "The same resume cannot be submitted more than once.",
        });
        return;
      }

      // Load authoritative candidate details from the database.
      const resumes = await ResumeSubmission.find({
        _id: { $in: resumeIds },
        requisitionId: requisition._id,
      }).select(
        "_id candidateId identityGroup identityStatus normalizedEmail normalizedPhone fullName email skills totalExperience resume.originalName",
      );

      if (resumes.length !== resumeIds.length) {
        res.status(400).json({
          error: "INVALID_RESUME_SELECTION",
          message:
            "One or more selected resume records do not belong to this requisition.",
        });
        return;
      }

      const resumeMap = new Map(
        resumes.map((resume) => [
          resume._id.toString(),
          resume as unknown as ResumeIdentity,
        ]),
      );

      const screeningMap = new Map(
        selectedScreenings.map((screening) => [
          screening._id.toString(),
          screening,
        ]),
      );

      // Re-create the requisition leaderboard ordering from database data.
      // This prevents the browser from supplying an arbitrary rank.
      const rankedScreenings = await Screening.find({
        requisitionId: requisition._id,
        status: "completed",
        overallScore: { $ne: null },
      })
        .select("_id resumeSubmissionId overallScore evaluatedAt createdAt")
        .sort({
          overallScore: -1,
          evaluatedAt: -1,
          createdAt: -1,
          _id: 1,
        })
        .populate({
          path: "resumeSubmissionId",
          select:
            "_id candidateId identityGroup identityStatus normalizedEmail normalizedPhone",
        });

      const rankMap = new Map<string, number>();
      const seenIdentities = new Set<string>();
      let currentRank = 0;

      for (const rankedScreening of rankedScreenings) {
        const resume = rankedScreening.resumeSubmissionId as unknown as
          | ResumeIdentity
          | null;

        if (!resume?._id) {
          continue;
        }

        const screeningId = rankedScreening._id.toString();
        const identityKey = getIdentityKey(resume, screeningId);

        if (seenIdentities.has(identityKey)) {
          continue;
        }

        seenIdentities.add(identityKey);
        currentRank += 1;
        rankMap.set(screeningId, currentRank);
      }

      // Build the submission snapshot exclusively from database records.
      const submissionCandidates = [];

      for (const screeningId of screeningIds) {
        const screening = screeningMap.get(screeningId);

        if (!screening) {
          res.status(400).json({
            error: "INVALID_SCREENING_SELECTION",
            message: "A selected screening could not be found.",
          });
          return;
        }

        const resumeId = screening.resumeSubmissionId.toString();
        const resume = resumeMap.get(resumeId);
        const rank = rankMap.get(screeningId);

        if (!resume || !rank || screening.overallScore == null) {
          res.status(400).json({
            error: "INVALID_CANDIDATE_DATA",
            message:
              "A selected candidate is missing valid resume, ranking or score data.",
          });
          return;
        }

        submissionCandidates.push({
          screeningId: screening._id,
          resumeSubmissionId: resume._id,
          candidateId: resume.candidateId ?? null,
          rank,
          overallScore: screening.overallScore,
          candidateSnapshot: {
            fullName: resume.fullName || "Needs review",
            email: resume.email ?? null,
            skills: resume.skills ?? [],
            totalExperience: resume.totalExperience ?? null,
            resumeFileName: resume.resume?.originalName ?? null,
          },
          feedback: null,
          feedbackNote: null,
          feedbackBy: null,
          feedbackAt: null,
        });
      }

      const submission = await CandidateSubmission.create({
        requisitionId: requisition._id,
        clientOrganizationId: requisition.clientOrganizationId,
        submittedBy: req.authUser!.id,
        round,
        title: title ?? null,
        candidates: submissionCandidates,
        status: "submitted",
        submittedAt: new Date(),
      });

      res.status(201).json({
        message: "Candidates submitted successfully.",
        data: submission,
      });
    } catch (error) {
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      ) {
        res.status(409).json({
          error: "ROUND_ALREADY_EXISTS",
          message: "This submission round already exists for the requisition.",
        });
        return;
      }

      if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({
          error: "VALIDATION_ERROR",
          message: error.message,
        });
        return;
      }

      console.error("Failed to submit candidates:", error);

      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not submit candidates.",
      });
    }
  },
);

/**
 * Client views only submissions belonging to their organization.
 */
candidateSubmissionRouter.get(
  "/client",
  requireAuth,
  requireClient,
  async (req, res) => {
    try {
      const submissions = await CandidateSubmission.find({
        clientOrganizationId: req.authUser!.clientOrganizationId,
      })
        .sort({ submittedAt: -1 })
        .populate({
          path: "requisitionId",
          select: "title location status",
        })
        .populate({
          path: "candidates.candidateId",
          select: "fullName email totalExperience skills",
        })
        .lean();

      res.status(200).json({
        data: submissions,
        count: submissions.length,
      });
    } catch (error) {
      console.error("Failed to load client submissions:", error);

      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not load submitted candidates.",
      });
    }
  },
);

/**
 * Client submits feedback for one candidate within a submission round.
 */
candidateSubmissionRouter.patch(
  "/:submissionId/candidates/:candidateFeedbackId/feedback",
  requireAuth,
  requireClient,
  async (req, res) => {
    const { submissionId, candidateFeedbackId } = req.params;

    if (
      !mongoose.isValidObjectId(submissionId) ||
      !mongoose.isValidObjectId(candidateFeedbackId)
    ) {
      res.status(400).json({
        error: "INVALID_ID",
        message: "Invalid submission or candidate feedback ID.",
      });
      return;
    }

    const parsed = candidateFeedbackSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const submission = await CandidateSubmission.findOne({
        _id: submissionId,
        clientOrganizationId: req.authUser!.clientOrganizationId,
      });

      if (!submission) {
        res.status(404).json({
          error: "SUBMISSION_NOT_FOUND",
          message: "Submission not found.",
        });
        return;
      }

      const candidate = submission.candidates.find(
        (item) => item._id.toString() === candidateFeedbackId,
      );

      if (!candidate) {
        res.status(404).json({
          error: "SUBMITTED_CANDIDATE_NOT_FOUND",
          message: "Candidate was not found in this submission round.",
        });
        return;
      }

      candidate.feedback = parsed.data.feedback;
      candidate.feedbackNote = parsed.data.feedbackNote ?? null;
      candidate.feedbackBy = new mongoose.Types.ObjectId(
        req.authUser!.id,
      );
      candidate.feedbackAt = new Date();

      const allReviewed = submission.candidates.every(
        (item) => item.feedback !== null,
      );

      if (allReviewed) {
        submission.status = "reviewed";
      }

      await submission.save();

      res.status(200).json({
        message: "Candidate feedback saved.",
        data: {
          submissionId: submission._id,
          candidateFeedbackId: candidate._id,
          feedback: candidate.feedback,
          feedbackNote: candidate.feedbackNote,
          feedbackAt: candidate.feedbackAt,
          submissionStatus: submission.status,
        },
      });
    } catch (error) {
      console.error("Failed to save candidate feedback:", error);

      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not save candidate feedback.",
      });
    }
  },
);
