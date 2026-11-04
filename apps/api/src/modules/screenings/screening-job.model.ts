import { model, Schema, Types } from "mongoose";

const screeningJobSchema = new Schema(
  {
    requisitionId: {
      type: Schema.Types.ObjectId,
      ref: "Requisition",
      required: true,
      index: true,
    },

    // One recruiter-initiated upload batch.
    name: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "Resume screening batch",
    },

    topN: {
      type: Number,
      min: 1,
      max: 500,
      default: 50,
    },

    status: {
      type: String,
      enum: [
        "uploading",
        "queued",
        "processing",
        "completed",
        "partially_failed",
        "failed",
        "cancelled",
      ],
      default: "uploading",
      index: true,
    },

    counts: {
      total: { type: Number, default: 0, min: 0 },
      uploaded: { type: Number, default: 0, min: 0 },
      duplicate: { type: Number, default: 0, min: 0 },
      rejected: { type: Number, default: 0, min: 0 },
      queued: { type: Number, default: 0, min: 0 },
      processing: { type: Number, default: 0, min: 0 },
      completed: { type: Number, default: 0, min: 0 },
      failed: { type: Number, default: 0, min: 0 },
    },

    // Prevent processing before all upload chunks have arrived.
    uploadComplete: {
      type: Boolean,
      default: false,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

screeningJobSchema.index({ requisitionId: 1, createdAt: -1 });
screeningJobSchema.index({ status: 1, createdAt: 1 });

export const ScreeningJob = model("ScreeningJob", screeningJobSchema);