
import { Router } from "express";
import { Requisition } from "../requisitions/requisition.model.js";
import { ScreeningJob } from "./screening-job.model.js";
import { Scorecard } from "./scorecard.model.js";
import {
  requireAuth,
  requireRecruiter,
} from "../../middleware/auth.middleware.js";

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

      const requisition = await Requisition.findById(requisitionId).lean();

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

      const requisition = await Requisition.findById(requisitionId).lean();

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

      const scorecard = await Scorecard.findOneAndUpdate(
        { requisitionId },
        {
          $set: {
            criteria: criteria.map((item) => ({
              name: item.name.trim(),
              description: item.description.trim(),
              weight: item.weight,
            })),
            totalWeight: 100,
            generatedByAI: false,
          },
          $setOnInsert: {
            requisitionId,
            lockedAt: null,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      ).lean();

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
