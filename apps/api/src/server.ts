import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import "dotenv/config";
import { requisitionRouter } from "./modules/requisitions/requisition.routes.js";
import { candidateRouter } from "./modules/candidates/candidate.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { screeningRouter } from "./modules/screenings/screening.routes.js";
// dotenv.config();
import { requestLogger } from "./middleware/request-logger.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";

import {
  clientOrganizationRouter,
} from "./modules/auth/client-organization.routes.js";
import { startScreeningWorker } from "./modules/screenings/screening.worker.js";
import { candidateSubmissionRouter } from "./modules/candidates/candidate-submission.routes.js";
import { invitationRouter } from "./modules/auth/invitation.routes.js";
const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.WEB_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(requestLogger);

app.use("/api/auth", authRouter);
app.use(
  "/api/client-organizations",

  clientOrganizationRouter,
);
app.use("/api/invitations", invitationRouter);
app.use("/api/submissions", candidateSubmissionRouter);
app.use("/api/requisitions", requisitionRouter);
app.use("/api/screenings", screeningRouter);
app.use("/api/candidates", candidateRouter);
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "TalentLens AI API",
    timestamp: new Date().toISOString(),
  });
});
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    await connectDB();

startScreeningWorker();
  
    app.listen(port, () => {
      console.log(`TalentLens API running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start API:", error);
    process.exit(1);
  }
}

void startServer();