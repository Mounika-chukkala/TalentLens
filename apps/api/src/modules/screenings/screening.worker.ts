
import { randomUUID } from "node:crypto";

import { Candidate } from "../candidates/candidate.model.js";
import { Requisition } from "../requisitions/requisition.model.js";
import { ScreeningJob } from "./screening-job.model.js";
import { Screening } from "./screening.model.js";

import {
  evaluateResume,
  screeningModelName,
  ScreeningServiceError,
} from "./screening.service.js";
const CONCURRENCY = 1;
const POLL_INTERVAL_MS = 1500;
const LOCK_TIMEOUT_MS = 2 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const RECOVERY_INTERVAL_MS = 30 * 1000;
const MAX_ATTEMPTS = 3;

const instanceId = randomUUID();

const activeSlots = new Set<number>();

let workerStarted = false;
let recovering = false;
let lastRecoveryAt = 0;

function getAttemptLimit(maxAttempts: number): number {
  return Math.min(maxAttempts || MAX_ATTEMPTS, MAX_ATTEMPTS);
}

function getRetryTime(attempt: number): Date {
  const baseDelayMs =
    15_000 * 2 ** Math.max(0, attempt - 1);

  const jitterMs = Math.floor(Math.random() * 5_000);

  return new Date(Date.now() + baseDelayMs + jitterMs);
}

async function refreshJobStatus(jobId: unknown): Promise<void> {
  const job = await ScreeningJob.findById(jobId);

  if (!job || !job.uploadComplete) return;

  const counts = job.counts;

  const queued = counts?.queued ?? 0;
  const processing = counts?.processing ?? 0;
  const completed = counts?.completed ?? 0;
  const failed = counts?.failed ?? 0;

  if (queued > 0 || processing > 0) {
    job.status = processing > 0 ? "processing" : "queued";
    job.completedAt = null;
  } else {
    job.status =
      completed > 0 && failed > 0
        ? "partially_failed"
        : completed > 0
          ? "completed"
          : "failed";

    job.completedAt = new Date();
  }

  await job.save();
}

async function recoverStaleScreenings(): Promise<void> {
  if (recovering) return;

  recovering = true;

  try {
    const staleBefore = new Date(
      Date.now() - LOCK_TIMEOUT_MS,
    );

    const staleScreenings = await Screening.find({
      status: "processing",
      lockedAt: { $lt: staleBefore },
    })
      .select(
        "_id screeningJobId lockedAt attempts maxAttempts",
      )
      .lean();

    for (const screening of staleScreenings) {
      const attemptLimit = getAttemptLimit(
        screening.maxAttempts,
      );

      const canRetry = screening.attempts < attemptLimit;

      // Only recover if the lock still belongs to this stale attempt.
      const recovered = await Screening.findOneAndUpdate(
        {
          _id: screening._id,
          status: "processing",
          lockedAt: screening.lockedAt,
        },
        {
          $set: {
            status: canRetry ? "queued" : "failed",
            lockedAt: null,
            lockedBy: null,
            nextRunAt: canRetry
              ? getRetryTime(screening.attempts)
              : screening.nextRunAt,
            lastError: canRetry
              ? "Recovered after an expired worker lock."
              : "Maximum attempts exhausted after an expired worker lock.",
          },
        },
        {
          returnDocument: "after",
        },
      );

      if (!recovered) continue;

      await ScreeningJob.updateOne(
        { _id: screening.screeningJobId },
        {
          $inc: canRetry
            ? {
                "counts.processing": -1,
                "counts.queued": 1,
              }
            : {
                "counts.processing": -1,
                "counts.failed": 1,
              },
        },
      );

      await refreshJobStatus(screening.screeningJobId);

      console.log(
        `Stale screening ${screening._id} ${
          canRetry ? "requeued" : "marked failed"
        }.`,
      );
    }
  } catch (error) {
    console.error(
      "Stale screening recovery failed:",
      error,
    );
  } finally {
    recovering = false;
  }
}

async function claimNextScreening(workerId: string) {
  const now = new Date();

  // Only batches explicitly started by the recruiter are eligible.
  const activeJobs = await ScreeningJob.find({
    uploadComplete: true,
    startedAt: { $ne: null },
    status: { $in: ["queued", "processing"] },
  })
    .select("_id")
    .lean();

  if (activeJobs.length === 0) return null;

  const jobIds = activeJobs.map((job) => job._id);

  const screening = await Screening.findOneAndUpdate(
    {
      screeningJobId: { $in: jobIds },
      status: "queued",
      nextRunAt: { $lte: now },

      // Never claim a screening that exhausted its attempts.
      attempts: { $lt: MAX_ATTEMPTS },

      $expr: {
        $lt: ["$attempts", "$maxAttempts"],
      },
    },
    {
      $set: {
        status: "processing",
        lockedAt: now,
        lockedBy: workerId,
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      returnDocument: "after",
      sort: {
        nextRunAt: 1,
        createdAt: 1,
      },
    },
  );

  if (screening) {
    await ScreeningJob.updateOne(
      { _id: screening.screeningJobId },
      {
        $inc: {
          "counts.queued": -1,
          "counts.processing": 1,
        },
      },
    );

    await refreshJobStatus(screening.screeningJobId);
  }

  return screening;
}

async function processScreening(
  screening: NonNullable<
    Awaited<ReturnType<typeof claimNextScreening>>
  >,
  workerId: string,
): Promise<void> {
  const screeningId = screening._id;
  const jobId = screening.screeningJobId;

  // Renew the lease while this worker is processing the resume.
  const heartbeat = setInterval(() => {
    void Screening.updateOne(
      {
        _id: screeningId,
        status: "processing",
        lockedBy: workerId,
      },
      {
        $set: {
          lockedAt: new Date(),
        },
      },
    ).catch((error) => {
      console.error(
        `Heartbeat failed for screening ${screeningId}:`,
        error,
      );
    });
  }, HEARTBEAT_INTERVAL_MS);

  heartbeat.unref();

  try {
    const [candidate, requisition] = await Promise.all([
      Candidate.findById(screening.candidateId)
        .select("+extractedText")
        .lean(),

      Requisition.findById(screening.requisitionId).lean(),
    ]);

    if (!candidate) {
      throw new Error("Candidate record not found.");
    }

    if (!requisition) {
      throw new Error("Requisition record not found.");
    }

    if (!candidate.extractedText?.trim()) {
      throw new Error("Candidate resume text is unavailable.");
    }

    if (candidate.extractedText.length > 60_000) {
      throw new Error(
        "Resume text exceeds the screening limit.",
      );
    }

    const result = await evaluateResume({
      resumeText: candidate.extractedText,
      jobTitle: requisition.title,
      jobDescription: requisition.description,
      minExperience: requisition.minExperience,
      maxExperience: requisition.maxExperience,
      noticePeriodDays: requisition.noticePeriodDays,
    });

    const updated = await Screening.findOneAndUpdate(
      {
        _id: screeningId,
        status: "processing",
        lockedBy: workerId,
      },
      {
        $set: {
          ...result,
          status: "completed",
          model: screeningModelName,
          evaluatedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
      },
      {
        returnDocument: "after",
      },
    );

    // Do not let an expired worker overwrite a newer attempt.
    if (!updated) return;

    await ScreeningJob.updateOne(
      { _id: jobId },
      {
        $inc: {
          "counts.processing": -1,
          "counts.completed": 1,
        },
      },
    );

    console.log(
      `Screening completed: ${screeningId}`,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : "Unknown screening error.";

    const attemptLimit = getAttemptLimit(
      screening.maxAttempts,
    );

   const isRetryable =
  !(error instanceof ScreeningServiceError) ||
  error.retryable;

const shouldRetry =
  isRetryable &&
  screening.attempts < attemptLimit;

    const updated = await Screening.findOneAndUpdate(
      {
        _id: screeningId,
        status: "processing",
        lockedBy: workerId,
      },
      {
        $set: {
          status: shouldRetry ? "queued" : "failed",
          nextRunAt: shouldRetry
            ? getRetryTime(screening.attempts)
            : screening.nextRunAt,
          lockedAt: null,
          lockedBy: null,
          lastError: message,
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!updated) return;

    await ScreeningJob.updateOne(
      { _id: jobId },
      {
        $inc: shouldRetry
          ? {
              "counts.processing": -1,
              "counts.queued": 1,
            }
          : {
              "counts.processing": -1,
              "counts.failed": 1,
            },
      },
    );

    console.error(
      `Screening ${shouldRetry ? "will retry" : "failed"}: ${screeningId}`,
      message,
    );
  } finally {
    clearInterval(heartbeat);
  }

  await refreshJobStatus(jobId);
}

async function runWorkerSlot(slot: number): Promise<void> {
  if (activeSlots.has(slot)) return;

  activeSlots.add(slot);

  const workerId = `${instanceId}:${slot}`;

  try {
    const screening = await claimNextScreening(workerId);

    if (screening) {
      await processScreening(screening, workerId);
    }
  } catch (error) {
    console.error(
      `Screening worker ${slot} error:`,
      error,
    );
  } finally {
    activeSlots.delete(slot);
  }
}

export function startScreeningWorker(): void {
  if (workerStarted) return;

  workerStarted = true;

  console.log(
    `Screening worker started with concurrency ${CONCURRENCY}.`,
  );

  setInterval(() => {
    if (
      Date.now() - lastRecoveryAt >= RECOVERY_INTERVAL_MS
    ) {
      lastRecoveryAt = Date.now();
      void recoverStaleScreenings();
    }

    for (let slot = 0; slot < CONCURRENCY; slot++) {
      void runWorkerSlot(slot);
    }
  }, POLL_INTERVAL_MS);
}
