import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Candidate } from "./candidate.model.js";
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
  phone?: string | null;
  skills?: string[];
  totalExperience?: number | null;
  parsingStatus?:  | "pending"
  | "processing"
  | "completed"
  | "needs_review"
  | "failed";
  parsingWarnings?: string[];
  resume?: {
    originalName?: string;
    storageKey?: string;
    mimeType?: string;
    sizeBytes?: number;
    sha256?: string;
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


class SubmissionRouteError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = "SubmissionRouteError";
  }
}
/**
 * Recruiter submits a group of candidates to a client.
 * Candidate details, scores and ranks are derived from MongoDB.
 */

/**
 * Recruiter views all submission rounds and client feedback
 * for one of their own requisitions.
 */
candidateSubmissionRouter.get(
  "/requisition/:requisitionId",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const { requisitionId } = req.params;

      if (!mongoose.isValidObjectId(requisitionId)) {
        res.status(400).json({
          error: "INVALID_ID",
          message: "Invalid requisition ID.",
        });
        return;
      }

      const requisition = await Requisition.findOne({
        _id: requisitionId,
        createdBy: req.authUser!.id,
      }).select("_id");

      if (!requisition) {
        res.status(404).json({
          error: "REQUISITION_NOT_FOUND",
          message: "Requisition not found.",
        });
        return;
      }

      const submissions = await CandidateSubmission.find({
        requisitionId: requisition._id,
      })
        .sort({ round: -1, submittedAt: -1 })
        .populate({
          path: "candidates.candidateId",
          select: "fullName email phone totalExperience skills",
        })
        .populate({
          path: "submittedBy",
          select: "fullName email",
        })
        .lean();

      res.status(200).json({
        data: submissions,
        count: submissions.length,
      });
    } catch (error) {
      console.error("Failed to load requisition submissions:", error);

      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not load requisition submissions.",
      });
    }
  },
);


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

    let session: mongoose.ClientSession | null = null;

    try {
      const {
        requisitionId,
        round,
        title,
        candidates,
      } = parsed.data;

      const screeningIds = candidates.map(
        (candidate) => candidate.screeningId,
      );

      // 1. Validate duplicate screening IDs in the request.
      if (new Set(screeningIds).size !== screeningIds.length) {
        throw new SubmissionRouteError(
          400,
          "DUPLICATE_SCREENING_SELECTION",
          "A screening can only be selected once.",
        );
      }

      session = await mongoose.startSession();

      let createdSubmission: any = null;

      // 2. Start an actual MongoDB transaction.
      await session.withTransaction(async () => {
        // Verify recruiter ownership and requisition status.
        const requisition = await Requisition.findOne({
          _id: requisitionId,
          createdBy: req.authUser!.id,
        })
          .select("_id clientOrganizationId status")
          .session(session!);

        if (!requisition) {
          throw new SubmissionRouteError(
            404,
            "REQUISITION_NOT_FOUND",
            "Requisition not found or you do not have access to it.",
          );
        }

        if (!requisition.clientOrganizationId) {
          throw new SubmissionRouteError(
            400,
            "REQUISITION_CLIENT_MISSING",
            "Assign a client organization to this requisition first.",
          );
        }

        if (requisition.status !== "open") {
          throw new SubmissionRouteError(
            400,
            "REQUISITION_NOT_OPEN",
            "Candidates can only be submitted to open requisitions.",
          );
        }

        const organizationId = requisition.clientOrganizationId;
        const requisitionObjectId = requisition._id;

        // 3. Load selected completed screenings.
        const selectedScreenings = await Screening.find({
          _id: { $in: screeningIds },
          requisitionId: requisitionObjectId,
          status: "completed",
        })
          .select("_id resumeSubmissionId overallScore")
          .session(session!);

        if (selectedScreenings.length !== screeningIds.length) {
          throw new SubmissionRouteError(
            400,
            "INVALID_SCREENING_SELECTION",
            "One or more selected candidates do not have a completed screening for this requisition.",
          );
        }

        const resumeIds = selectedScreenings.map(
          (screening) => screening.resumeSubmissionId.toString(),
        );

        if (new Set(resumeIds).size !== resumeIds.length) {
          throw new SubmissionRouteError(
            400,
            "DUPLICATE_RESUME_SELECTION",
            "The same resume cannot be selected more than once.",
          );
        }

        // 4. Load authoritative resume records.
        const resumes = await ResumeSubmission.find({
          _id: { $in: resumeIds },
          requisitionId: requisitionObjectId,
        })
          .select(
            "_id candidateId identityGroup identityStatus normalizedEmail normalizedPhone fullName email phone skills totalExperience parsingStatus parsingWarnings resume.originalName resume.storageKey resume.mimeType resume.sizeBytes resume.sha256",
          )
          .session(session!);

        if (resumes.length !== resumeIds.length) {
          throw new SubmissionRouteError(
            400,
            "INVALID_RESUME_SELECTION",
            "One or more selected resume records do not belong to this requisition.",
          );
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

        // 5. Load all completed screenings for requisition-wide ranking.
        const rankedScreenings = await Screening.find({
          requisitionId: requisitionObjectId,
          status: "completed",
          overallScore: { $ne: null },
        })
          .select(
            "_id resumeSubmissionId overallScore evaluatedAt createdAt",
          )
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
          })
          .session(session!);

        // 6. Build rank maps ONCE.
        const rankMap = new Map<string, number>();
        const identityRankMap = new Map<string, number>();

        let currentRank = 0;

        for (const rankedScreening of rankedScreenings) {
          const rankedResume =
            rankedScreening.resumeSubmissionId as unknown as
              | ResumeIdentity
              | null;

          if (!rankedResume?._id) {
            continue;
          }

          const rankedScreeningId =
            rankedScreening._id.toString();

          const identityKey = getIdentityKey(
            rankedResume,
            rankedScreeningId,
          );

          let rank = identityRankMap.get(identityKey);

          if (rank === undefined) {
            currentRank += 1;
            rank = currentRank;
            identityRankMap.set(identityKey, rank);
          }

          rankMap.set(rankedScreeningId, rank);
        }

        // 7. Resolve or create requisition-specific Candidate profiles.
        const promotedCandidateIds = new Map<
          string,
          mongoose.Types.ObjectId
        >();

        for (const resume of resumes) {
          const resumeData =
            resume as unknown as ResumeIdentity;

          let candidateId: mongoose.Types.ObjectId | null =
            resumeData.candidateId ?? null;

          // STEP A: Verify an existing Candidate ID.
          // Legacy Candidate IDs from another requisition
          // must NEVER be reused.
          if (candidateId) {
            const existingCandidate = await Candidate.findOne({
              _id: candidateId,
              requisitionId: requisitionObjectId,
              clientOrganizationId: organizationId,
            })
              .select("_id")
              .session(session!);

            candidateId = existingCandidate?._id ?? null;
          }

          // STEP B: Search by normalized email, but only
          // when automatic identity matching is safe.
          const normalizedEmail = (
            resumeData.normalizedEmail ??
            resumeData.email ??
            ""
          )
            .trim()
            .toLowerCase();

          if (
            !candidateId &&
            normalizedEmail &&
            resumeData.identityStatus !== "manual_review"
          ) {
            const existingCandidate = await Candidate.findOne({
              requisitionId: requisitionObjectId,
              clientOrganizationId: organizationId,
              email: normalizedEmail,
            })
              .select("_id")
              .session(session!);

            if (existingCandidate) {
              candidateId = existingCandidate._id;
            }
          }

          // STEP C: Create a new profile if no valid
          // requisition-specific Candidate exists.
          if (!candidateId) {
            const resumeFile = resumeData.resume;

            if (
              !resumeFile?.originalName ||
              !resumeFile.storageKey ||
              !resumeFile.mimeType ||
              resumeFile.sizeBytes == null ||
              !resumeFile.sha256
            ) {
              throw new SubmissionRouteError(
                400,
                "INCOMPLETE_RESUME_METADATA",
                `Resume ${resumeData._id} is missing required file metadata.`,
              );
            }

            // Manual-review records must not be merged.
            // Store their email as null because the current
            // unique requisitionId + email index prevents
            // multiple profiles with the same email.
            const candidateEmail =
              resumeData.identityStatus === "manual_review"
                ? null
                : normalizedEmail || null;

            const [newCandidate] = await Candidate.create(
              [
                {
                  requisitionId: requisitionObjectId,
                  clientOrganizationId: organizationId,

                  fullName:
                    resumeData.fullName || "Needs review",

                  email: candidateEmail,
                  phone: resumeData.phone ?? null,

                  totalExperience:
                    resumeData.totalExperience ?? null,

                  skills: resumeData.skills ?? [],

                  resume: {
                    originalName: resumeFile.originalName,
                    storageKey: resumeFile.storageKey,
                    mimeType: resumeFile.mimeType,
                    sizeBytes: resumeFile.sizeBytes,
                    sha256: resumeFile.sha256,
                  },

                  parsingStatus:
                    resumeData.parsingStatus ?? "pending",

                  parsingWarnings:
                    resumeData.parsingWarnings ?? [],
                },
              ],
              { session },
            );

            candidateId = newCandidate._id;
          }

          if (!candidateId) {
            throw new Error(
              `Candidate creation failed for resume ${resumeData._id}`,
            );
          }

          // STEP D: Link the ResumeSubmission to the
          // correct requisition-specific Candidate.
    const resumeRecord = await ResumeSubmission.findOneAndUpdate(
  {
    _id: resumeData._id,
    requisitionId: requisitionObjectId,
  },
  {
    $set: {
      candidateId,
      promotedAt: new Date(),
    },
  },
  {
    new: true,
    session,
  },
).select("_id");

if (!resumeRecord) {
  throw new Error(
    `Could not link Candidate ${candidateId} to resume ${resumeData._id}`,
  );
}
      

          // Keep the exact Candidate ID for the submission.
          promotedCandidateIds.set(
            resumeData._id.toString(),
            candidateId,
          );
        }

        // 8. Prevent selecting two resumes that resolve
        // to the same Candidate profile.
        const selectedCandidateIds = Array.from(
          promotedCandidateIds.values(),
        );

        const uniqueCandidateIds = new Set(
          selectedCandidateIds.map((id) => id.toString()),
        );

        if (
          uniqueCandidateIds.size !==
          selectedCandidateIds.length
        ) {
          throw new SubmissionRouteError(
            409,
            "DUPLICATE_CANDIDATE_SELECTION",
            "Multiple selected resumes belong to the same candidate. Resolve the duplicates before submitting.",
          );
        }

        // 9. Prevent submitting an existing Candidate again
        // in another round of the SAME requisition.
        const previouslySubmitted =
          await CandidateSubmission.findOne({
            requisitionId: requisitionObjectId,
            "candidates.candidateId": {
              $in: selectedCandidateIds,
            },
          })
            .select("_id round")
            .session(session!);

        if (previouslySubmitted) {
          throw new SubmissionRouteError(
            409,
            "CANDIDATE_ALREADY_SUBMITTED",
            "One or more selected candidates have already been submitted for this requisition.",
          );
        }

        // 10. Build submission candidate snapshots.
        const submissionCandidates = [];

        for (const screeningId of screeningIds) {
          const screening = screeningMap.get(screeningId);

          if (!screening) {
            throw new SubmissionRouteError(
              400,
              "INVALID_SCREENING_SELECTION",
              "A selected screening could not be found.",
            );
          }

          const resumeId =
            screening.resumeSubmissionId.toString();

          const resume = resumeMap.get(resumeId);

          const rank = rankMap.get(screening._id.toString());

          if (
            !resume ||
            rank === undefined ||
            screening.overallScore == null
          ) {
            throw new SubmissionRouteError(
              400,
              "INVALID_CANDIDATE_DATA",
              "A selected candidate is missing valid resume, ranking or score data.",
            );
          }

          const candidateId = promotedCandidateIds.get(
            resume._id.toString(),
          );

          if (!candidateId) {
            throw new Error(
              `Candidate profile missing for resume ${resume._id.toString()}`,
            );
          }

          submissionCandidates.push({
            screeningId: screening._id,
            resumeSubmissionId: resume._id,
            candidateId,

            rank,
            overallScore: screening.overallScore,

            candidateSnapshot: {
              fullName: resume.fullName || "Needs review",
              email: resume.email ?? null,
              skills: resume.skills ?? [],
              totalExperience:
                resume.totalExperience ?? null,
              resumeFileName:
                resume.resume?.originalName ?? null,
            },

            feedback: null,
            feedbackNote: null,
            feedbackBy: null,
            feedbackAt: null,
          });
        }

        // 11. Create the CandidateSubmission.
        // This is part of the SAME transaction.
        const [newSubmission] = await CandidateSubmission.create(
          [
            {
              requisitionId: requisitionObjectId,
              clientOrganizationId: organizationId,
              submittedBy: req.authUser!.id,
              round,
              title: title ?? null,
              candidates: submissionCandidates,
              status: "submitted",
              submittedAt: new Date(),
            },
          ],
          { session },
        );

        createdSubmission = newSubmission;
      });

      // 12. Reached here only after successful transaction commit.
      res.status(201).json({
        message: "Candidates submitted successfully.",
        data: createdSubmission,
      });
    } catch (error) {
      if (error instanceof SubmissionRouteError) {
        res.status(error.statusCode).json({
          error: error.errorCode,
          message: error.message,
        });
        return;
      }

      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      ) {
        console.error("DUPLICATE KEY ERROR DETAILS:", {
          message: error.message,
          keyPattern: error.keyPattern,
          keyValue: error.keyValue,
        });

        const keyPattern = error.keyPattern || {};

        if (
          keyPattern.requisitionId &&
          keyPattern.round
        ) {
          res.status(409).json({
            error: "ROUND_ALREADY_EXISTS",
            message:
              "This submission round already exists for the requisition.",
          });
          return;
        }

        if (
          keyPattern.requisitionId &&
          keyPattern.email
        ) {
          res.status(409).json({
            error: "DUPLICATE_CANDIDATE_EMAIL",
            message:
              "A candidate with this email already exists in this requisition. Check existing candidate identity records.",
          });
          return;
        }

        res.status(409).json({
          error: "DUPLICATE_KEY",
          message:
            "A database record already exists with a conflicting unique value.",
          details: error.keyValue ?? {},
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
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  },
);


/**
 * Client views only submissions belonging to their organization.
 */
candidateSubmissionRouter.get(
  "/client",
  requireAuth,
  // requireClient,requireRecruiter,
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
// let submission: any = null;
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
if (candidate.candidateId) {
  const latestFeedback = await CandidateSubmission.aggregate([
    {
      $unwind: "$candidates",
    },
    {
      $match: {
        "candidates.candidateId": candidate.candidateId,
        "candidates.feedback": { $ne: null },
        "candidates.feedbackAt": { $ne: null },
      },
    },
    {
      $sort: {
        "candidates.feedbackAt": -1,
      },
    },
    {
      $limit: 1,
    },
    {
      $project: {
        _id: 0,
        feedback: "$candidates.feedback",
      },
    },
  ]);

  if (latestFeedback.length > 0) {
    const stageByFeedback = {
      interested: "shortlisted",
      interview: "interview",
      reject: "rejected",
    } as const;

    const newStage =
      stageByFeedback[
        latestFeedback[0].feedback as keyof typeof stageByFeedback
      ];

    if (newStage) {
      await Candidate.findOneAndUpdate(
        {
          _id: candidate.candidateId,
          clientOrganizationId: submission.clientOrganizationId,
        },
        {
          $set: {
            recruitmentStage: newStage,
          },
        },
        {
          new: true,
        },
      );
    }
  }
}
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
