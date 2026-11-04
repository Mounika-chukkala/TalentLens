
import { useEffect, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Mail,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import {
  getCandidateById,
  updateCandidateStage,
} from "../../lib/api";
const STAGES = [
  { value: "new", label: "New" },
  { value: "screening", label: "Screening" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview", label: "Interview" },
  { value: "offered", label: "Offered" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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

export default function CandidateProfile({ candidateId, onClose }) {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!candidateId) return;

    const controller = new AbortController();

async function loadProfile() {
  setLoading(true);
  setError("");
  setNotice("");
  setCandidate(null);

  try {
    const profile = await getCandidateById(candidateId, {
      signal: controller.signal,
    });

    if (!profile || !profile._id) {
      throw new Error(
        "The server returned an invalid candidate profile.",
      );
    }

    setCandidate(profile);
  } catch (err) {
    if (err.name !== "AbortError") {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load candidate profile.",
      );
    }
  } finally {
    if (!controller.signal.aborted) {
      setLoading(false);
    }
  }
}

    loadProfile();

    return () => controller.abort();
  }, [candidateId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleStageChange(event) {
    const stage = event.target.value;

    if (!candidate?._id || !stage) return;

    setUpdatingStage(true);
    setError("");
    setNotice("");

    try {
      const result = await updateCandidateStage(candidate._id, stage);
      const updatedCandidate = result.data ?? result;

      setCandidate((current) => ({
        ...current,
        ...updatedCandidate,
        recruitmentStage:
          updatedCandidate.recruitmentStage ?? stage,
      }));

      setNotice("Recruitment stage updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update recruitment stage.",
      );
    } finally {
      setUpdatingStage(false);
    }
  }

  const skills = Array.isArray(candidate?.skills)
    ? candidate.skills
    : [];

  const resume = candidate?.resume;
  const resumeUrl =
    resume?.url || resume?.fileUrl || resume?.downloadUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Candidate profile"
        className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-stone-200 bg-[#f9faf7] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
              TalentLens AI
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#17251b]">
              Candidate profile
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close candidate profile"
            className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {loading ? (
            <div className="space-y-4" aria-live="polite">
              <div className="h-24 animate-pulse rounded-2xl bg-stone-200" />
              <div className="h-32 animate-pulse rounded-2xl bg-stone-200" />
              <div className="h-40 animate-pulse rounded-2xl bg-stone-200" />
              <p className="text-sm text-stone-500">
                Loading candidate details...
              </p>
            </div>
          ) : error && !candidate ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <AlertCircle className="mb-2" size={20} />
              {error}
              <p className="mt-2 text-xs text-red-700">
                Check that the backend is running and the candidate ID is valid.
              </p>
            </div>
          ) : candidate ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e9f0e4] text-lg font-semibold text-[#35543b]">
                    {getInitials(candidate.fullName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-xl font-semibold text-[#17251b]">
                      {candidate.fullName || "Name not detected"}
                    </h3>
                    <p className="mt-1 break-all text-sm text-stone-500">
                      {candidate.email || "Email not available"}
                    </p>
                    <p className="mt-2 text-xs text-stone-400">
                      Candidate ID: {candidate._id}
                    </p>
                  </div>
                </div>
              </section>

              {error && (
                <div
                  role="alert"
                  className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  <AlertCircle size={17} className="shrink-0" />
                  {error}
                </div>
              )}

              {notice && (
                <div
                  role="status"
                  className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                >
                  <CheckCircle2 size={17} className="shrink-0" />
                  {notice}
                </div>
              )}

              <section className="rounded-2xl border border-stone-200 bg-white p-5">
                <h3 className="font-semibold text-[#17251b]">
                  Contact information
                </h3>

                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail size={17} className="mt-0.5 text-stone-400" />
                    <div className="min-w-0">
                      <p className="text-xs text-stone-500">Email</p>
                      <p className="mt-1 break-all text-sm text-stone-800">
                        {candidate.email || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone size={17} className="mt-0.5 text-stone-400" />
                    <div>
                      <p className="text-xs text-stone-500">Phone</p>
                      <p className="mt-1 text-sm text-stone-800">
                        {candidate.phone || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CalendarDays
                      size={17}
                      className="mt-0.5 text-stone-400"
                    />
                    <div>
                      <p className="text-xs text-stone-500">Date added</p>
                      <p className="mt-1 text-sm text-stone-800">
                        {formatDate(candidate.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness size={18} className="text-stone-500" />
                  <h3 className="font-semibold text-[#17251b]">
                    Recruitment stage
                  </h3>
                </div>

                <label
                  htmlFor="candidate-profile-stage"
                  className="mt-4 block text-xs font-medium text-stone-500"
                >
                  Current stage
                </label>

                <select
                  id="candidate-profile-stage"
                  value={candidate.recruitmentStage || "new"}
                  onChange={handleStageChange}
                  disabled={updatingStage}
                  className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15 disabled:opacity-60"
                >
                  {STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>

                {updatingStage && (
                  <p className="mt-2 text-xs text-stone-500">
                    Saving stage...
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <UserRound size={18} className="text-stone-500" />
                  <h3 className="font-semibold text-[#17251b]">
                    Skills
                  </h3>
                </div>

                {skills.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {skills.map((skill, index) => (
                      <span
                        key={`${skill}-${index}`}
                        className="rounded-lg bg-[#edf3e8] px-3 py-1.5 text-sm text-[#35543b]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-stone-500">
                    No skills detected for this candidate.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-stone-500" />
                  <h3 className="font-semibold text-[#17251b]">
                    Resume
                  </h3>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <FileText size={19} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-stone-800">
                      {resume?.originalName || "Resume information unavailable"}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {resume?.originalName
                        ? "Uploaded resume"
                        : "No resume filename found"}
                    </p>
                  </div>

                  {resumeUrl && (
                    <a
                      href={resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-[#35543b] hover:bg-stone-50"
                    >
                      <Download size={14} />
                      Open
                    </a>
                  )}
                </div>
              </section>

              {candidate.experience && (
                <section className="rounded-2xl border border-stone-200 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <Clock3 size={18} className="text-stone-500" />
                    <h3 className="font-semibold text-[#17251b]">
                      Experience
                    </h3>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">
                    {typeof candidate.experience === "string"
                      ? candidate.experience
                      : JSON.stringify(candidate.experience, null, 2)}
                  </p>
                </section>
              )}
            </div>
          ) : null}
        </div>

        <footer className="border-t border-stone-200 bg-white px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-[#35543b] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#29432f]"
          >
            Close profile
          </button>
        </footer>
      </aside>
    </div>
  );
}
