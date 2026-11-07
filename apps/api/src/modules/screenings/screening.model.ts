import { model, Schema } from "mongoose";

const criterionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
   score: {
  type: Number,
  required: false,
  min: 0,
  max: 100,
  default: null,
},
    evidence: {
      type: [String],
      default: [],
    },
    explanation: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    evidenceStatus: {
  type: String,
  enum: [
    "demonstrated",
    "partial",
    "not_demonstrated",
    "insufficient_evidence",
  ],
  required: true,
},
  },
  { _id: false },
);

const screeningSchema = new Schema(
  {
    screeningJobId: {
      type: Schema.Types.ObjectId,
      ref: "ScreeningJob",
      required: true,
      index: true,
    },

    requisitionId: {
      type: Schema.Types.ObjectId,
      ref: "Requisition",
      required: true,
      index: true,
    },

   resumeSubmissionId: {
  type: Schema.Types.ObjectId,
  ref: "ResumeSubmission",
  required: true,
  index: true,
},

    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed","cancelled"],
      default: "queued",
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxAttempts: {
      type: Number,
      default: 3,
      min: 1,
    },

    nextRunAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Worker lease fields help recover work after a crash.
    lockedAt: {
      type: Date,
      default: null,
    },

    lockedBy: {
      type: String,
      default: null,
    },

    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    recommendation: {
      type: String,
      enum: ["strong_match", "potential_match", "low_match"],
      default: null,
    },

    criteria: {
      type: [criterionSchema],
      default: [],
    },

    strengths: {
      type: [String],
      default: [],
    },

    concerns: {
      type: [String],
      default: [],
    },

    missingRequirements: {
      type: [String],
      default: [],
    },

    summary: {
      type: String,
      default: "",
      maxlength: 4000,
    },

    model: {
      type: String,
      default: null,
    },

    evaluatedAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    evidenceCoverage: {
  type: Number,
  min: 0,
  max: 100,
  default: 0,
},

assessmentStatus: {
  type: String,
  enum: [
    "complete",
    "partial",
    "insufficient_evidence",
  ],
  default: "complete",
},
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// A candidate can be evaluated once per batch.
// The same candidate can still be evaluated in another batch or requisition.
screeningSchema.index(
  { screeningJobId: 1, resumeSubmissionId: 1 },
  { unique: true },
);
// Efficient worker lookup.
screeningSchema.index({ status: 1, nextRunAt: 1, createdAt: 1 });

// Efficient ranked results lookup.
screeningSchema.index({
  requisitionId: 1,
  status: 1,
  overallScore: -1,
});
export const Screening = model("Screening", screeningSchema);