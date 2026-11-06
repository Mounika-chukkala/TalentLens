
import { model, Schema } from "mongoose";

const requisitionSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    createdBy: {
  type: Schema.Types.ObjectId,
  required: true,
  index: true,
},
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    minExperience: {
      type: Number,
      required: true,
      min: 0,
      max: 60,
    },
    maxExperience: {
      type: Number,
      required: true,
      min: 0,
      max: 60,
    },
    noticePeriodDays: {
      type: Number,
      required: true,
      min: 0,
      max: 365,
    },
    status: {
      type: String,
      enum: ["open", "on_hold", "closed"],
      default: "open",
    },
    clientOrganizationId: {
  type: Schema.Types.ObjectId,
  ref: "ClientOrganization",
  default: null,
  index: true,
},
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

requisitionSchema.index({ status: 1, createdAt: -1 });

export const Requisition = model(
  "Requisition",
  requisitionSchema,
);
