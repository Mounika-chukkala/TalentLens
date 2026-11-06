
import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";

import {
  requireAuth,
  requireRecruiter,
} from "../../middleware/auth.middleware.js";

import { Invitation } from "./invitation.model.js";
import { ClientOrganization } from "./client-organization.model.js";
import { User } from "./user.model.js";
import { hashPassword } from "./auth.service.js";
import { sendClientInvitationEmail } from "./email.service.js";

export const invitationRouter = Router();

const createSchema = z
  .object({
    email: z.string().trim().email().max(254),

    // Supply an existing organization ID OR a name for a new organization.
    clientOrganizationId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional(),

    clientOrganizationName: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .optional(),
  })
  .refine(
    (data) =>
      Boolean(data.clientOrganizationId) !==
      Boolean(data.clientOrganizationName),
    {
      message:
        "Provide either clientOrganizationId or clientOrganizationName, not both.",
    },
  );

const acceptSchema = z.object({
  token: z.string().min(32).max(256),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
});

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// CREATE AND SEND INVITATION
invitationRouter.post(
  "/",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Provide a valid email and exactly one organization identifier.",
        issues: parsed.error.issues,
      });
      return;
    }

    let createdInvitationId: mongoose.Types.ObjectId | null = null;

    try {
      const email = parsed.data.email.toLowerCase();

      // An existing account cannot be invited again.
      const existingUser = await User.exists({ email });

      if (existingUser) {
        res.status(409).json({
          message: "An account already exists for this email.",
        });
        return;
      }

      let organization;

      if (parsed.data.clientOrganizationId) {
        // Reuse the selected organization.
        organization = await ClientOrganization.findOne({
          _id: new mongoose.Types.ObjectId(
            parsed.data.clientOrganizationId,
          ),
          status: "active",
        });
      } else {
        // Find an existing organization by name before creating one.
        const organizationName =
          parsed.data.clientOrganizationName!.trim();

        organization = await ClientOrganization.findOne({
          name: {
            $regex: `^${organizationName.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&",
            )}$`,
            $options: "i",
          },
          status: "active",
        });

        if (!organization) {
          organization = await ClientOrganization.create({
            name: organizationName,
            status: "active",
          });
        }
      }

      if (!organization) {
        res.status(404).json({
          message:
            "The selected client organization does not exist or is inactive.",
        });
        return;
      }

      // Avoid multiple pending invitations for the same contact
      // within the same organization.
      const now = new Date();

      const existingInvitation = await Invitation.findOne({
        email,
        clientOrganizationId: organization._id,
        acceptedAt: null,
        expiresAt: { $gt: now },
      });

      if (existingInvitation) {
        res.status(409).json({
          message:
            "A pending invitation already exists for this email and organization.",
        });
        return;
      }

      // Remove expired or previously invalidated invitations.
      await Invitation.deleteMany({
        email,
        clientOrganizationId: organization._id,
        acceptedAt: null,
        expiresAt: { $lte: now },
      });

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      );

      const invitation = await Invitation.create({
        email,
        clientOrganizationId: organization._id,
        invitedBy: new mongoose.Types.ObjectId(req.authUser!.id),
        tokenHash,
        expiresAt,
      });

      createdInvitationId = invitation._id;

      const frontendUrl = process.env.FRONTEND_URL;

      if (!frontendUrl) {
        throw new Error("FRONTEND_URL is not configured.");
      }

      const invitationUrl =
        `${frontendUrl.replace(/\/$/, "")}` +
        `/accept-invitation?token=${rawToken}`;

      // Send the actual email.
      await sendClientInvitationEmail({
        email,
        organizationName: organization.name,
        invitationUrl,
        expiresAt,
      });

      res.status(201).json({
        message: "Client invitation sent successfully.",
        data: {
          email,
          organization: organization.name,
          clientOrganizationId: organization._id,
          expiresAt,
          emailSent: true,
        },
      });
    } catch (error) {
      console.error("Creating/sending invitation failed:", error);

      // Do not leave an unusable pending invitation behind
      // if email delivery fails.
      if (createdInvitationId) {
        await Invitation.deleteOne({
          _id: createdInvitationId,
        }).catch((cleanupError) => {
          console.error(
            "Failed to clean up invitation after email failure:",
            cleanupError,
          );
        });
      }

      res.status(502).json({
        message:
          "Unable to send the invitation email. Check the email configuration and try again.",
      });
    }
  },
);

// ACCEPT INVITATION AND CREATE CLIENT ACCOUNT
invitationRouter.post("/accept", async (req, res) => {
  const parsed = acceptSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message:
        "Provide a valid invitation token, name, and password of at least 12 characters.",
    });
    return;
  }

  try {
    const tokenHash = hashToken(parsed.data.token);

    // Atomically claim the invitation so it cannot be accepted twice.
    const invitation = await Invitation.findOneAndUpdate(
      {
        tokenHash,
        acceptedAt: null,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { acceptedAt: new Date() },
      },
      {
        new: true,
      },
    );

    if (!invitation) {
      res.status(400).json({
        message:
          "Invitation is invalid, expired, or already used.",
      });
      return;
    }

    const existingUser = await User.exists({
      email: invitation.email,
    });

    if (existingUser) {
      res.status(409).json({
        message: "An account already exists for this email.",
      });
      return;
    }

    await User.create({
      fullName: parsed.data.fullName,
      email: invitation.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "client",
      clientOrganizationId: invitation.clientOrganizationId,
      emailVerifiedAt: new Date(),
      status: "active",
    });

    res.status(201).json({
      message: "Invitation accepted. You can now sign in.",
    });
  } catch (error) {
    console.error("Accepting invitation failed:", error);

    res.status(500).json({
      message: "Unable to accept invitation.",
    });
  }
});
