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
    "cancelling",
    "completed",
    "partially_failed",
    "failed",
    "interrupted",
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
      cancelled: { type: Number, default: 0, min: 0 },
    },

    // Prevent processing before all upload chunks have arrived.
    uploadComplete: {
      type: Boolean,
      default: false,
    },
    activeUploads: {
  type: Number,
  default: 0,
  min: 0,
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
    cancelRequested: {
  type: Boolean,
  default: false,
  index: true,
},

cancelRequestedAt: {
  type: Date,
  default: null,
},

interruptionReason: {
  type: String,
  enum: [
    "USER_STARTED_NEW_BATCH",
    "USER_CANCELLED",
    "SYSTEM_ERROR",
  ],
  default: null,
},

cleanupStatus: {
  type: String,
  enum: ["not_required", "pending", "completed", "failed"],
  default: "not_required",
},

cleanupStartedAt: {
  type: Date,
  default: null,
},

cleanupCompletedAt: {
  type: Date,
  default: null,
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