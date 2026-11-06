
import { Router } from "express";
import { Requisition } from "../requisitions/requisition.model.js";
import { ScreeningJob } from "./screening-job.model.js";
import { Scorecard } from "./scorecard.model.js";
import {
  requireAuth,
  requireRecruiter,
} from "../../middleware/auth.middleware.js";
import { generateScorecardSuggestions } from "./screening.service.js";
export const scorecardRouter = Router();

// Get the scorecard belonging to a requisition.
scorecardRouter.get(
  "/:requisitionId",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const { requisitionId } = req.params;

      if (
        typeof requisitionId !== "string" ||
        !/^[a-f\d]{24}$/i.test(requisitionId)
      ) {
        res.status(400).json({ error: "Invalid requisition ID." });
        return;
      }

const requisition = await Requisition.findOne({
  _id: requisitionId,
  createdBy: req.authUser!.id,
}).lean();
      if (!requisition) {
        res.status(404).json({ error: "Requisition not found." });
        return;
      }

      const scorecard = await Scorecard.findOne({
        requisitionId,
      }).lean();

      res.status(200).json({
        data: scorecard,
      });
    } catch (error) {
      console.error("Failed to fetch scorecard:", error);
      res.status(500).json({
        error: "Unable to fetch scorecard.",
      });
    }
  },
);
scorecardRouter.post(
  "/:requisitionId/generate",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const { requisitionId } = req.params;

      if (
        typeof requisitionId !== "string" ||
        !/^[a-f\d]{24}$/i.test(requisitionId)
      ) {
        res.status(400).json({
          error: "Invalid requisition ID.",
        });
        return;
      }

      const requisition = await Requisition.findOne({
  _id: requisitionId,
  createdBy: req.authUser!.id,
}).lean();
      if (!requisition) {
        res.status(404).json({
          error: "Requisition not found.",
        });
        return;
      }

      // Never generate a replacement for an existing scorecard.
      const existingScorecard = await Scorecard.findOne({
        requisitionId,
      }).lean();

      if (existingScorecard) {
        res.status(200).json({
          message: "An existing scorecard was found.",
          generated: false,
          data: existingScorecard,
        });
        return;
      }

      const criteria = await generateScorecardSuggestions({
        jobTitle: requisition.title,
        jobDescription: requisition.description,
        minExperience: requisition.minExperience,
        maxExperience: requisition.maxExperience,
        noticePeriodDays: requisition.noticePeriodDays,
      });

      res.status(200).json({
        message: "AI scorecard suggestions generated successfully.",
        generated: true,
        data: {
          requisitionId,
          criteria,
          totalWeight: 100,
        },
      });
    } catch (error) {
      console.error(
        "Failed to generate scorecard suggestions:",
        error,
      );

      res.status(500).json({
        error: "Unable to generate scorecard suggestions.",
      });
    }
  },
);
// Create or update a requisition's scorecard.
scorecardRouter.put(
  "/:requisitionId",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    try {
      const { requisitionId } = req.params;
      const { criteria } = req.body ?? {};

      if (
        typeof requisitionId !== "string" ||
        !/^[a-f\d]{24}$/i.test(requisitionId)
      ) {
        res.status(400).json({ error: "Invalid requisition ID." });
        return;
      }

const requisition = await Requisition.findOne({
  _id: requisitionId,
  createdBy: req.authUser!.id,
}).lean();
      if (!requisition) {
        res.status(404).json({ error: "Requisition not found." });
        return;
      }

      if (!Array.isArray(criteria) || criteria.length < 1 || criteria.length > 15) {
        res.status(400).json({
          error: "Provide between 1 and 15 scorecard criteria.",
        });
        return;
      }

      const validCriteria = criteria.every((item) =>
        item &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        typeof item.description === "string" &&
        item.description.trim().length > 0 &&
        typeof item.weight === "number" &&
        Number.isFinite(item.weight) &&
        item.weight > 0 &&
        item.weight <= 100
      );

      if (!validCriteria) {
        res.status(400).json({
          error: "Each criterion needs a name, description, and positive weight.",
        });
        return;
      }

      const totalWeight = criteria.reduce(
        (sum, item) => sum + item.weight,
        0,
      );

      if (Math.abs(totalWeight - 100) > 0.01) {
        res.status(400).json({
          error: `Criteria weights must total 100%. Current total: ${totalWeight.toFixed(2)}%.`,
        });
        return;
      }

      // A scorecard becomes immutable after any batch for this
      // requisition has started screening.
     // Check whether any screening batch has already started.
const startedBatch = await ScreeningJob.exists({
  requisitionId,
  startedAt: { $ne: null },
});

if (startedBatch) {
  res.status(409).json({
    error: "This scorecard is locked because screening has already started.",
  });
  return;
}

const normalizedCriteria = criteria.map((item) => ({
  name: item.name.trim(),
  description: item.description.trim(),
  weight: item.weight,
}));

// Atomically update only an unlocked scorecard.
const scorecard = await Scorecard.findOneAndUpdate(
  {
    requisitionId,
    lockedAt: null,
  },
  {
    $set: {
      criteria: normalizedCriteria,
      totalWeight: 100,
      generatedByAI: false,
    },
  },
  {
    new: true,
    runValidators: true,
  },
).lean();

if (!scorecard) {
  // Check whether a scorecard already exists and is locked.
  const existingScorecard = await Scorecard.findOne({
    requisitionId,
  }).lean();

  if (existingScorecard) {
    res.status(409).json({
      error: "This scorecard is locked and cannot be modified.",
    });
    return;
  }

  // No scorecard exists yet, so create the first one.
  const newScorecard = await Scorecard.create({
    requisitionId,
    criteria: normalizedCriteria,
    totalWeight: 100,
    generatedByAI: false,
    lockedAt: null,
  });

  res.status(200).json({
    message: "Scorecard saved successfully.",
    data: newScorecard,
  });
  return;
}

      res.status(200).json({
        message: "Scorecard saved successfully.",
        data: scorecard,
      });
    } catch (error) {
      console.error("Failed to save scorecard:", error);
      res.status(500).json({
        error: "Unable to save scorecard.",
      });
    }
  },
);
