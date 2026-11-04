
import { model, Schema } from "mongoose";

const auditLogSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ["recruiter", "client", "system"],
      required: true,
    },
    clientOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "ClientOrganization",
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      maxlength: 100,
    },
    resourceType: {
      type: String,
      required: true,
      maxlength: 100,
    },
    resourceId: {
      type: String,
      default: null,
      maxlength: 100,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  },
);

auditLogSchema.index({ occurredAt: -1, action: 1 });

export const AuditLog = model("AuditLog", auditLogSchema);
