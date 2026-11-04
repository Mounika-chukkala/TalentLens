
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../modules/auth/user.model.js";
import { ClientOrganization } from "../modules/auth/client-organization.model.js";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled in production.");
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required.");
  }

  const recruiterEmail = process.env.DEMO_RECRUITER_EMAIL?.trim().toLowerCase();
  const recruiterPassword = process.env.DEMO_RECRUITER_PASSWORD;
  const clientEmail = process.env.DEMO_CLIENT_EMAIL?.trim().toLowerCase();
  const clientPassword = process.env.DEMO_CLIENT_PASSWORD;

  if (!recruiterEmail || !recruiterPassword || !clientEmail || !clientPassword) {
    throw new Error(
      "Set DEMO_RECRUITER_EMAIL, DEMO_RECRUITER_PASSWORD, " +
      "DEMO_CLIENT_EMAIL and DEMO_CLIENT_PASSWORD in apps/api/.env.",
    );
  }

  if (
    recruiterPassword.length < 12 ||
    recruiterPassword.length > 128 ||
    clientPassword.length < 12 ||
    clientPassword.length > 128
  ) {
    throw new Error("Demo passwords must be 12–128 characters.");
  }

  if (recruiterEmail === clientEmail) {
    throw new Error("Recruiter and client emails must be different.");
  }

  await mongoose.connect(mongoUri);

  try {
    let organization = await ClientOrganization.findOne({
      name: "Demo Employer",
    });

    if (!organization) {
      organization = await ClientOrganization.create({
        name: "Demo Employer",
        status: "active",
      });
    }

    const accounts = [
      {
        email: recruiterEmail,
        password: recruiterPassword,
        fullName: "Demo Recruiter",
        role: "recruiter" as const,
        clientOrganizationId: null,
      },
      {
        email: clientEmail,
        password: clientPassword,
        fullName: "Demo Hiring Manager",
        role: "client" as const,
        clientOrganizationId: organization._id,
      },
    ];

    for (const account of accounts) {
      const existing = await User.findOne({ email: account.email });

      if (existing) {
        if (
          existing.role !== account.role ||
          (account.role === "client" &&
            existing.clientOrganizationId?.toString() !==
              organization._id.toString())
        ) {
          throw new Error(
            `Existing account ${account.email} has a conflicting role or organization. No changes made to that account.`,
          );
        }

        console.log(`Already exists; left unchanged: ${account.email}`);
        continue;
      }

      const passwordHash = await bcrypt.hash(account.password, 12);

      await User.create({
        fullName: account.fullName,
        email: account.email,
        passwordHash,
        role: account.role,
        clientOrganizationId: account.clientOrganizationId,
        emailVerifiedAt: new Date(),
        status: "active",
      });

      console.log(`Created ${account.role} demo account: ${account.email}`);
    }

    console.log("Demo seeding completed.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Demo seeding failed:", error);
  process.exitCode = 1;
});
