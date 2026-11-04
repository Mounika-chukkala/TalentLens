
import { model, Schema } from "mongoose";

const invitationSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    clientOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "ClientOrganization",
      required: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

invitationSchema.index({ email: 1, clientOrganizationId: 1 });

export const Invitation = model("Invitation", invitationSchema);
