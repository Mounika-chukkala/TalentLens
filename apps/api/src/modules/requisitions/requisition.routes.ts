
import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";

import { Requisition } from "./requisition.model.js";
import {
  requireAuth,
  requireRecruiter,
} from "../../middleware/auth.middleware.js";
import { ClientOrganization } from "../auth/client-organization.model.js";

export const requisitionRouter = Router();

const createRequisitionSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    clientOrganizationId: z.string().regex(
      /^[0-9a-fA-F]{24}$/,
      "Invalid client organization ID",
    ),
    location: z.string().trim().min(2).max(120),
    description: z.string().trim().min(20).max(10000),
    minExperience: z.number().min(0).max(60),
    maxExperience: z.number().min(0).max(60),
    noticePeriodDays: z.number().int().min(0).max(365),
  })
  .refine(
    (data) => data.maxExperience >= data.minExperience,
    {
      message: "Maximum experience must be at least minimum experience",
      path: ["maxExperience"],
    },
  );

// GET all requisitions
requisitionRouter.get("/", requireAuth, async (req, res) => {
  try {
    const filter =
  req.authUser!.role === "recruiter"
    ? {
        createdBy: new mongoose.Types.ObjectId(req.authUser!.id),
      }
    : {
        clientOrganizationId:
          req.authUser!.clientOrganizationId,
      };

    const requisitions = await Requisition.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      data: requisitions,
      count: requisitions.length,
    });
  } catch (error) {
    console.error("Failed to list requisitions:", error);

    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Could not retrieve requisitions",
    });
  }
});

// CREATE requisition
requisitionRouter.post(
  "/",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    const parsed = createRequisitionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    try {
      const clientOrganization =
        await ClientOrganization.findOne({
          _id: new mongoose.Types.ObjectId(
            parsed.data.clientOrganizationId,
          ),
          status: "active",
        });

      if (!clientOrganization) {
        res.status(404).json({
          error: "CLIENT_ORGANIZATION_NOT_FOUND",
          message:
            "The selected client organization does not exist or is inactive.",
        });
        return;
      }

      const {
        clientOrganizationId,
        ...requisitionData
      } = parsed.data;

const requisition = await Requisition.create({
  ...requisitionData,
  clientName: clientOrganization.name,
  clientOrganizationId: clientOrganization._id,
  createdBy: new mongoose.Types.ObjectId(req.authUser!.id),
});
      res.status(201).json({
        message: "Requisition created successfully",
        data: requisition,
      });
    } catch (error) {
      console.error("Failed to create requisition:", error);

      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not create requisition",
      });
    }
  },
);
