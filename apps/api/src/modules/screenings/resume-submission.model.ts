
import { model, Schema } from "mongoose";

const resumeSubmissionSchema = new Schema(
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

    // Candidate identity extracted from the resume.
    fullName: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "Needs review",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: null,
      index: true,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null,
    },

    normalizedEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },

    normalizedPhone: {
      type: String,
      trim: true,
      default: null,
    },

    totalExperience: {
      type: Number,
      min: 0,
      max: 60,
      default: null,
    },

    skills: {
      type: [String],
      default: [],
    },

    // Uploaded resume information.
    resume: {
      originalName: {
        type: String,
        required: true,
        maxlength: 255,
      },

      storageKey: {
        type: String,
        required: true,
        unique: true,
      },

      mimeType: {
        type: String,
        required: true,
      },

      sizeBytes: {
        type: Number,
        required: true,
        min: 1,
      },

      sha256: {
        type: String,
        required: true,
        index: true,
      },
    },

    extractedText: {
      type: String,
      select: false,
      default: "",
    },

    parsingStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "needs_review",
        "failed",
      ],
      default: "pending",
      index: true,
    },

    parsingWarnings: {
      type: [String],
      default: [],
    },

    // Identity resolution.
    identityStatus: {
      type: String,
      enum: [
        "unverified",
        "matched",
        "possible_duplicate",
        "manual_review",
      ],
      default: "unverified",
      index: true,
    },

    identityGroup: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    // Populated only after recruiter shortlisting.
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      default: null,
      index: true,
    },

    promotedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Useful for requisition-wide resume lookup.
resumeSubmissionSchema.index({
  requisitionId: 1,
  createdAt: -1,
});

// Useful for retrieving all submissions in a batch.
resumeSubmissionSchema.index({
  screeningJobId: 1,
  createdAt: -1,
});

export const ResumeSubmission = model(
  "ResumeSubmission",
  resumeSubmissionSchema,
);
