
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  UserRound,
} from "lucide-react";

import { getRequisitionById, getRequisitionSubmissions } from "../../lib/api";

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-[#edf3e8] p-2 text-[#35543b]">
        <Icon size={18} />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-stone-500">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-stone-800">
          {value ?? "Not specified"}
        </p>
      </div>
    </div>
  );
}

function formatDate(date) {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function RequisitionDetailPage() {
  const { requisitionId } = useParams();

  const [requisition, setRequisition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
const [submissions, setSubmissions] = useState([]);
const [loadingSubmissions, setLoadingSubmissions] = useState(true);
const [submissionError, setSubmissionError] = useState("");
  useEffect(() => {
    let cancelled = false;

    async function loadRequisition() {
      setLoading(true);
      setError("");

      try {
        const result = await getRequisitionById(requisitionId);

        if (!cancelled) {
          setRequisition(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || "Unable to load requisition details."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRequisition();

    return () => {
      cancelled = true;
    };
  }, [requisitionId]);


useEffect(() => {
  let cancelled = false;

  async function loadSubmissions() {
    setLoadingSubmissions(true);
    setSubmissionError("");

    try {
      const data = await getRequisitionSubmissions(requisitionId);

      if (!cancelled) {
        setSubmissions(data);
      }
    } catch (err) {
      if (!cancelled) {
        setSubmissionError(
          err.message || "Unable to load candidate submissions.",
        );
      }
    } finally {
      if (!cancelled) {
        setLoadingSubmissions(false);
      }
    }
  }

  loadSubmissions();

  return () => {
    cancelled = true;
  };
}, [requisitionId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-6 md:p-9">
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
          Loading requisition details...
        </div>
      </main>
    );
  }

  if (error || !requisition) {
    return (
      <main className="mx-auto max-w-6xl p-6 md:p-9">
        <Link
          to="/requisitions"
          className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft size={16} />
          Back to requisitions
        </Link>

        <div className="mt-6 rounded-xl border border-red-200 bg-white p-8">
          <h2 className="font-semibold text-stone-900">
            Unable to load requisition
          </h2>
          <p className="mt-2 text-sm text-red-700">
            {error || "Requisition not found."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 bg-[#f7f8f5] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/requisitions"
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-[#24432b]"
        >
          <ArrowLeft size={16} />
          Back to requisitions
        </Link>

        {/* Header */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#edf3e8] px-3 py-1 text-xs font-semibold capitalize text-[#35543b]">
                  {requisition.status?.replaceAll("_", " ")}
                </span>

                <span className="text-xs text-stone-400">
                  Created {formatDate(requisition.createdAt)}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#17251b] md:text-3xl">
                {requisition.title}
              </h1>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-500">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={15} />
                  {requisition.clientName}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} />
                  {requisition.location}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Job overview */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
          <h2 className="text-lg font-semibold text-[#17251b]">
            Job overview
          </h2>

          <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem
              icon={BriefcaseBusiness}
              label="Job title"
              value={requisition.title}
            />

            <DetailItem
              icon={Building2}
              label="Client organization"
              value={requisition.clientName}
            />

            <DetailItem
              icon={MapPin}
              label="Location"
              value={requisition.location}
            />

            <DetailItem
              icon={UserRound}
              label="Minimum experience"
              value={`${requisition.minExperience} years`}
            />

            <DetailItem
              icon={UserRound}
              label="Maximum experience"
              value={`${requisition.maxExperience} years`}
            />

            <DetailItem
              icon={Clock3}
              label="Maximum notice period"
              value={`${requisition.noticePeriodDays} days`}
            />

            <DetailItem
              icon={CalendarDays}
              label="Last updated"
              value={formatDate(requisition.updatedAt)}
            />
          </div>
        </section>

        {/* Description */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
          <h2 className="text-lg font-semibold text-[#17251b]">
            Job description and requirements
          </h2>

          <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-stone-600">
            {requisition.description || "No job description provided."}
          </div>
        </section>

        {/* Candidate submissions placeholder */}
        {/* <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
          <h2 className="text-lg font-semibold text-[#17251b]">
            Candidate submissions
          </h2>

          <p className="mt-2 text-sm leading-6 text-stone-500">
            Candidate submissions for this requisition will be displayed here.
            Recruiter submissions and client feedback will be connected in the
            next stage.
          </p>
        </section> */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 className="text-lg font-semibold text-[#17251b]">
        Candidate submissions
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        Submission history and feedback from the client organization.
      </p>
    </div>

    <span className="rounded-full bg-[#edf3e8] px-3 py-1.5 text-xs font-semibold text-[#35543b]">
      {submissions.length} rounds
    </span>
  </div>

  {loadingSubmissions ? (
    <p className="mt-6 text-sm text-stone-500">
      Loading submission history...
    </p>
  ) : submissionError ? (
    <p className="mt-6 text-sm text-red-600">{submissionError}</p>
  ) : submissions.length === 0 ? (
    <div className="mt-6 rounded-xl border border-dashed border-stone-300 bg-[#fafbf8] p-8 text-center">
      <p className="font-medium text-stone-700">
        No candidates submitted yet
      </p>
      <p className="mt-1 text-sm text-stone-500">
        Submitted candidates and client feedback will appear here.
      </p>
    </div>
  ) : (
    <div className="mt-6 space-y-5">
      {submissions.map((submission) => (
        <div
          key={submission._id}
          className="overflow-hidden rounded-xl border border-stone-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#fafbf8] px-5 py-4">
            <div>
              <h3 className="font-semibold text-[#17251b]">
                Submission Round {submission.round}
                {submission.title ? ` — ${submission.title}` : ""}
              </h3>
              <p className="mt-1 text-xs text-stone-500">
                Submitted {formatDate(submission.submittedAt)}
              </p>
            </div>

            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              submission.status === "reviewed"
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-700"
            }`}>
              {submission.status === "reviewed" ? "Reviewed" : "Awaiting feedback"}
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {(submission.candidates || []).map((candidate) => {
              const profile = candidate.candidateId || {};
              const snapshot = candidate.candidateSnapshot || {};

              const name = profile.fullName || snapshot.fullName || "Candidate";

              const feedbackStyles = {
                interested: "bg-green-50 text-green-700",
                interview: "bg-blue-50 text-blue-700",
                reject: "bg-red-50 text-red-700",
              };

              return (
                <div key={candidate._id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-stone-800">
                        {name}
                      </h4>
                      <p className="mt-1 text-xs text-stone-500">
                        {profile.email || snapshot.email || "No email"}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        Rank #{candidate.rank} · AI score: {candidate.overallScore}/100
                      </p>
                    </div>

                    {candidate.feedback ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                        feedbackStyles[candidate.feedback] ||
                        "bg-stone-100 text-stone-700"
                      }`}>
                        {candidate.feedback}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Awaiting client feedback
                      </span>
                    )}
                  </div>

                  {candidate.feedbackNote && (
                    <div className="mt-4 rounded-lg bg-[#fafbf8] p-3">
                      <p className="text-xs font-semibold text-stone-600">
                        Client feedback note
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">
                        {candidate.feedbackNote}
                      </p>
                    </div>
                  )}

                  {candidate.feedbackAt && (
                    <p className="mt-3 text-xs text-stone-400">
                      Feedback received {formatDate(candidate.feedbackAt)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  )}
</section>
      </div>
    </main>
  );
}
