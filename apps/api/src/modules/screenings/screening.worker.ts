
import { randomUUID } from "node:crypto";
import { Scorecard } from "./scorecard.model.js";
import { ResumeSubmission } from "./resume-submission.model.js";
import { Requisition } from "../requisitions/requisition.model.js";
import { ScreeningJob } from "./screening-job.model.js";
import { Screening } from "./screening.model.js";
import mongoose from "mongoose";
import {
  evaluateResume,
  screeningModelName,
  ScreeningServiceError,
} from "./screening.service.js";
import { cleanupCancelledScreeningJob } from "./screening-cleanup.service.js";
const CONCURRENCY = 1;
const POLL_INTERVAL_MS = 1500;
const LOCK_TIMEOUT_MS = 2 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const RECOVERY_INTERVAL_MS = 30 * 1000;
const MAX_ATTEMPTS = 3;
const CLEANUP_RECOVERY_INTERVAL_MS = 30 * 1000;
const CLEANUP_RECOVERY_BATCH_SIZE = 20;

const instanceId = randomUUID();

const activeSlots = new Set<number>();

let workerStarted = false;
let recovering = false;
let lastRecoveryAt = 0;
let recoveringCleanups = false;
let lastCleanupRecoveryAt = 0;



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

if (
  !job ||
  !job.uploadComplete ||
  job.cancelRequested ||
  ["cancelling", "interrupted", "cancelled"].includes(job.status)
) {
  return;
}
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
async function markScreeningCancelled(
  screeningId: unknown,
  jobId: unknown,
  workerId: string,
  reason = "Screening cancelled before evaluation could be committed.",
): Promise<void> {
  const updated = await Screening.findOneAndUpdate(
    {
      _id: screeningId,
      status: "processing",
      lockedBy: workerId,
    },
    {
      $set: {
        status: "cancelled",
        lockedAt: null,
        lockedBy: null,
        lastError: reason,
      },
    },
    { returnDocument: "after" },
  );

  // Only decrement processing if this worker actually changed the record.
  if (!updated) return;

  await ScreeningJob.updateOne(
    { _id: jobId },
    {
      $inc: {
        "counts.processing": -1,
        "counts.cancelled": 1,
      },
    },
  );
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
      const parentJob = await ScreeningJob.findById(
  screening.screeningJobId,
)
  .select("status cancelRequested")
  .lean();

if (
  !parentJob ||
  parentJob.cancelRequested ||
  ["cancelling", "interrupted", "cancelled"].includes(
    parentJob.status,
  )
) {
  const cancelled = await Screening.findOneAndUpdate(
    {
      _id: screening._id,
      status: "processing",
      lockedAt: screening.lockedAt,
    },
    {
      $set: {
        status: "cancelled",
        lockedAt: null,
        lockedBy: null,
        lastError: "Cancelled during stale worker recovery.",
      },
    },
  );

  if (cancelled) {
    await ScreeningJob.updateOne(
      { _id: screening.screeningJobId },
      {
        $inc: {
          "counts.processing": -1,
          "counts.cancelled": 1,
        },
      },
    );
  }

  continue;
}
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


async function recoverPendingCleanups(): Promise<void> {
  if (recoveringCleanups) return;

  recoveringCleanups = true;

  try {
    const pendingJobs = await ScreeningJob.find({
      cancelRequested: true,
      status: {
        $in: ["cancelling", "interrupted", "cancelled"],
      },
      cleanupStatus: {
        $in: ["pending", "failed"],
      },
    })
      .select("_id")
      .sort({ updatedAt: 1 })
      .limit(CLEANUP_RECOVERY_BATCH_SIZE)
      .lean();

    for (const job of pendingJobs) {
      try {
        await cleanupCancelledScreeningJob(
          String(job._id),
        );
      } catch (error) {
        console.error(
          `Cleanup recovery failed for screening batch ${job._id}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error(
      "Pending screening cleanup recovery failed:",
      error,
    );
  } finally {
    recoveringCleanups = false;
  }
}


async function claimNextScreening(workerId: string) {
  const now = new Date();

  // Only batches explicitly started by the recruiter are eligible.
 const activeJobs = await ScreeningJob.find({
  uploadComplete: true,
  startedAt: { $ne: null },
  cancelRequested: { $ne: true },
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
  const [submission, requisition, scorecard] = await Promise.all([
  ResumeSubmission.findById(screening.resumeSubmissionId)
    .select("+extractedText")
    .lean(),
  Requisition.findById(screening.requisitionId).lean(),
  Scorecard.findOne({
    requisitionId: screening.requisitionId,
  }).lean(),
]);

    if (!submission) {
  throw new Error("Resume submission not found.");
}

    if (!requisition) {
      throw new Error("Requisition record not found.");
    }
    if (!scorecard || !scorecard.criteria?.length) {
  throw new Error(
    "A valid evaluation scorecard was not found for this requisition.",
  );
}

    if (!submission.extractedText?.trim()) {
      throw new Error("Resume text is unavailable.");
    }

    if (submission.extractedText.length > 60_000) {
      throw new Error(
        "Resume text exceeds the screening limit.",
      );
    }

    const batchBeforeEvaluation = await ScreeningJob.findOne({
  _id: jobId,
  status: "processing",
  cancelRequested: { $ne: true },
})
  .select("_id")
  .lean();

if (!batchBeforeEvaluation) {
  await markScreeningCancelled(
    screeningId,
    jobId,
    workerId,
    "Screening cancelled before evaluation.",
  );

  return;
}
  const result = await evaluateResume({
  resumeText: submission.extractedText,
  jobTitle: requisition.title,
  jobDescription: requisition.description,
  minExperience: requisition.minExperience,
  maxExperience: requisition.maxExperience,
  noticePeriodDays: requisition.noticePeriodDays,
  scorecardCriteria: scorecard.criteria,
});

 const session = await mongoose.startSession();

try {
  await session.withTransaction(async () => {
    // Update batch counters only if the batch is still active.
    const batchUpdate = await ScreeningJob.updateOne(
      {
        _id: jobId,
        status: "processing",
        cancelRequested: { $ne: true },
      },
      {
        $inc: {
          "counts.processing": -1,
          "counts.completed": 1,
        },
      },
      { session },
    );

    if (batchUpdate.modifiedCount !== 1) {
      throw new Error("SCREENING_BATCH_CANCELLED");
    }

    // Commit the evaluation only if this worker still owns the lease.
    const screeningUpdate = await Screening.updateOne(
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
      { session },
    );

    if (screeningUpdate.modifiedCount !== 1) {
      throw new Error("SCREENING_WORKER_LEASE_LOST");
    }
  });
} finally {
  await session.endSession();
}

console.log(`Screening completed: ${screeningId}`);

  } catch (error) {
  const message =
    error instanceof Error
      ? error.message.slice(0, 1000)
      : "Unknown screening error.";

  const attemptLimit = getAttemptLimit(
    screening.maxAttempts,
  );

  const isCancellation =
    error instanceof Error &&
    error.message === "SCREENING_BATCH_CANCELLED";

  // A cancelled batch must not retry this resume.
 if (isCancellation) {
  await markScreeningCancelled(
    screeningId,
    jobId,
    workerId,
  );

  return;
}

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
} 
// finally {
//   await session.endSession();
// }

// if (!committed) return;

//     console.error(
//       `Screening ${shouldRetry ? "will retry" : "failed"}: ${screeningId}`,
//       message,
//     );
//   } 
  finally {
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

  // Recover pending cleanup jobs immediately on startup.
  void recoverPendingCleanups();

  setInterval(() => {
    // Recover stale screening workers.
    if (
      Date.now() - lastRecoveryAt >= RECOVERY_INTERVAL_MS
    ) {
      lastRecoveryAt = Date.now();
      void recoverStaleScreenings();
    }

    // Retry interrupted batch cleanup independently.
    if (
      Date.now() - lastCleanupRecoveryAt >=
      CLEANUP_RECOVERY_INTERVAL_MS
    ) {
      lastCleanupRecoveryAt = Date.now();
      void recoverPendingCleanups();
    }

    // Run normal screening workers.
    for (let slot = 0; slot < CONCURRENCY; slot++) {
      void runWorkerSlot(slot);
    }
  }, POLL_INTERVAL_MS);
}
