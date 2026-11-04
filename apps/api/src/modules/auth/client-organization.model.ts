
import { model, Schema } from "mongoose";

const clientOrganizationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

clientOrganizationSchema.index({ name: 1 });

export const ClientOrganization = model(
  "ClientOrganization",
  clientOrganizationSchema,
);
