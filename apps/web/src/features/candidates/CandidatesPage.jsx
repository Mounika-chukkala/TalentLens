
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  Search,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  getCandidates,
  updateCandidateStage,
  uploadResume,
} from "../../lib/api";
import CandidateProfile from "./CandidateProfile";
const statusStyles = {
  completed: "bg-emerald-50 text-emerald-700",
  needs_review: "bg-amber-50 text-amber-700",
  pending: "bg-slate-100 text-slate-600",
  processing: "bg-blue-50 text-blue-700",
  failed: "bg-red-50 text-red-700",
};

function formatStatus(status = "pending") {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );
}

function getInitials(name = "Unknown candidate") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(date) {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CandidatesPage({ candidateToOpen, onCandidateOpened }) {
  const fileInputRef = useRef(null);

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  async function loadCandidates(showRefresh = false) {
    setError("");

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getCandidates();
      setCandidates(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load candidates.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openCandidateProfile(candidate) {
  if (!candidate?._id) {
    setError("Unable to open profile: candidate ID is missing.");
    return;
  }

  setError("");
  setSelectedCandidateId(candidate._id);
}


  useEffect(() => {
    loadCandidates();
  }, []);
useEffect(() => {
  if (!candidateToOpen || loading) return;

  const candidate = candidates.find(
    (item) => item._id === candidateToOpen
  );

  if (candidate) {
    openCandidateProfile(candidate);
  }

  onCandidateOpened?.();
}, [candidateToOpen, loading, candidates]);
  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    // Allow the same file to be selected again after an error.
    event.target.value = "";

    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["pdf", "docx"].includes(extension)) {
      setError("Choose a PDF or DOCX resume.");
      setNotice("");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("The resume must be 5 MB or smaller.");
      setNotice("");
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");

    try {
      const result = await uploadResume(file);

      setNotice(
        `${result.fullName || "Candidate"} uploaded successfully. Parsing status: ${formatStatus(result.parsingStatus)}.`,
      );

      await loadCandidates();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Resume upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();

    return candidates.filter((candidate) => {
      const skills = Array.isArray(candidate.skills)
        ? candidate.skills.join(" ")
        : "";

      const matchesSearch =
        !query ||
        (candidate.fullName || "").toLowerCase().includes(query) ||
        (candidate.email || "").toLowerCase().includes(query) ||
        (candidate.phone || "").toLowerCase().includes(query) ||
        skills.toLowerCase().includes(query) ||
        (candidate.resume?.originalName || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || candidate.parsingStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [candidates, search, statusFilter]);

  const completedCount = candidates.filter(
    (candidate) => candidate.parsingStatus === "completed",
  ).length;

  const reviewCount = candidates.filter(
    (candidate) => candidate.parsingStatus === "needs_review",
  ).length;

  return (
    <main className="min-w-0 flex-1 bg-[#f7f8f5] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-stone-500">
              Workspace / Candidates
            </p>

            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#17251b]">
              Candidates
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-stone-500">
              Upload resumes, review extracted candidate details, and track
              parsing quality before moving candidates through your hiring
              process.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadCandidates(true)}
              disabled={loading || refreshing || uploading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#17251b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b4030] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload size={16} />
              {uploading ? "Uploading..." : "Upload resume"}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
              aria-label="Choose a PDF or DOCX resume"
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-500">Total candidates</p>
              <span className="rounded-lg bg-stone-100 p-2 text-stone-600">
                <Users size={18} />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-[#17251b]">
              {loading ? "—" : candidates.length}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Records retrieved from your API
            </p>
          </article>

          <article className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-500">Parsing completed</p>
              <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <CheckCircle2 size={18} />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-[#17251b]">
              {loading ? "—" : completedCount}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Name and email detected by the parser
            </p>
          </article>

          <article className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-500">Needs review</p>
              <span className="rounded-lg bg-amber-50 p-2 text-amber-700">
                <Clock3 size={18} />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-[#17251b]">
              {loading ? "—" : reviewCount}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Candidate details may be incomplete
            </p>
          </article>
        </div>

        {notice && (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p>{notice}</p>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss success message"
              className="ml-auto rounded p-1 hover:bg-emerald-100"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error message"
              className="rounded p-1 hover:bg-red-100"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-stone-100 p-5 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, skill, or filename..."
                aria-label="Search candidates"
                className="w-full rounded-lg border border-stone-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter candidates by parsing status"
              className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#55734b]"
            >
              <option value="all">All parsing statuses</option>
              <option value="completed">Completed</option>
              <option value="needs_review">Needs review</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-stone-500">
              Loading candidates from your database...
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={30} className="mx-auto text-stone-400" />
              <p className="mt-3 font-medium text-stone-800">
                {candidates.length === 0
                  ? "No candidates found"
                  : "No matching candidates"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-stone-500">
                {candidates.length === 0
                  ? "Upload a PDF or DOCX resume to create your first candidate record."
                  : "Try a different search term or parsing-status filter."}
              </p>

              {candidates.length === 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="mt-5 rounded-lg bg-[#17251b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2b4030] disabled:opacity-60"
                >
                  Upload your first resume
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-5 py-4 font-medium">Candidate</th>
                      <th className="px-4 py-4 font-medium">Skills detected</th>
                      <th className="px-4 py-4 font-medium">Resume parsing</th>
                      <th className="px-4 py-4 font-medium">Added</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-stone-100">
                    {filteredCandidates.map((candidate) => (
                      <tr key={candidate._id} className="hover:bg-stone-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf3e8] text-xs font-semibold text-[#35543b]">
                              {getInitials(candidate.fullName)}
                            </div>

                            <div className="min-w-0">
                           <button
  type="button"
  onClick={() => openCandidateProfile(candidate)}
  className="text-left font-medium text-stone-900 transition hover:text-[#55734b] hover:underline focus:outline-none focus:underline"
>
  {candidate.fullName || "Name not detected"}
</button>
                              <p className="mt-1 text-sm text-stone-500">
                                {candidate.email || "Email not detected"}
                              </p>
                              <p className="mt-1 max-w-[260px] truncate text-xs text-stone-400">
                                {candidate.resume?.originalName || "Resume"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {candidate.skills?.length ? (
                            <div className="flex max-w-[280px] flex-wrap gap-1.5">
                              {candidate.skills.slice(0, 4).map((skill) => (
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
                            <span className="text-sm text-stone-400">
                              No skills detected
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                              statusStyles[candidate.parsingStatus] ||
                              "bg-stone-100 text-stone-600"
                            }`}
                          >
                            {formatStatus(candidate.parsingStatus)}
                          </span>

                          {candidate.parsingWarnings?.length > 0 && (
                            <p
                              className="mt-2 max-w-[190px] text-xs text-amber-700"
                              title={candidate.parsingWarnings.join("\n")}
                            >
                              {candidate.parsingWarnings.length} warning(s)
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-stone-500">
                          {formatDate(candidate.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
                Showing {filteredCandidates.length} of {candidates.length} candidates
              </div>
            </>
          )}
        </section>
{selectedCandidateId && (
  <CandidateProfile
    candidateId={selectedCandidateId}
    onClose={() => setSelectedCandidateId(null)}
  />
)}
        <p className="mt-4 text-xs leading-5 text-stone-400">
          Resume parsing is automated and may miss or misidentify information.
          Review extracted details before using them in hiring decisions.
        </p>
      </div>
    </main>
  );
}
