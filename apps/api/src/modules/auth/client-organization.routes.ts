
import { Router } from "express";
import { z } from "zod";
import { ClientOrganization } from "./client-organization.model.js";
import {
  requireAuth,
  requireRecruiter,
} from "../../middleware/auth.middleware.js";

export const clientOrganizationRouter = Router();

const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(160),
});

// Escape special characters before using a name in a regular expression.
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// List active organizations for the recruiter.
clientOrganizationRouter.get(
  "/",
  requireAuth,
  requireRecruiter,
  async (_req, res) => {
    try {
      const organizations = await ClientOrganization.find({
        status: "active",
      })
        .select("_id name status createdAt")
        .sort({ name: 1 })
        .lean();

      res.status(200).json({
        data: organizations,
        count: organizations.length,
      });
    } catch (error) {
      console.error("Failed to list client organizations:", error);
      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not retrieve client organizations",
      });
    }
  },
);

// Create a new client organization.
clientOrganizationRouter.post(
  "/",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    const parsed = createOrganizationSchema.safeParse(req.body);

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
      const name = parsed.data.name;

      const existingOrganization = await ClientOrganization.findOne({
        name: {
          $regex: `^${escapeRegex(name)}$`,
          $options: "i",
        },
      });

      if (existingOrganization) {
        if (existingOrganization.status === "suspended") {
          res.status(409).json({
            error: "ORGANIZATION_SUSPENDED",
            message:
              "An organization with this name already exists but is suspended.",
          });
          return;
        }

        res.status(409).json({
          error: "ORGANIZATION_ALREADY_EXISTS",
          message:
            "A client organization with this name already exists. Select it instead.",
          data: existingOrganization,
        });
        return;
      }

      const organization = await ClientOrganization.create({
        name,
        status: "active",
      });

      res.status(201).json({
        message: "Client organization created successfully",
        data: organization,
      });
    } catch (error) {
      console.error("Failed to create client organization:", error);
      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not create client organization",
      });
    }
  },
);
