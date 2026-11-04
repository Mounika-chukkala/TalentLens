
import { model, Schema } from "mongoose";

const candidateSchema = new Schema(
  {
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
      enum: ["pending", "processing", "completed", "needs_review", "failed"],
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

candidateSchema.index({ email: 1 });

export const Candidate = model("Candidate", candidateSchema);
