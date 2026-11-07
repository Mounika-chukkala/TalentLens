
import { model, Schema } from "mongoose";

const candidateSchema = new Schema(
  {
    // A candidate profile belongs to exactly one requisition.
    requisitionId: {
      type: Schema.Types.ObjectId,
      ref: "Requisition",
      required: true,
      index: true,
    },

    // Retained for client-level authorization and filtering.
    clientOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "ClientOrganization",
      required: true,
      index: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: null,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 30,
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

    resume: {
      originalName: {
        type: String,
        required: true,
        maxlength: 255,
      },

      storageKey: {
        type: String,
        required: true,
        // unique: true,
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

    recruitmentStage: {
      type: String,
      enum: [
        "new",
        "screening",
        "shortlisted",
        "interview",
        "offered",
        "hired",
        "rejected",
      ],
      default: "new",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Efficient requisition-specific candidate lookup.
candidateSchema.index({
  requisitionId: 1,
  createdAt: -1,
});

// Prevent the same email from having multiple candidate profiles
// within the same requisition.
// Different requisitions can have the same email.
candidateSchema.index(
  { requisitionId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: "string" },
    },
  },
);


export const Candidate = model("Candidate", candidateSchema);
