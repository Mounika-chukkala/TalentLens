
import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAuth, requireRecruiter } from "../../middleware/auth.middleware.js";
import { Invitation } from "./invitation.model.js";
import { ClientOrganization } from "./client-organization.model.js";
import { User } from "./user.model.js";
import { hashPassword } from "./auth.service.js";

export const invitationRouter = Router();

const createSchema = z.object({
  email: z.string().trim().email().max(254),
  clientOrganizationName: z.string().trim().min(2).max(160),
});

const acceptSchema = z.object({
  token: z.string().min(32).max(256),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
});

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

invitationRouter.post(
  "/",
  requireAuth,
  requireRecruiter,
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: "Enter a valid email and organization." });
      return;
    }

    try {
      const email = parsed.data.email.toLowerCase();

      if (await User.exists({ email })) {
        res.status(409).json({ message: "An account already exists for this email." });
        return;
      }

      let organization = await ClientOrganization.findOne({
        name: parsed.data.clientOrganizationName,
        status: "active",
      });

      if (!organization) {
        organization = await ClientOrganization.create({
          name: parsed.data.clientOrganizationName,
          status: "active",
        });
      }

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);

      // Invalidate previous unused invitations for this email and organization.
      await Invitation.deleteMany({
        email,
        clientOrganizationId: organization._id,
        acceptedAt: null,
      });

      await Invitation.create({
        email,
        clientOrganizationId: organization._id,
        invitedBy: req.authUser!.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const frontendUrl = process.env.FRONTEND_URL;
      if (!frontendUrl) {
        res.status(500).json({ message: "FRONTEND_URL is not configured." });
        return;
      }

      const invitationUrl =
        `${frontendUrl.replace(/\/$/, "")}/accept-invitation?token=${rawToken}`;

      if (process.env.NODE_ENV === "production") {
        // Do not create a false impression that an email was sent.
        // SMTP delivery will be added in the email integration step.
        await Invitation.deleteOne({ tokenHash });
        res.status(503).json({
          message: "Invitation email delivery is not configured.",
        });
        return;
      }

      res.status(201).json({
        message: "Invitation created. Use this link to test acceptance locally.",
        data: {
          email,
          organization: organization.name,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          invitationUrl,
        },
      });
    } catch (error) {
      console.error("Creating invitation failed:", error);
      res.status(500).json({ message: "Unable to create invitation." });
    }
  },
);

invitationRouter.post("/accept", async (req, res) => {
  const parsed = acceptSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Provide a valid invitation token, name, and password of at least 12 characters.",
    });
    return;
  }

  try {
    const tokenHash = hashToken(parsed.data.token);

    // Atomic claim prevents two requests accepting the same invitation.
    const invitation = await Invitation.findOneAndUpdate(
      {
        tokenHash,
        acceptedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { acceptedAt: new Date() } },
      { new: true },
    );

    if (!invitation) {
      res.status(400).json({
        message: "Invitation is invalid, expired, or already used.",
      });
      return;
    }

    const existingUser = await User.exists({ email: invitation.email });

    if (existingUser) {
      await Invitation.updateOne(
        { _id: invitation._id },
        { $set: { acceptedAt: null } },
      );

      res.status(409).json({ message: "An account already exists for this email." });
      return;
    }

    try {
      await User.create({
        fullName: parsed.data.fullName,
        email: invitation.email,
        passwordHash: await hashPassword(parsed.data.password),
        role: "client",
        clientOrganizationId: invitation.clientOrganizationId,
        emailVerifiedAt: new Date(),
        status: "active",
      });
    } catch (error) {
      await Invitation.updateOne(
        { _id: invitation._id },
        { $set: { acceptedAt: null } },
      );
      throw error;
    }

    res.status(201).json({
      message: "Invitation accepted. You can now sign in.",
    });
  } catch (error) {
    console.error("Accepting invitation failed:", error);
    res.status(500).json({ message: "Unable to accept invitation." });
  }
});
