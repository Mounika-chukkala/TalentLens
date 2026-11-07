
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getClientSubmissions } from "../../lib/api";

const feedbackStyles = {
  interested: "bg-emerald-100 text-emerald-800",
  interview: "bg-blue-100 text-blue-800",
  reject: "bg-red-100 text-red-800",
};

export default function ClientReviewsPage() {
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
      try {
        setLoading(true);
        setError("");

        const result = await getClientSubmissions();

        if (!cancelled) {
          setSubmissions(Array.isArray(result) ? result : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load client reviews.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReviews();

    return () => {
      cancelled = true;
    };
  }, []);

  const reviewedCandidates = submissions.flatMap((submission) =>
    (submission.candidates || [])
      .filter((candidate) => candidate.feedback)
      .map((candidate) => ({
        ...candidate,
        submissionId: submission._id,
        requisition: submission.requisitionId,
        round: submission.round,
        submittedAt: submission.submittedAt,
      }))
  );

  return (
    <main className="mx-auto max-w-6xl p-5 md:p-9">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#55734b]">
          TalentLens workspace
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-900">
          Client reviews
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          Review client decisions and feedback on submitted candidates.
        </p>
      </div>

      {loading && (
        <p className="py-10 text-center text-stone-500">
          Loading client feedback...
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Total feedback received",
                value: reviewedCandidates.length,
              },
              {
                label: "Interested",
                value: reviewedCandidates.filter(
                  (c) => c.feedback === "interested"
                ).length,
              },
              {
                label: "Interviews",
                value: reviewedCandidates.filter(
                  (c) => c.feedback === "interview"
                ).length,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-stone-200 bg-white p-5"
              >
                <p className="text-sm text-stone-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {reviewedCandidates.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-10 text-center">
              <h3 className="font-semibold text-stone-800">
                No client feedback yet
              </h3>
              <p className="mt-2 text-sm text-stone-500">
                Feedback submitted by client organizations will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviewedCandidates
                .sort(
                  (a, b) =>
                    new Date(b.feedbackAt || 0) -
                    new Date(a.feedbackAt || 0)
                )
                .map((candidate) => (
                  <article
                    key={`${candidate.submissionId}-${candidate._id}`}
                    className="rounded-xl border border-stone-200 bg-white p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-stone-900">
                          {candidate.candidateSnapshot?.fullName ||
                            "Unnamed candidate"}
                        </h3>
                        <p className="mt-1 text-sm text-stone-500">
                          {candidate.candidateSnapshot?.email ||
                            "No email available"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                          feedbackStyles[candidate.feedback] ||
                          "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {candidate.feedback}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-stone-500 sm:grid-cols-2">
                      <p>
                        <span className="font-medium text-stone-700">
                          Requisition:
                        </span>{" "}
                        {typeof candidate.requisition === "object"
                          ? candidate.requisition?.title || "Requisition"
                          : "Requisition"}
                      </p>

                      <p>
                        <span className="font-medium text-stone-700">
                          Submission round:
                        </span>{" "}
                        {candidate.round}
                      </p>

                      <p>
                        <span className="font-medium text-stone-700">
                          Rank:
                        </span>{" "}
                        #{candidate.rank ?? "—"}
                      </p>

                      <p>
                        <span className="font-medium text-stone-700">
                          AI score:
                        </span>{" "}
                        {candidate.overallScore ?? "—"}
                      </p>
                    </div>

                    {candidate.feedbackNote && (
                      <div className="mt-4 rounded-lg bg-stone-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Client feedback note
                        </p>
                        <p className="mt-2 text-sm text-stone-700">
                          {candidate.feedbackNote}
                        </p>
                      </div>
                    )}

                    <p className="mt-4 text-xs text-stone-400">
                      Feedback received{" "}
                      {candidate.feedbackAt
                        ? new Date(candidate.feedbackAt).toLocaleString()
                        : "—"}
                    </p>
                  </article>
                ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
