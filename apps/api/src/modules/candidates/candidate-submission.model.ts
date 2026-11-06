
import { model, Schema } from "mongoose";

const candidateFeedbackSchema = new Schema(
  {
    screeningId: {
      type: Schema.Types.ObjectId,
      ref: "Screening",
      required: true,
    },
    resumeSubmissionId: {
      type: Schema.Types.ObjectId,
      ref: "ResumeSubmission",
      required: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      default: null,
    },
    rank: {
      type: Number,
      required: true,
      min: 1,
    },
    overallScore: {
      type: Number,
      required: true,
    },
    candidateSnapshot: {
      fullName: { type: String, required: true },
      email: { type: String, default: null },
      skills: { type: [String], default: [] },
      totalExperience: { type: Number, default: null },
      resumeFileName: { type: String, default: null },
    },
    feedback: {
      type: String,
      enum: ["interested", "reject", "interview", null],
      default: null,
    },
    feedbackNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    feedbackBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    feedbackAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true },
);

const candidateSubmissionSchema = new Schema(
  {
    requisitionId: {
      type: Schema.Types.ObjectId,
      ref: "Requisition",
      required: true,
      index: true,
    },
    clientOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "ClientOrganization",
      required: true,
      index: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    round: {
      type: Number,
      required: true,
      min: 1,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    candidates: {
      type: [candidateFeedbackSchema],
      required: true,
      validate: {
        validator: (value: unknown[]) => value.length > 0,
        message: "At least one candidate must be submitted.",
      },
    },
    status: {
      type: String,
      enum: ["submitted", "reviewed"],
      default: "submitted",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

candidateSubmissionSchema.index(
  { requisitionId: 1, round: 1 },
  { unique: true },
);

candidateSubmissionSchema.index({
  clientOrganizationId: 1,
  requisitionId: 1,
  submittedAt: -1,
});

export const CandidateSubmission = model(
  "CandidateSubmission",
  candidateSubmissionSchema,
);
