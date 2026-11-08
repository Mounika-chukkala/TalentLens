
import { Router } from "express";
import { z } from "zod";
import { User } from "./user.model.js";
import {
  authenticateUser,
  toAuthUser,
} from "./auth.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

export const authRouter = Router();
const SESSION_COOKIE = "talentlens_session";
const SESSION_MAX_AGE = 10 * 60 * 60 * 1000;

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Enter a valid email and password.",
    });
    return;
  }

  try {
    const result = await authenticateUser(
      parsed.data.email,
      parsed.data.password,
    );

    if (!result) {
      res.status(401).json({
        message: "Invalid credentials or account not eligible to sign in.",
      });
      return;
    }

    if (!result.user.emailVerified) {
      res.status(403).json({
        message: "Verify your email before signing in.",
        code: "EMAIL_NOT_VERIFIED",
      });
      return;
    }

   res.cookie(
  SESSION_COOKIE,
  result.accessToken,
  sessionCookieOptions,
);

res.status(200).json({
  message: "Login successful",
  data: {
    user: result.user,
  },
});
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ message: "Unable to sign in right now." });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.authUser!.id,
      status: "active",
    });

    if (!user || !user.emailVerifiedAt) {
      res.status(401).json({
        message: "Account is unavailable or requires email verification.",
      });
      return;
    }

    if (
      user.role === "client" &&
      !user.clientOrganizationId
    ) {
      res.status(403).json({
        message: "Client organization is not configured.",
      });
      return;
    }

    res.status(200).json({
      data: toAuthUser(user),
    });
  } catch (error) {
    console.error("Fetching current user failed:", error);
    res.status(500).json({ message: "Unable to load account." });
  }
});



authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  res.status(200).json({
    message: "Logged out successfully",
  });
});