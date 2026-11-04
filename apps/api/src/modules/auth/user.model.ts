
import { model, Schema } from "mongoose";

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["recruiter", "client"],
      required: true,
    },
    clientOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "ClientOrganization",
      default: null,
      index: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({ role: 1, clientOrganizationId: 1 });

export const User = model("User", userSchema);
