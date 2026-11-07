
import { model, Schema } from "mongoose";

const screeningUploadLeaseSchema = new Schema(
  {
    screeningJobId: {
      type: Schema.Types.ObjectId,
      ref: "ScreeningJob",
      required: true,
      index: true,
    },

    // Unique identifier for the individual upload request.
    leaseId: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["active", "released", "expired"],
      default: "active",
      required: true,
      index: true,
    },

    // Used to identify and renew the owning upload request.
    ownerToken: {
      type: String,
      required: true,
    },

    heartbeatAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    releasedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Find active leases belonging to a screening batch.
screeningUploadLeaseSchema.index({
  screeningJobId: 1,
  status: 1,
  expiresAt: 1,
});

export const ScreeningUploadLease = model(
  "ScreeningUploadLease",
  screeningUploadLeaseSchema,
);
