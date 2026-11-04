
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be configured and at least 32 characters");
}

export interface AuthenticatedUser {
  id: string;
  role: "recruiter" | "client";
  clientOrganizationId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, JWT_SECRET!, {
      issuer: "talentlens-api",
      audience: "talentlens-web",
    }) as JwtPayload;

    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "recruiter" && payload.role !== "client")
    ) {
      res.status(401).json({ message: "Invalid access token" });
      return;
    }

    const organizationId = payload.clientOrganizationId;

    if (
      organizationId !== null &&
      organizationId !== undefined &&
      typeof organizationId !== "string"
    ) {
      res.status(401).json({ message: "Invalid access token" });
      return;
    }

    if (payload.role === "client" && !organizationId) {
      res.status(401).json({ message: "Invalid client account" });
      return;
    }

    req.authUser = {
      id: payload.sub,
      role: payload.role,
      clientOrganizationId:
        typeof organizationId === "string" ? organizationId : null,
    };

    next();
  } catch (error) {
  console.warn("[AUTH ERROR]", {
    time: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    reason: error instanceof Error ? error.message : "Unknown authentication error",
  });

  res.status(401).json({
    message: "Invalid or expired access token",
  });
}
}

export function requireRecruiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.authUser?.role !== "recruiter") {
    res.status(403).json({ message: "Recruiter access required" });
    return;
  }

  next();
}


export function requireClient(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.authUser?.role !== "client") {
    res.status(403).json({
      error: "FORBIDDEN",
      message: "Client access required",
    });
    return;
  }

  if (!req.authUser.clientOrganizationId) {
    res.status(403).json({
      error: "CLIENT_ORGANIZATION_REQUIRED",
      message: "Your account is not assigned to a client organization",
    });
    return;
  }

  next();
}

