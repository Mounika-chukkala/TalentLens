
import { model, Schema } from "mongoose";

const candidateSubmissionSchema = new Schema(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },
    requisitionId: {
      type: Schema.Types.ObjectId,
      ref: "Requisition",
      required: true,
      index: true,
    },
    clientOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "ClientOrganization",
      required: true,
      index: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "submitted",
        "shortlisted",
        "rejected",
        "interview_proposed",
        "interview_scheduled",
      ],
      default: "submitted",
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    interviewSlot: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

candidateSubmissionSchema.index(
  { candidateId: 1, requisitionId: 1 },
  { unique: true },
);

candidateSubmissionSchema.index({
  clientOrganizationId: 1,
  requisitionId: 1,
  status: 1,
  createdAt: -1,
});

export const CandidateSubmission = model(
  "CandidateSubmission",
  candidateSubmissionSchema,
);
