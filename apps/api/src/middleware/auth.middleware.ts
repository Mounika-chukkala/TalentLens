
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

const SESSION_COOKIE = "talentlens_session";
const SESSION_MAX_AGE = 10 * 60 * 60 * 1000;

function getCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return null;

  return decodeURIComponent(
    cookie.substring(name.length + 1),
  );
}

function renewSession(
  res: Response,
  user: AuthenticatedUser,
) {
  const token = jwt.sign(
    {
      sub: user.id,
      role: user.role,
      clientOrganizationId: user.clientOrganizationId,
    },
    JWT_SECRET!,
    {
      expiresIn: "10h",
      issuer: "talentlens-api",
      audience: "talentlens-web",
    },
  );

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = getCookie(
    req.headers.cookie,
    SESSION_COOKIE,
  );

  if (!token) {
    res.status(401).json({
      message: "Authentication required",
    });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET!, {
      issuer: "talentlens-api",
      audience: "talentlens-web",
    }) as JwtPayload;

    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "recruiter" &&
        payload.role !== "client")
    ) {
      res.status(401).json({
        message: "Invalid access token",
      });
      return;
    }

    const organizationId = payload.clientOrganizationId;

    if (
      organizationId !== null &&
      organizationId !== undefined &&
      typeof organizationId !== "string"
    ) {
      res.status(401).json({
        message: "Invalid access token",
      });
      return;
    }

    if (payload.role === "client" && !organizationId) {
      res.status(401).json({
        message: "Invalid client account",
      });
      return;
    }

    const authenticatedUser: AuthenticatedUser = {
      id: payload.sub,
      role: payload.role,
      clientOrganizationId:
        typeof organizationId === "string"
          ? organizationId
          : null,
    };

    req.authUser = authenticatedUser;

    // Extend the inactivity window after successful authentication.
    renewSession(res, authenticatedUser);

    next();
  } catch (error) {
    console.warn("[AUTH ERROR]", {
      time: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      reason:
        error instanceof Error
          ? error.message
          : "Unknown authentication error",
    });

    res.status(401).json({
      message: "Invalid or expired session",
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

