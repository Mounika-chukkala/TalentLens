
import { model, Schema } from "mongoose";

const candidateConsentSchema = new Schema(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["recruitment_screening"],
      required: true,
    },
    status: {
      type: String,
      enum: ["granted", "withdrawn"],
      required: true,
      default: "granted",
    },
    consentedAt: {
      type: Date,
      required: true,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    source: {
      type: String,
      enum: ["candidate_form", "documented_recruiter_confirmation"],
      required: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    evidenceReference: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

candidateConsentSchema.index({
  candidateId: 1,
  purpose: 1,
  createdAt: -1,
});

export const CandidateConsent = model(
  "CandidateConsent",
  candidateConsentSchema,
);
