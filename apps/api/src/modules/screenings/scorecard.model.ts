
import { model, Schema } from "mongoose";

const scorecardCriterionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    weight: {
      type: Number,
      required: true,
      min: 0.01,
      max: 100,
    },
  },
  { _id: false },
);

const scorecardSchema = new Schema(
  {
    requisitionId: {
      type: Schema.Types.ObjectId,
      ref: "Requisition",
      required: true,
      unique: true,
      index: true,
    },
    criteria: {
      type: [scorecardCriterionSchema],
      required: true,
      validate: {
        validator: (criteria: unknown[]) =>
          Array.isArray(criteria) &&
          criteria.length >= 1 &&
          criteria.length <= 15,
        message: "A scorecard must contain between 1 and 15 criteria.",
      },
    },
    totalWeight: {
      type: Number,
      required: true,
      default: 100,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    generatedByAI: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Validate the total weight before saving.
scorecardSchema.pre("validate", function () {
  const total = this.criteria.reduce(
    (sum, criterion) => sum + criterion.weight,
    0,
  );

  if (Math.abs(total - 100) > 0.01) {
    this.invalidate(
      "criteria",
      "All scorecard criteria weights must total exactly 100%.",
    );
  }

  this.totalWeight = 100;
});

export const Scorecard = model("Scorecard", scorecardSchema);
