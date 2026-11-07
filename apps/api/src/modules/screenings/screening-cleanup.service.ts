
import path from "node:path";
import { unlink } from "node:fs/promises";

import { ScreeningJob } from "./screening-job.model.js";
import { Screening } from "./screening.model.js";
import { ResumeSubmission } from "./resume-submission.model.js";
import { CandidateSubmission } from "../candidates/candidate-submission.model.js";

const storageDirectory = path.resolve(
  process.cwd(),
  "storage",
  "resumes",
);

const CLEANUP_LEASE_TIMEOUT_MS = 5 * 60 * 1000;

const isValidStorageKey = (storageKey: string): boolean =>
  /^[a-f\d-]{36}\.(pdf|docx)$/i.test(storageKey);

async function deleteResumeFile(storageKey: string): Promise<void> {
  if (!isValidStorageKey(storageKey)) {
    throw new Error(`Invalid resume storage key: ${storageKey}`);
  }

  const filePath = path.resolve(storageDirectory, storageKey);

  if (path.dirname(filePath) !== storageDirectory) {
    throw new Error("Resume file path is outside the storage directory.");
  }

  try {
    await unlink(filePath);
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;

    if (fsError.code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Cleans unfinished data belonging to a cancelled screening batch.
 *
 * Completed screenings are retained.
 * Promoted or client-submitted resumes are retained.
 * Unfinished, unprotected resumes and screening records are deleted.
 *
 * Cleanup is protected by an atomic lease so multiple callers
 * cannot perform the same cleanup concurrently.
 */
export async function cleanupCancelledScreeningJob(
  jobId: string,
): Promise<void> {
  const now = new Date();
  const leaseExpiredAt = new Date(
    now.getTime() - CLEANUP_LEASE_TIMEOUT_MS,
  );

  // Atomically claim cleanup.
  const job = await ScreeningJob.findOneAndUpdate(
    {
      _id: jobId,
      cancelRequested: true,
      status: { $in: ["cancelling", "interrupted", "cancelled"] },
      cleanupStatus: { $in: ["pending", "failed"] },
      $or: [
        { cleanupStartedAt: null },
        { cleanupStartedAt: { $exists: false } },
        { cleanupStartedAt: { $lte: leaseExpiredAt } },
      ],
    },
    {
      $set: {
        cleanupStartedAt: now,
      },
    },
    { new: true },
  );

  // Another caller owns cleanup, or the batch is not eligible.
  if (!job) {
    return;
  }

  try {
    // Never clean up while an upload handler is still writing files.
    if ((job.activeUploads ?? 0) > 0) {
      await ScreeningJob.updateOne(
        { _id: job._id, cleanupStartedAt: now },
        { $set: { cleanupStartedAt: null } },
      );
      return;
    }

    // Never delete a screening while its worker may still be evaluating it.
    const activeScreening = await Screening.exists({
      screeningJobId: job._id,
      status: "processing",
    });

    if (activeScreening) {
      await ScreeningJob.updateOne(
        { _id: job._id, cleanupStartedAt: now },
        { $set: { cleanupStartedAt: null } },
      );
      return;
    }

    const screenings = await Screening.find({
      screeningJobId: job._id,
    }).lean();

    const completedSubmissionIds = new Set(
      screenings
        .filter((screening) => screening.status === "completed")
        .map((screening) => String(screening.resumeSubmissionId)),
    );

    const submissions = await ResumeSubmission.find({
      screeningJobId: job._id,
    })
      .select("_id candidateId promotedAt resume.storageKey")
      .lean();

    const submissionIds = submissions.map(
      (submission) => submission._id,
    );

    const clientReferences = submissionIds.length
      ? await CandidateSubmission.find({
          "candidates.resumeSubmissionId": {
            $in: submissionIds,
          },
        })
          .select("candidates.resumeSubmissionId")
          .lean()
      : [];

    const clientSubmittedIds = new Set(
      clientReferences.flatMap((record) =>
        record.candidates.map((candidate) =>
          String(candidate.resumeSubmissionId),
        ),
      ),
    );

    const protectedIds = new Set([
      ...completedSubmissionIds,
      ...clientSubmittedIds,
    ]);

    const deletableSubmissions = submissions.filter((submission) => {
      const id = String(submission._id);

      return (
        !protectedIds.has(id) &&
        !submission.candidateId &&
        !submission.promotedAt
      );
    });

    const deletableIds = deletableSubmissions.map(
      (submission) => submission._id,
    );

    // Count actual screening records that will be removed.
    const deletedScreeningCount = screenings.filter(
      (screening) =>
        screening.status !== "completed" &&
        deletableIds.some(
          (id) => String(id) === String(screening.resumeSubmissionId),
        ),
    ).length;

    // Delete files first. Missing files are treated as already deleted.
    for (const submission of deletableSubmissions) {
      const storageKey = submission.resume?.storageKey;

      if (!storageKey) {
        throw new Error(
          `Resume storage key missing for submission ${submission._id}`,
        );
      }

      await deleteResumeFile(storageKey);
    }

    if (deletableIds.length > 0) {
      await Screening.deleteMany({
        screeningJobId: job._id,
        resumeSubmissionId: { $in: deletableIds },
        status: { $ne: "completed" },
      });

      await ResumeSubmission.deleteMany({
        _id: { $in: deletableIds },
        candidateId: null,
        promotedAt: null,
      });
    }

    // Recalculate from the records that remain.
    const remainingScreenings = await Screening.find({
      screeningJobId: job._id,
    })
      .select("status")
      .lean();

    const completed = remainingScreenings.filter(
      (screening) => screening.status === "completed",
    ).length;

    const failed = remainingScreenings.filter(
      (screening) => screening.status === "failed",
    ).length;

    const cancelled = remainingScreenings.filter(
      (screening) => screening.status === "cancelled",
    ).length;

    const finalStatus = completed > 0 ? "interrupted" : "cancelled";

    await ScreeningJob.updateOne(
      {
        _id: job._id,
        cancelRequested: true,
        cleanupStartedAt: now,
        status: { $in: ["cancelling", "interrupted", "cancelled"] },
      },
      {
        $set: {
          status: finalStatus,
          "counts.processing": 0,
          "counts.queued": 0,
          "counts.completed": completed,
          "counts.failed": failed,
          "counts.cancelled": cancelled + deletedScreeningCount,
          cleanupStatus: "completed",
          cleanupCompletedAt: new Date(),
          cleanupStartedAt: null,
          completedAt: new Date(),
          lastError: null,
        },
      },
    );
  } catch (error) {
    await ScreeningJob.updateOne(
      {
        _id: job._id,
        cleanupStartedAt: now,
      },
      {
        $set: {
          cleanupStatus: "failed",
          cleanupStartedAt: null,
          lastError:
            error instanceof Error
              ? error.message
              : "Unknown cleanup error",
        },
      },
    );
    throw error;
  }
}
