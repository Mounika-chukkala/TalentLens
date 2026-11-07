import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Users,
  CalendarDays,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";

import { getRequisitions, getRequisitionSubmissions } from "../../lib/api";

const feedbackConfig = {
  interested: {
    label: "Interested",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  },
  interview: {
    label: "Interview",
    className: "bg-blue-50 text-blue-700 ring-blue-600/15",
  },
  reject: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 ring-red-600/15",
  },
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function getClientKey(requisition) {
  const organization = requisition.clientOrganizationId;

  if (organization && typeof organization === "object") {
    return String(
      organization._id ||
        organization.id ||
        requisition.clientName ||
        "unknown",
    );
  }

  return String(organization || requisition.clientName || "unassigned");
}

function getClientName(requisition) {
  const organization = requisition.clientOrganizationId;

  if (organization && typeof organization === "object" && organization.name) {
    return organization.name;
  }

  return requisition.clientName || "Client organization";
}

function CandidateSubmissionCard({ candidate, round, submittedAt }) {
  const feedback = feedbackConfig[candidate.feedback] || null;

  const candidateProfile =
    candidate.candidateId && typeof candidate.candidateId === "object"
      ? candidate.candidateId
      : {};

  const skills = candidate.candidateSnapshot?.skills?.length
    ? candidate.candidateSnapshot.skills
    : candidateProfile.skills || [];

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-stone-900">
            {candidate.candidateSnapshot?.fullName ||
              candidateProfile.fullName ||
              "Unnamed candidate"}
          </h4>

          <p className="mt-1 break-all text-sm text-stone-500">
            {candidate.candidateSnapshot?.email ||
              candidateProfile.email ||
              "No email available"}
          </p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
            feedback
              ? feedback.className
              : "bg-amber-50 text-amber-700 ring-amber-600/15"
          }`}
        >
          {feedback?.label || "Awaiting feedback"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-stone-400">Submission round</p>
          <p className="mt-1 font-medium text-stone-700">
            Round {round || "—"}
          </p>
        </div>

        <div>
          <p className="text-xs text-stone-400">Submitted on</p>
          <p className="mt-1 font-medium text-stone-700">
            {formatDate(submittedAt)}
          </p>
        </div>

        <div>
          <p className="text-xs text-stone-400">Candidate rank</p>
          <p className="mt-1 font-medium text-stone-700">
            {candidate.rank == null ? "—" : `#${candidate.rank}`}
          </p>
        </div>

        <div>
          <p className="text-xs text-stone-400">AI match score</p>
          <p className="mt-1 font-medium text-stone-700">
            {candidate.overallScore == null ? "—" : candidate.overallScore}
          </p>
        </div>
      </div>

      {skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {skills.slice(0, 8).map((skill, index) => (
            <span
              key={`${skill}-${index}`}
              className="rounded-md bg-stone-100 px-2.5 py-1 text-xs text-stone-600"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {candidate.feedbackNote && (
        <div className="mt-4 rounded-lg border border-stone-100 bg-stone-50 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <MessageSquareText size={14} />
            Client feedback
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
            {candidate.feedbackNote}
          </p>

          {candidate.feedbackAt && (
            <p className="mt-2 text-xs text-stone-400">
              Updated {formatDate(candidate.feedbackAt)}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default function ClientReviewsPage() {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expandedClientId, setExpandedClientId] = useState(null);
  const [expandedRequisitionId, setExpandedRequisitionId] = useState(null);

  const [submissionCache, setSubmissionCache] = useState({});
  const [submissionLoading, setSubmissionLoading] = useState({});
  const [submissionErrors, setSubmissionErrors] = useState({});

  const [clientLoading, setClientLoading] = useState({});
  const [clientErrors, setClientErrors] = useState({});

  async function loadRequisitions() {
    setLoading(true);
    setError("");

    try {
      const result = await getRequisitions();

      setRequisitions(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err.message || "Unable to load your client requisitions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequisitions();
  }, []);

  const clients = useMemo(() => {
    const grouped = new Map();

    requisitions.forEach((requisition) => {
      const key = getClientKey(requisition);

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: getClientName(requisition),
          requisitions: [],
        });
      }

      grouped.get(key).requisitions.push(requisition);
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [requisitions]);
  function toggleRequisition(requisitionId) {
    setExpandedRequisitionId((current) =>
      current === requisitionId ? null : requisitionId,
    );
  }

  async function loadClientSubmissions(client) {
    const clientId = client.id;

    // Fetch only requisitions that haven't loaded successfully yet.
    const requisitionsToLoad = client.requisitions.filter((requisition) => {
      const id = String(requisition._id);

      return (
        !Object.prototype.hasOwnProperty.call(submissionCache, id) ||
        Boolean(submissionErrors[id])
      );
    });

    if (requisitionsToLoad.length === 0) return;

    setClientLoading((current) => ({
      ...current,
      [clientId]: true,
    }));

    setClientErrors((current) => ({
      ...current,
      [clientId]: "",
    }));

    setSubmissionLoading((current) => {
      const next = { ...current };

      requisitionsToLoad.forEach((requisition) => {
        next[String(requisition._id)] = true;
      });

      return next;
    });

    setSubmissionErrors((current) => {
      const next = { ...current };

      requisitionsToLoad.forEach((requisition) => {
        delete next[String(requisition._id)];
      });

      return next;
    });

    const results = await Promise.allSettled(
      requisitionsToLoad.map((requisition) =>
        getRequisitionSubmissions(String(requisition._id)),
      ),
    );

    const failedRequisitions = [];

    setSubmissionCache((current) => {
      const next = { ...current };

      results.forEach((result, index) => {
        const requisitionId = String(requisitionsToLoad[index]._id);

        if (result.status === "fulfilled") {
          next[requisitionId] = Array.isArray(result.value) ? result.value : [];
        } else {
          failedRequisitions.push(requisitionsToLoad[index]);

          // Keep the failed requisition uncached so it can be retried.
          delete next[requisitionId];
        }
      });

      return next;
    });

    setSubmissionErrors((current) => {
      const next = { ...current };

      results.forEach((result, index) => {
        const requisitionId = String(requisitionsToLoad[index]._id);

        if (result.status === "rejected") {
          next[requisitionId] =
            result.reason?.message || "Unable to load candidate submissions.";
        }
      });

      return next;
    });

    setSubmissionLoading((current) => {
      const next = { ...current };

      requisitionsToLoad.forEach((requisition) => {
        next[String(requisition._id)] = false;
      });

      return next;
    });

    setClientErrors((current) => ({
      ...current,
      [clientId]:
        failedRequisitions.length > 0
          ? `${failedRequisitions.length} requisition(s) could not load candidate submissions.`
          : "",
    }));

    setClientLoading((current) => ({
      ...current,
      [clientId]: false,
    }));
  }

  async function toggleClient(client) {
    if (expandedClientId === client.id) {
      setExpandedClientId(null);
      setExpandedRequisitionId(null);
      return;
    }

    setExpandedClientId(client.id);
    setExpandedRequisitionId(null);

    await loadClientSubmissions(client);
  }

  return (
    <main className="mx-auto max-w-6xl p-5 md:p-9">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#55734b]">
            TalentLens workspace
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
            Client reviews
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Follow each client’s requisitions, submitted candidates, submission
            rounds, and feedback in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={loadRequisitions}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-12 text-center text-sm text-stone-500">
          Loading your client requisitions...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-800">{error}</p>

          <button
            type="button"
            onClick={loadRequisitions}
            className="mt-3 text-sm font-semibold text-red-800 underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && clients.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <Building2 className="mx-auto text-stone-400" size={30} />

          <h3 className="mt-4 font-semibold text-stone-800">
            No client requisitions yet
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
            Client organizations will appear here once you create requisitions
            for them.
          </p>
        </div>
      )}

      {!loading && !error && clients.length > 0 && (
        <div className="space-y-3">
          <div className="mb-4 flex items-center justify-between text-sm text-stone-500">
            <span>
              {clients.length} client{clients.length === 1 ? "" : "s"}
            </span>

            <span>
              {requisitions.length} requisition
              {requisitions.length === 1 ? "" : "s"}
            </span>
          </div>

          {clients.map((client) => {
            const isClientOpen = expandedClientId === client.id;

            return (
              <section
                key={client.id}
                className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm shadow-stone-900/[0.02]"
              >
                <button
                  type="button"
                  onClick={() => toggleClient(client)}
                  aria-expanded={isClientOpen}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-stone-50 sm:px-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef2e8] text-[#49613e]">
                    <Building2 size={20} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-stone-900">
                      {client.name}
                    </span>

                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <BriefcaseBusiness size={13} />
                        {client.requisitions.length} requisition
                        {client.requisitions.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </span>

                  {isClientOpen ? (
                    <ChevronDown
                      className="shrink-0 text-stone-500"
                      size={19}
                    />
                  ) : (
                    <ChevronRight
                      className="shrink-0 text-stone-400"
                      size={19}
                    />
                  )}
                </button>

                {isClientOpen && (
                  <div className="border-t border-stone-100 bg-stone-50/70 p-3 sm:p-4">
                    <div className="space-y-3">
                      {clientLoading[client.id] && (
                        <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-stone-500">
                          <RefreshCw size={15} className="animate-spin" />
                          Loading candidate submissions for this client...
                        </div>
                      )}

                      {clientErrors[client.id] && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                          <p className="text-sm text-amber-800">
                            {clientErrors[client.id]}
                          </p>

                          <button
                            type="button"
                            onClick={() => loadClientSubmissions(client)}
                            disabled={clientLoading[client.id]}
                            className="text-sm font-semibold text-amber-800 underline underline-offset-4 disabled:opacity-50"
                          >
                            Retry failed requests
                          </button>
                        </div>
                      )}

                      {client.requisitions.map((requisition) => {
                        const requisitionId = String(requisition._id);

                        const isRequisitionOpen =
                          expandedRequisitionId === requisitionId;

                        const submissions =
                          submissionCache[requisitionId] || [];

                        const totalCandidates = submissions.reduce(
                          (count, submission) =>
                            count + (submission.candidates || []).length,
                          0,
                        );

                        return (
                          <div
                            key={requisitionId}
                            className="overflow-hidden rounded-xl border border-stone-200 bg-white"
                          >
                            <button
                              type="button"
                              onClick={() => toggleRequisition(requisitionId)}
                              aria-expanded={isRequisitionOpen}
                              className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-stone-50"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                                <BriefcaseBusiness size={17} />
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-stone-800">
                                  {requisition.title || "Untitled requisition"}
                                </span>

                                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                                  <span>
                                    {requisition.location ||
                                      "Location not specified"}
                                  </span>

                                  <span className="inline-flex items-center gap-1">
                                    <Users size={12} />
                                    {totalCandidates} candidate
                                    {totalCandidates === 1 ? "" : "s"}
                                  </span>

                                  <span className="capitalize">
                                    {String(
                                      requisition.status || "open",
                                    ).replace("_", " ")}
                                  </span>
                                </span>
                              </span>

                              {isRequisitionOpen ? (
                                <ChevronDown
                                  size={18}
                                  className="shrink-0 text-stone-500"
                                />
                              ) : (
                                <ChevronRight
                                  size={18}
                                  className="shrink-0 text-stone-400"
                                />
                              )}
                            </button>

                            {isRequisitionOpen && (
                              <div className="border-t border-stone-100 p-4 sm:p-5">
                                

          

                                {!submissionLoading[requisitionId] &&
                                  !submissionErrors[requisitionId] &&
                                  submissions.length === 0 && (
                                    <div className="rounded-lg border border-dashed border-stone-200 px-4 py-8 text-center">
                                      <Users
                                        className="mx-auto text-stone-300"
                                        size={24}
                                      />

                                      <p className="mt-3 text-sm font-medium text-stone-700">
                                        No candidates submitted yet
                                      </p>

                                      <p className="mt-1 text-xs text-stone-500">
                                        Candidate submissions for this
                                        requisition will appear here.
                                      </p>
                                    </div>
                                  )}

                                {!submissionLoading[requisitionId] &&
                                  !submissionErrors[requisitionId] &&
                                  submissions.length > 0 && (
                                    <div className="space-y-5">
                                      {submissions.map((submission) => (
                                        <section
                                          key={submission._id}
                                          className="space-y-3"
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                              <h4 className="text-sm font-semibold text-stone-800">
                                                {submission.title ||
                                                  `Submission round ${submission.round}`}
                                              </h4>

                                              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-stone-500">
                                                <CalendarDays size={13} />
                                                Submitted{" "}
                                                {formatDate(
                                                  submission.submittedAt,
                                                )}
                                              </p>
                                            </div>

                                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                                              Round {submission.round || "—"} ·{" "}
                                              {
                                                (submission.candidates || [])
                                                  .length
                                              }{" "}
                                              candidate
                                              {(submission.candidates || [])
                                                .length === 1
                                                ? ""
                                                : "s"}
                                            </span>
                                          </div>

                                          {(submission.candidates || [])
                                            .length === 0 ? (
                                            <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500">
                                              This submission round has no
                                              candidate records.
                                            </p>
                                          ) : (
                                            <div className="space-y-3">
                                              {submission.candidates.map(
                                                (candidate) => (
                                                  <CandidateSubmissionCard
                                                    key={candidate._id}
                                                    candidate={candidate}
                                                    round={submission.round}
                                                    submittedAt={
                                                      submission.submittedAt
                                                    }
                                                  />
                                                ),
                                              )}
                                            </div>
                                          )}
                                        </section>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
