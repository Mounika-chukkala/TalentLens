
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "./user.model.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be configured and at least 32 characters");
}

const TOKEN_EXPIRY = "10h";

export type UserRole = "recruiter" | "client";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  clientOrganizationId: string | null;
  emailVerified: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) {
    throw new Error("Password must be between 12 and 128 characters");
  }

  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      clientOrganizationId: user.clientOrganizationId,
    },
    JWT_SECRET!,
    {
      expiresIn: TOKEN_EXPIRY,
      issuer: "talentlens-api",
      audience: "talentlens-web",
    },
  );
}

export function toAuthUser(user: {
  _id: { toString(): string };
  fullName: string;
  email: string;
  role: UserRole;
  clientOrganizationId?: { toString(): string } | null;
  emailVerifiedAt?: Date | null;
}): AuthUser {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    clientOrganizationId: user.clientOrganizationId?.toString() ?? null,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ user: AuthUser; accessToken: string } | null> {
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
    status: "active",
  }).select("+passwordHash");

  if (!user) return null;

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) return null;

  if (!user.emailVerifiedAt) return null;
  if (user.role === "client" && !user.clientOrganizationId) {
    return null;
  }

  const authUser = toAuthUser(user);

  return {
    user: authUser,
    accessToken: createAccessToken(authUser),
  };
}
