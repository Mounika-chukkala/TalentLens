
import { useState } from "react";

const feedbackOptions = [
  {
    value: "interested",
    label: "Interested",
    activeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  {
    value: "interview",
    label: "Interview",
    activeClass: "bg-blue-100 text-blue-800 border-blue-300",
  },
  {
    value: "reject",
    label: "Reject",
    activeClass: "bg-red-100 text-red-800 border-red-300",
  },
];

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function FeedbackBadge({ value }) {
  if (!value) {
    return (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
        Awaiting review
      </span>
    );
  }

  const option = feedbackOptions.find((item) => item.value === value);

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        option?.activeClass || "bg-stone-100 text-stone-600"
      }`}
    >
      {option?.label || value}
    </span>
  );
}

export default function CandidateSubmissionCard({
  candidate,
  submissionId,
  onFeedback,
  saving,
}) {
  const snapshot = candidate.candidateSnapshot || {};

  const [feedbackNote, setFeedbackNote] = useState(
    candidate.feedbackNote || "",
  );

  const selectedFeedback = candidate.feedback || null;

  const handleFeedback = async (feedback) => {
    await onFeedback(
      submissionId,
      candidate._id,
      feedback,
      feedbackNote,
    );
  };

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-stone-900">
              {snapshot.fullName || "Candidate"}
            </h4>

            <FeedbackBadge value={selectedFeedback} />
          </div>

          <p className="mt-1 text-sm text-stone-500">
            {snapshot.email || "Email not available"}
          </p>

          {snapshot.resumeFileName && (
            <p className="mt-1 text-xs text-stone-400">
              Resume: {snapshot.resumeFileName}
            </p>
          )}
        </div>

        <div className="flex gap-5 sm:text-right">
          <div>
            <p className="text-xs text-stone-400">Rank</p>
            <p className="text-lg font-semibold text-stone-800">
              #{candidate.rank}
            </p>
          </div>

          <div>
            <p className="text-xs text-stone-400">AI score</p>
            <p className="text-lg font-semibold text-[#55734b]">
              {candidate.overallScore ?? "—"}
              <span className="text-xs font-normal text-stone-400">/100</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(snapshot.skills || []).map((skill, index) => (
          <span
            key={`${skill}-${index}`}
            className="rounded-md bg-stone-100 px-2.5 py-1 text-xs text-stone-600"
          >
            {skill}
          </span>
        ))}
      </div>

      {snapshot.totalExperience != null && (
        <p className="mt-3 text-sm text-stone-600">
          Experience: {snapshot.totalExperience} years
        </p>
      )}

      <div className="mt-5 border-t border-stone-100 pt-4">
        <p className="mb-3 text-sm font-semibold text-stone-700">
          Your feedback
        </p>

        <div className="flex flex-wrap gap-2">
          {feedbackOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={saving}
              onClick={() => handleFeedback(option.value)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedFeedback === option.value
                  ? option.activeClass
                  : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              {saving && selectedFeedback === option.value
                ? "Saving..."
                : option.label}
            </button>
          ))}
        </div>

        <textarea
          value={feedbackNote}
          onChange={(event) => setFeedbackNote(event.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="Optional feedback note..."
          className="mt-3 w-full rounded-lg border border-stone-200 p-3 text-sm outline-none focus:border-[#55734b]"
        />

        {candidate.feedbackAt && (
          <p className="mt-2 text-xs text-stone-400">
            Last reviewed: {formatDate(candidate.feedbackAt)}
          </p>
        )}
      </div>
    </article>
  );
}


