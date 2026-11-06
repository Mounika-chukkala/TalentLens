
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";

import {
  getScreeningJob,
  getScreeningResults,
  getScreeningResumeBlob,
  getRequisitionRankedCandidates,
  submitCandidatesToClient,
} from "../../lib/api";
function getPayload(response) {
  return response?.data ?? response;
}

function formatRecommendation(value) {
  return {
    strong_match: "Strong match",
    potential_match: "Potential match",
    low_match: "Low match",
  }[value] || "Not evaluated";
}

function ScoreBadge({ score }) {
  const color =
    score >= 80
      ? "bg-green-50 text-green-700"
      : score >= 60
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";

  return (
    <div className={`rounded-xl px-4 py-2 text-center ${color}`}>
      <p className="text-2xl font-bold">{Math.round(score)}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide">
        Score
      </p>
    </div>
  );
}

function CandidateCard({   screening,
  rank,
  selectable = false,
  selected = false,
  onSelect, }) {
  const [expanded, setExpanded] = useState(false);
  const [openingResume, setOpeningResume] = useState(false);
const [resumeError, setResumeError] = useState("");

async function handleViewResume() {
  if (!submission._id || openingResume) return;

  // Open synchronously to avoid browser popup blocking.
  const previewWindow = window.open("about:blank", "_blank");

  if (!previewWindow) {
    setResumeError("Allow pop-ups to view the resume.");
    return;
  }

  setOpeningResume(true);
  setResumeError("");

  try {
    const blob = await getScreeningResumeBlob(submission._id);
    const url = URL.createObjectURL(blob);

    previewWindow.location.href = url;

    // Release the temporary URL after the browser has loaded it.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    previewWindow.close();
    setResumeError(error.message || "Unable to open resume.");
  } finally {
    setOpeningResume(false);
  }
}
const submission = screening.resumeSubmissionId || {};  const score = screening.overallScore ?? 0;

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {selectable && (
  <input
    type="checkbox"
    checked={selected}
    onChange={(event) => onSelect(screening._id, event.target.checked)}
    aria-label={`Select ${submission.fullName || "candidate"}`}
    className="h-4 w-4 shrink-0 accent-[#263d2b]"
  />
)}
        
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f2eb] font-bold text-[#263d2b]">
          {rank === 1 ? <Trophy size={19} /> : `#${rank}`}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-[#17251b]">
            {submission.fullName || "Candidate"}
          </h3>
          <p className="mt-1 truncate text-xs text-stone-500">
            {submission.resume?.originalName || "Resume"}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
              {formatRecommendation(screening.recommendation)}
            </span>
            {submission.identityStatus &&
  submission.identityStatus !== "unverified" && (
    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
      {submission.identityStatus.replaceAll("_", " ")}
    </span>
  )}
            <span className="text-xs text-stone-400">
              {screening.criteria?.length || 0} evaluation criteria
            </span>
          </div>
        </div>

        <ScoreBadge score={score} />

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
        >
          {expanded ? "Hide details" : "View details"}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-5 space-y-5 border-t border-stone-100 pt-5">
       <div className="flex flex-wrap items-center gap-3">
  <button
    onClick={handleViewResume}
    disabled={openingResume || !submission._id}
    className="rounded-lg bg-[#263d2b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3d5a40] disabled:cursor-not-allowed disabled:opacity-50"
  >
    {openingResume ? "Opening resume..." : "View original resume"}
  </button>

  {resumeError && (
    <p className="text-sm text-red-600">{resumeError}</p>
  )}
</div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-stone-800">
              AI assessment
            </h4>
            <p className="text-sm leading-6 text-stone-600">
              {screening.summary || "No summary available."}
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-stone-800">
              Evaluation criteria
            </h4>

            <div className="space-y-3">
              {(screening.criteria || []).map((criterion, index) => (
                <div
                  key={`${criterion.name}-${index}`}
                  className="rounded-xl bg-[#fafbf8] p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-800">
                      {criterion.name}
                    </p>
                    <span className="text-sm font-bold text-[#263d2b]">
                      {criterion.score}/100
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-stone-500">
                    Weight: {Number(criterion.weight).toFixed(2)}%
                  </p>

                  <p className="mt-2 text-sm text-stone-600">
                    {criterion.explanation}
                  </p>

                  {criterion.evidence?.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-semibold text-stone-700">
                        Resume evidence
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-stone-600">
                        {criterion.evidence.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Strengths",
                items: screening.strengths,
                color: "text-green-700",
              },
              {
                title: "Concerns",
                items: screening.concerns,
                color: "text-amber-700",
              },
              {
                title: "Missing requirements",
                items: screening.missingRequirements,
                color: "text-red-700",
              },
            ].map((section) => (
              <div key={section.title}>
                <h4 className={`mb-2 text-sm font-semibold ${section.color}`}>
                  {section.title}
                </h4>
                {section.items?.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-stone-600">
                    {section.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-stone-400">None reported.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function ScreeningResults({ jobId }) {
  const [job, setJob] = useState(null);
  const [results, setResults] = useState([]);
  const [cumulativeResults, setCumulativeResults] = useState([]);
const [cumulativePagination, setCumulativePagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState([]);
const [submissionRound, setSubmissionRound] = useState(1);
const [submissionTitle, setSubmissionTitle] = useState("");
const [submitting, setSubmitting] = useState(false);
const [submissionMessage, setSubmissionMessage] = useState("");
const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    let stopped = false;
    let timer;

    async function refresh() {
      try {
      const [jobResponse, resultsResponse] = await Promise.all([
  getScreeningJob(jobId),
  getScreeningResults(jobId, { page: 1, limit: 100 }),
]);

if (stopped) return;

const jobData = getPayload(jobResponse);
const resultsData = getPayload(resultsResponse);

setJob(jobData);
setResults(resultsData.results || []);
setError("");

// Fetch rankings across every screening batch in this requisition.
const requisitionId =
  jobData.requisitionId?._id || jobData.requisitionId;

if (requisitionId) {
  try {
    const rankingResponse = await getRequisitionRankedCandidates(
      requisitionId,
      { page: 1, limit: 50 },
    );

    if (stopped) return;

    const rankingData = getPayload(rankingResponse);

    setCumulativeResults(rankingData.results || []);
    setCumulativePagination(rankingData.pagination || null);
  } catch (rankingError) {
    console.error(
      "Unable to load requisition-wide rankings:",
      rankingError,
    );
  }
}

        const progress = jobData.progress || {};
        const isActive =
          (progress.queued || 0) > 0 ||
          (progress.processing || 0) > 0 ||
          ["queued", "processing"].includes(jobData.status);

        if (isActive) {
          timer = setTimeout(refresh, 3000);
        }
      } catch (err) {
        if (!stopped) {
          setError(err.message || "Unable to load screening results.");
          timer = setTimeout(refresh, 5000);
        }
      } finally {
        if (!stopped) setLoading(false);
      }
    }

    refresh();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  const completed = results.filter((item) => item.status === "completed");
  const failed = results.filter((item) => item.status === "failed");
  const queued = results.filter((item) => item.status === "queued");
  const processing = results.filter((item) => item.status === "processing");

  const ranked = [...completed]
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
    .slice(0, job?.topN || 100);

  const progress = job?.progress || {};
  const percentage = progress.percentage || 0;
function handleCandidateSelect(screeningId, checked) {
  setSelectedCandidates((previous) =>
    checked
      ? [...new Set([...previous, screeningId])]
      : previous.filter((id) => id !== screeningId)
  );
}

function handleSelectAll() {
  const ids = cumulativeResults.map((item) => item._id);
  setSelectedCandidates(ids);
}

function handleClearSelection() {
  setSelectedCandidates([]);
}

async function handleSubmitToClient() {
  if (selectedCandidates.length === 0 || submitting) return;

  if (!Number.isInteger(Number(submissionRound)) || Number(submissionRound) < 1) {
    setSubmissionError("Enter a valid submission round.");
    return;
  }

  const selected = cumulativeResults.filter((item) =>
    selectedCandidates.includes(item._id)
  );

  const candidates = selected.map((screening) => {
    const resume = screening.resumeSubmissionId || {};

    return {
      screeningId: screening._id,
      resumeSubmissionId:
        typeof screening.resumeSubmissionId === "object"
          ? screening.resumeSubmissionId._id
          : screening.resumeSubmissionId,
      candidateId: screening.candidateId?._id || screening.candidateId || null,
      rank: screening.rank,
      overallScore: screening.overallScore,
      candidateSnapshot: {
        fullName: resume.fullName || "Candidate",
        email: resume.email || null,
        skills: Array.isArray(resume.skills) ? resume.skills : [],
        totalExperience: resume.totalExperience ?? null,
        resumeFileName: resume.resume?.originalName || null,
      },
    };
  });

  if (candidates.some((candidate) => !candidate.resumeSubmissionId)) {
    setSubmissionError(
      "One or more selected candidates are missing resume submission details."
    );
    return;
  }

  setSubmitting(true);
  setSubmissionError("");
  setSubmissionMessage("");

  try {
    const requisitionId =
      job?.requisitionId?._id || job?.requisitionId;

    await submitCandidatesToClient({
      requisitionId,
      round: Number(submissionRound),
      title: submissionTitle.trim() || undefined,
candidates: selected.map((screening) => ({
  screeningId: screening._id,
}))    });

    setSubmissionMessage(
      `${candidates.length} candidate(s) submitted successfully.`
    );
    setSelectedCandidates([]);
    setSubmissionTitle("");
  } catch (error) {
    setSubmissionError(error.message || "Unable to submit candidates.");
  } finally {
    setSubmitting(false);
  }
}
  if (loading && !job) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-white p-12 text-sm text-stone-500">
        <LoaderCircle className="animate-spin" size={20} />
        Loading screening results...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#17251b]">
              Screening progress
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {job?.status === "completed"
                ? "All eligible resumes have been evaluated."
                : job?.status === "partially_failed"
                  ? "Evaluation finished with some failed resumes."
                  : job?.status === "failed"
                    ? "Screening finished without successful evaluations."
                    : "TalentLens is evaluating candidate resumes."}
            </p>
          </div>

          <span className="rounded-full bg-[#f0f2eb] px-3 py-1.5 text-xs font-semibold capitalize text-[#263d2b]">
            {job?.status?.replaceAll("_", " ") || "Loading"}
          </span>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-[#527348] transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <p className="mt-2 text-right text-xs text-stone-500">
          {percentage}% processed
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Completed", value: progress.completed || 0 },
            { label: "Processing", value: progress.processing || 0 },
            { label: "Queued", value: progress.queued || 0 },
            { label: "Failed", value: progress.failed || 0 },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-[#fafbf8] p-4">
              <p className="text-xs text-stone-500">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-[#263d2b]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>
{cumulativeResults.length > 0 && (
  <section className="space-y-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Trophy className="text-[#71865b]" size={22} />
        <div>
          <h2 className="text-lg font-bold text-[#17251b]">
            Requisition-wide leaderboard
          </h2>
          <p className="text-xs text-stone-500">
            Candidates ranked across all screening batches for this role.
            Duplicate candidate uploads are excluded.
          </p>
        </div>
      </div>

      <span className="rounded-full bg-[#f0f2eb] px-3 py-1.5 text-xs font-semibold text-[#263d2b]">
        Top {cumulativeResults.length}
        {cumulativePagination?.totalResults
          ? ` of ${cumulativePagination.totalResults}`
          : ""}
      </span>
    </div>
<div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="font-semibold text-[#17251b]">
        Submit candidates to client
      </h3>
      <p className="text-xs text-stone-500">
        Select candidates from this requisition-wide ranking.
      </p>
    </div>

    <span className="rounded-full bg-[#f0f2eb] px-3 py-1.5 text-xs font-semibold text-[#263d2b]">
      {selectedCandidates.length} selected
    </span>
  </div>

  <div className="flex flex-wrap gap-2">
    <button
      type="button"
      onClick={handleSelectAll}
      className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
    >
      Select all
    </button>

    <button
      type="button"
      onClick={handleClearSelection}
      className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
    >
      Clear selection
    </button>
  </div>

  <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-xs font-medium text-stone-600">
      Submission round
      <input
        type="number"
        min="1"
        value={submissionRound}
        onChange={(event) => setSubmissionRound(event.target.value)}
        className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
      />
    </label>

    <label className="text-xs font-medium text-stone-600">
      Round title (optional)
      <input
        type="text"
        value={submissionTitle}
        onChange={(event) => setSubmissionTitle(event.target.value)}
        placeholder="e.g. Senior React Developers"
        maxLength={120}
        className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
      />
    </label>
  </div>

  {submissionError && (
    <p className="text-sm text-red-600">{submissionError}</p>
  )}

  {submissionMessage && (
    <p className="text-sm text-green-700">{submissionMessage}</p>
  )}

  <button
    type="button"
    onClick={handleSubmitToClient}
    disabled={submitting || selectedCandidates.length === 0}
    className="rounded-xl bg-[#263d2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3d5a40] disabled:cursor-not-allowed disabled:opacity-50"
  >
    {submitting
      ? "Submitting..."
      : `Submit ${selectedCandidates.length} candidate(s) to client`}
  </button>
</div>
    {cumulativeResults.map((screening) => (
  <CandidateCard
    key={screening._id}
    screening={screening}
    rank={screening.rank}
    selectable
    selected={selectedCandidates.includes(screening._id)}
    onSelect={handleCandidateSelect}
  />
))}
  </section>
)}
      {ranked.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="text-[#71865b]" size={21} />
            <div>
              <h2 className="text-lg font-bold text-[#17251b]">
This batch's ranked candidates              </h2>
              <p className="text-xs text-stone-500">
                Highest AI scores first. Review the evidence before making a decision.
              </p>
            </div>
          </div>

          {ranked.map((screening, index) => (
            <CandidateCard
              key={screening._id}
              screening={screening}
              rank={index + 1}
            />
          ))}
        </section>
      )}

      {ranked.length === 0 && !progress.queued && !progress.processing && (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <Sparkles className="mx-auto mb-3 text-stone-400" size={28} />
          <h3 className="font-semibold text-stone-800">
            No successful evaluations yet
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Check the failed evaluations below for details.
          </p>
        </div>
      )}

      {(queued.length > 0 || processing.length > 0) && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <div className="flex items-center gap-2">
            <Clock3 size={17} />
            {queued.length + processing.length} resumes are still awaiting evaluation.
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <h2 className="text-lg font-bold text-[#17251b]">
              Failed evaluations ({failed.length})
            </h2>
          </div>

          {failed.map((item) => (
            <div
              key={item._id}
              className="rounded-xl border border-red-100 bg-white p-4"
            >
             <p className="font-semibold text-stone-800">
  {item.resumeSubmissionId?.fullName || "Resume submission"}
</p>
<p className="mt-1 text-xs text-stone-500">
  {item.resumeSubmissionId?.resume?.originalName || "Resume"}
</p>
              <p className="mt-2 text-sm text-red-700">
                {item.lastError || "Evaluation failed. No error details available."}
              </p>
            </div>
          ))}
        </section>
      )}

      {job?.status === "completed" && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-800">
          <CheckCircle2 size={18} />
          Screening completed successfully.
        </div>
      )}
    </div>
  );
}
