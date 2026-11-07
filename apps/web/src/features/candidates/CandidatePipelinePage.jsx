
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  RefreshCw,
  Users,
  UserRound,
} from "lucide-react";
import { getCandidates } from "../../lib/api";
import CandidateProfile from "./CandidateProfile";
const STAGES = [
  {
    id: "new",
    label: "New",
    description: "Recently added candidates",
  },
  {
    id: "screening",
    label: "Screening",
    description: "Under initial review",
  },
  {
    id: "shortlisted",
    label: "Shortlisted",
    description: "Selected for the next round",
  },
  {
    id: "interview",
    label: "Interview",
    description: "Candidates in interviews",
  },
  {
    id: "offered",
    label: "Offered",
    description: "Offers extended",
  },
  {
    id: "hired",
    label: "Hired",
    description: "Successfully hired",
  },
  {
  id: "rejected",
  label: "Rejected",
  description: "Candidates rejected during the hiring process",
},
];

const PAGE_SIZE = 5;

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function formatDate(date) {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CandidatePipelinePage() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedStages, setExpandedStages] = useState([]);
  const [stagePages, setStagePages] = useState({});
const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const loadCandidates = useCallback(async (showRefresh = false) => {
    setError("");

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getCandidates();
      setCandidates(Array.isArray(result.data) ? result.data : []);
      setStagePages({});
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load candidates."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const activeCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          (candidate.recruitmentStage || "new") !== "rejected"
      ),
    [candidates]
  );

  function toggleStage(stageId) {
    setExpandedStages((current) =>
      current.includes(stageId)
        ? current.filter((id) => id !== stageId)
        : [...current, stageId]
    );
  }

  function changePage(stageId, nextPage) {
    setStagePages((current) => ({
      ...current,
      [stageId]: nextPage,
    }));
  }

  function handleOpenCandidate(candidate) {
  if (!candidate?._id) {
    setError("Unable to open profile: candidate ID is missing.");
    return;
  }

  setError("");
  setSelectedCandidateId(candidate._id);
}

  if (loading) {
    return (
      <main className="min-w-0 flex-1 bg-[#f7f8f5] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-56 rounded-lg bg-stone-200" />
            <div className="h-4 w-80 max-w-full rounded bg-stone-200" />
            {STAGES.slice(0, 3).map((stage) => (
              <div
                key={stage.id}
                className="h-16 rounded-xl bg-white"
              />
            ))}
          </div>
          <p className="mt-5 text-sm text-stone-500">
            Loading your hiring pipeline...
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
    <main className="min-w-0 flex-1 bg-[#f7f8f5] px-4 py-7 text-[#202820] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-stone-500">
              Workspace / Hiring pipeline
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#17251b]">
              Hiring pipeline
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-stone-500">
              Follow candidates through each stage of your hiring process.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadCandidates(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p className="break-words">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => loadCandidates()}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        <section className="mt-7 rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-stone-500">
                Active candidates
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[#17251b]">
                {activeCandidates.length}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-stone-500">
                Pipeline stages
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[#17251b]">
                {STAGES.length}
              </p>
            </div>

            <div className="col-span-2 border-t border-stone-100 pt-3 sm:col-span-1 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <p className="text-xs font-medium text-stone-500">
                Candidates hired
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[#17251b]">
                {activeCandidates.filter(
                  (candidate) =>
                    (candidate.recruitmentStage || "new") === "hired"
                ).length}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-3">
          {STAGES.map((stage) => {
            // Use the actual recruitmentStage field from the API.
            const stageCandidates = activeCandidates.filter(
              (candidate) =>
                (candidate.recruitmentStage || "new") === stage.id
            );

            const expanded = expandedStages.includes(stage.id);

            const totalPages = Math.max(
              1,
              Math.ceil(stageCandidates.length / PAGE_SIZE)
            );

            const currentPage = Math.min(
              stagePages[stage.id] || 1,
              totalPages
            );

            const startIndex = (currentPage - 1) * PAGE_SIZE;

            const visibleCandidates = stageCandidates.slice(
              startIndex,
              startIndex + PAGE_SIZE
            );

            return (
              <section
                key={stage.id}
                className="overflow-hidden rounded-xl border border-stone-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => toggleStage(stage.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-2 px-4 py-4 text-left transition hover:bg-stone-50/70 sm:px-5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf3e8] text-[#35543b]">
                    <Users size={17} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[#17251b]">
                      {stage.label}
                    </span>
                    <span className="mt-1 block text-xs text-stone-500">
                      {stage.description}
                    </span>
                  </span>

                  <span className="min-w-9 rounded-full bg-stone-100 px-3 py-1.5 text-center text-sm font-semibold tabular-nums text-stone-700">
                    {stageCandidates.length}
                  </span>

                  {expanded ? (
                    <ChevronUp
                      size={18}
                      className="shrink-0 text-stone-400"
                    />
                  ) : (
                    <ChevronDown
                      size={18}
                      className="shrink-0 text-stone-400"
                    />
                  )}
                </button>

                {expanded && (
                  <div className="border-t border-stone-100">
                    {stageCandidates.length === 0 ? (
                      <div className="px-5 py-9 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                          <Users size={18} />
                        </div>
                        <p className="mt-3 text-sm font-medium text-stone-700">
                          No candidates in this stage
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          Candidates will appear here when assigned to this stage.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="divide-y divide-stone-100">
                          {visibleCandidates.map((candidate) => (
                            <article
                              key={candidate._id}
                              className="flex flex-col gap-4 px-4 py-4 transition hover:bg-stone-50/50 sm:flex-row sm:items-center sm:px-5"
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf3e8] text-xs font-semibold text-[#35543b]">
                                  {getInitials(candidate.fullName)}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="break-words font-medium text-stone-900">
                                    {candidate.fullName || "Name not detected"}
                                  </p>

                                  <p className="mt-1 break-all text-sm text-stone-500">
                                    {candidate.email || "Email not detected"}
                                  </p>

                                  {candidate.skills?.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {candidate.skills
                                        .slice(0, 4)
                                        .map((skill) => (
                                          <span
                                            key={skill}
                                            className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600"
                                          >
                                            {skill}
                                          </span>
                                        ))}

                                      {candidate.skills.length > 4 && (
                                        <span className="px-1 py-1 text-xs text-stone-400">
                                          +{candidate.skills.length - 4} more
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-xs text-stone-400">
                                      No skills detected
                                    </p>
                                  )}

                                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
                                    {candidate.resume?.originalName && (
                                      <span className="inline-flex min-w-0 items-center gap-1">
                                        <FileText size={13} />
                                        <span className="max-w-[220px] truncate">
                                          {candidate.resume.originalName}
                                        </span>
                                      </span>
                                    )}

                                    {formatDate(candidate.createdAt) && (
                                      <span>
                                        Added {formatDate(candidate.createdAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleOpenCandidate(candidate)}
                                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm font-medium text-[#35543b] transition hover:border-[#55734b] hover:bg-[#f5f7f1] sm:w-auto"
                              >
                                <UserRound size={15} />
                                View profile
                              </button>
                            </article>
                          ))}
                        </div>

                        {totalPages > 1 && (
                          <div className="flex flex-col gap-3 border-t border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <p className="text-xs text-stone-500">
                              Showing {startIndex + 1}–
                              {Math.min(
                                startIndex + PAGE_SIZE,
                                stageCandidates.length
                              )}{" "}
                              of {stageCandidates.length}
                            </p>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  changePage(stage.id, currentPage - 1)
                                }
                                disabled={currentPage === 1}
                                aria-label={`Previous ${stage.label} page`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ChevronLeft size={17} />
                              </button>

                              <span className="min-w-20 text-center text-xs text-stone-600">
                                Page {currentPage} of {totalPages}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  changePage(stage.id, currentPage + 1)
                                }
                                disabled={currentPage === totalPages}
                                aria-label={`Next ${stage.label} page`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ChevronRight size={17} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </section>

        <p className="mt-5 text-xs leading-5 text-stone-400">
          Rejected candidates are excluded from the active pipeline.
          Stage counts reflect each candidate&apos;s current recruitment stage.
        </p>
      </div>
    </main>
    {selectedCandidateId && (
  <CandidateProfile
    candidateId={selectedCandidateId}
    onClose={() => setSelectedCandidateId(null)}
  />
)}
  </>
  );
}

export default CandidatePipelinePage;
