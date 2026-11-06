
import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  FileUp,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import ScreeningResults from "./ScreeningResults";
import {
  getRequisitions,
  createScreeningJob,
  uploadScreeningResumes,
  completeScreeningUpload,
  startScreening,
  getScreeningJob,
  getScorecard,
generateScorecard,
saveScorecard,
  getScreeningResults,
} from "../../lib/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 500;
const ACTIVE_SCREENING_JOB_KEY = "talentlens_active_screening_job";

function getPayload(response) {
  return response?.data ?? response;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isSupportedFile(file) {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".docx");
}

export default function ScreeningPage() {
  const fileInputRef = useRef(null);
const [restoringJob, setRestoringJob] = useState(true);
  const [requisitions, setRequisitions] = useState([]);
  const [selectedRequisition, setSelectedRequisition] = useState("");
 
  const [scorecard, setScorecard] = useState(null);
const [scorecardLoading, setScorecardLoading] = useState(false);
const [scorecardSaving, setScorecardSaving] = useState(false);
const [scorecardError, setScorecardError] = useState("");
 
  const [batchName, setBatchName] = useState("");
  const [topN, setTopN] = useState(10);
  const [files, setFiles] = useState([]);
const [screeningStarted, setScreeningStarted] = useState(false);
  const [job, setJob] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [loadingRequisitions, setLoadingRequisitions] = useState(true);
  const [creatingJob, setCreatingJob] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCompleted, setUploadCompleted] = useState(false);
  const [starting, setStarting] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function loadRequisitions() {
      try {
        setLoadingRequisitions(true);
        const response = await getRequisitions();
        const payload = getPayload(response);

        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.requisitions)
            ? payload.requisitions
            : [];

        setRequisitions(items.filter((item) => item.status === "open"));
      } catch (err) {
        setError(err.message || "Unable to load requisitions.");
      } finally {
        setLoadingRequisitions(false);
      }
    }

    loadRequisitions();
  }, []);

useEffect(() => {
  if (!selectedRequisition) {
    setScorecard(null);
    setScorecardError("");
    return;
  }

  let cancelled = false;

  async function loadScorecard() {
    try {
      setScorecardLoading(true);
      setScorecardError("");
      setScorecard(null);

      // First, check whether this requisition already has a scorecard.
      const response = await getScorecard(selectedRequisition);
      const existingScorecard = getPayload(response);

      if (cancelled) return;

      if (existingScorecard?._id) {
        setScorecard(existingScorecard);
        return;
      }

      // No saved scorecard: generate AI suggestions for this requisition.
      const generatedResponse = await generateScorecard(selectedRequisition);
      const generatedScorecard = getPayload(generatedResponse);

      if (cancelled) return;

      if (
        !Array.isArray(generatedScorecard?.criteria) ||
        generatedScorecard.criteria.length === 0
      ) {
        throw new Error("AI did not return valid scorecard criteria.");
      }

      setScorecard(generatedScorecard);
    } catch (err) {
      if (!cancelled) {
        setScorecardError(
          err.message || "Unable to load or generate the scorecard.",
        );
      }
    } finally {
      if (!cancelled) {
        setScorecardLoading(false);
      }
    }
  }

  loadScorecard();

  return () => {
    cancelled = true;
  };
}, [selectedRequisition]);


useEffect(() => {
  let cancelled = false;

  async function restoreActiveJob() {
    const savedJobId = sessionStorage.getItem(
      ACTIVE_SCREENING_JOB_KEY
    );

    if (!savedJobId) {
      setRestoringJob(false);
      return;
    }

    try {
      setError("");

      // Fetch the saved batch from the backend.
      const response = await getScreeningJob(savedJobId);
      const payload = getPayload(response);

      const restoredJob = payload?.job ?? payload;

      if (!restoredJob?._id) {
        throw new Error("Saved screening batch was not found.");
      }

      if (cancelled) return;

      // Restore the active batch.
      setJob(restoredJob);
const hasStarted =  ["queued", "processing", "completed", "partially_failed", "failed"].includes(
    restoredJob.status
  )
// Boolean(restoredJob.startedAt);

setScreeningStarted(hasStarted);
      // Restore the upload summary where the job response provides counts.
      if (restoredJob.counts) {
        setUploadSummary({
          counts: restoredJob.counts,
        });
      }

      // Restore the requisition selection if available.
      if (restoredJob.requisitionId) {
        const requisitionId =
          typeof restoredJob.requisitionId === "object"
            ? restoredJob.requisitionId._id
            : restoredJob.requisitionId;

        setSelectedRequisition(requisitionId);
      }

      setNotice("Your previous screening batch has been restored.");
    } catch (err) {
      if (cancelled) return;

      console.error("Unable to restore screening batch:", err);

      sessionStorage.removeItem(ACTIVE_SCREENING_JOB_KEY);
      setJob(null);
      setUploadSummary(null);
      setError(
        "Your previous screening batch could not be restored. You can create a new batch."
      );
    } finally {
      if (!cancelled) {
        setRestoringJob(false);
      }
    }
  }

  restoreActiveJob();

  return () => {
    cancelled = true;
  };
}, []);


  const selectedJob = requisitions.find(
    (item) => item._id === selectedRequisition,
  );
const hasScreeningStarted =
  screeningStarted ||
  Boolean(job?.startedAt);
  const scorecardIsSaved = Boolean(scorecard?._id);
  function handleFileSelection(event) {
    const selectedFiles = Array.from(event.target.files || []);
    const validFiles = [];
    const rejectedFiles = [];

    for (const file of selectedFiles) {
      if (!isSupportedFile(file)) {
        rejectedFiles.push(`${file.name}: Only PDF and DOCX files are supported.`);
      } else if (file.size > MAX_FILE_SIZE) {
        rejectedFiles.push(`${file.name}: File exceeds the 5 MB limit.`);
      } else {
        validFiles.push(file);
      }
    }

    setFiles((previous) => {
      const combined = [...previous];

      for (const file of validFiles) {
        const alreadyAdded = combined.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified,
        );

        if (!alreadyAdded && combined.length < MAX_FILES) {
          combined.push(file);
        }
      }

      return combined;
    });

    if (rejectedFiles.length) {
      setError(rejectedFiles.join("\n"));
    } else {
      setError("");
    }

    event.target.value = "";
  }

  function removeFile(index) {
    setFiles((previous) => previous.filter((_, i) => i !== index));
  }

    function updateScorecardCriterion(index, field, value) {
    setScorecard((previous) => {
      if (!previous) return previous;

      const updatedCriteria = previous.criteria.map((criterion, i) =>
        i === index
          ? {
              ...criterion,
              [field]: field === "weight" ? value : value,
            }
          : criterion,
      );

      return { ...previous, criteria: updatedCriteria };
    });
  }

  function rebalanceCriteria(criteria) {
    if (!criteria.length) return criteria;

    const total = criteria.reduce(
      (sum, criterion) => sum + Number(criterion.weight || 0),
      0,
    );

    if (total <= 0) {
      const equalWeight = 100 / criteria.length;

      return criteria.map((criterion, index) => ({
        ...criterion,
        weight:
          index === criteria.length - 1
            ? Number((100 - equalWeight * (criteria.length - 1)).toFixed(2))
            : Number(equalWeight.toFixed(2)),
      }));
    }

    let assigned = 0;

    return criteria.map((criterion, index) => {
      const weight =
        index === criteria.length - 1
          ? Number((100 - assigned).toFixed(2))
          : Number(((Number(criterion.weight || 0) / total) * 100).toFixed(2));

      assigned += weight;

      return { ...criterion, weight };
    });
  }

  function addScorecardCriterion() {
    setScorecard((previous) => {
      if (!previous || previous.criteria.length >= 15) return previous;

      const existing = previous.criteria;
      const currentTotal = existing.reduce(
        (sum, criterion) => sum + Number(criterion.weight || 0),
        0,
      );

      const targetExistingWeight = 90;

      const adjustedExisting = existing.map((criterion, index) => {
        const weight =
          currentTotal > 0
            ? Number(
                (
                  (Number(criterion.weight || 0) / currentTotal) *
                  targetExistingWeight
                ).toFixed(2),
              )
            : Number((targetExistingWeight / existing.length).toFixed(2));

        return { ...criterion, weight };
      });

      // Correct rounding on the existing criteria so they total exactly 90.
      const adjustedTotal = adjustedExisting.reduce(
        (sum, criterion) => sum + criterion.weight,
        0,
      );

      adjustedExisting[adjustedExisting.length - 1].weight = Number(
        (
          adjustedExisting[adjustedExisting.length - 1].weight +
          (targetExistingWeight - adjustedTotal)
        ).toFixed(2),
      );

      return {
        ...previous,
        criteria: [
          ...adjustedExisting,
          {
            name: "",
            description: "",
            weight: 10,
          },
        ],
      };
    });
  }

  function removeScorecardCriterion(index) {
    setScorecard((previous) => {
      if (!previous || previous.criteria.length <= 1) return previous;

      const remaining = previous.criteria.filter((_, i) => i !== index);

      return {
        ...previous,
        criteria: rebalanceCriteria(remaining),
      };
    });
  }

  async function handleSaveScorecard() {
    if (!selectedRequisition || !scorecard) return;

    const criteria = scorecard.criteria;
    const totalWeight = criteria.reduce(
      (sum, criterion) => sum + Number(criterion.weight || 0),
      0,
    );

    if (criteria.length < 1 || criteria.length > 15) {
      setScorecardError("A scorecard must contain between 1 and 15 criteria.");
      return;
    }

    if (
      criteria.some(
        (criterion) =>
          !criterion.name?.trim() ||
          !criterion.description?.trim() ||
          !Number.isFinite(Number(criterion.weight)) ||
          Number(criterion.weight) <= 0 ||
          Number(criterion.weight) > 100,
      )
    ) {
      setScorecardError(
        "Every criterion needs a name, description, and positive weight.",
      );
      return;
    }

    if (Math.abs(totalWeight - 100) > 0.01) {
      setScorecardError(
        `The weights must total 100%. Current total: ${totalWeight.toFixed(2)}%.`,
      );
      return;
    }

    try {
      setScorecardSaving(true);
      setScorecardError("");

      const response = await saveScorecard(
        selectedRequisition,
        criteria.map((criterion) => ({
          name: criterion.name.trim(),
          description: criterion.description.trim(),
          weight: Number(criterion.weight),
        })),
      );

      const savedScorecard = getPayload(response);

      if (!savedScorecard?._id) {
        throw new Error("The server did not return the saved scorecard.");
      }

      setScorecard(savedScorecard);
      setNotice("Scorecard saved successfully for this requisition.");
    } catch (err) {
      setScorecardError(
        err.message || "Unable to save the scorecard.",
      );
    } finally {
      setScorecardSaving(false);
    }
  }

  async function handleCreateAndUpload() {
    setError("");
    setNotice("");
setUploadCompleted(false);
    if (!selectedRequisition) {
      setError("Please select an open requisition.");
      return;
    }

    if (!batchName.trim()) {
      setError("Please enter a screening batch name.");
      return;
    }

    if (files.length === 0) {
      setError("Please select at least one resume.");
      return;
    }

    if (topN < 1 || topN > 500) {
      setError("Shortlist count must be between 1 and 500.");
      return;
    }

    try {
      setCreatingJob(true);

      const createResponse = await createScreeningJob({
        requisitionId: selectedRequisition,
        name: batchName.trim(),
        topN: Number(topN),
      });

      const createdJob = getPayload(createResponse);
      const jobId = createdJob?._id || createdJob?.job?._id;

      if (!jobId) {
        throw new Error(
          "The server created no identifiable screening job. Check the create-job API response.",
        );
      }
      sessionStorage.setItem(
  ACTIVE_SCREENING_JOB_KEY,
  jobId
);

      setJob({ ...createdJob, _id: jobId });
      setCreatingJob(false);
      setUploading(true);

      const uploadResponse = await uploadScreeningResumes(jobId, files);
      const uploadData = getPayload(uploadResponse);

      setUploadSummary(uploadData);
setUploadCompleted(true);

      await completeScreeningUpload(jobId);

      setNotice("Upload completed. Review the summary before starting AI screening.");
    } catch (err) {
      setError(err.message || "Something went wrong while creating the batch.");
    } finally {
      setCreatingJob(false);
      setUploading(false);
    }
  }

  async function handleStartScreening() {
    if (!job?._id) return;

    try {
      setStarting(true);
      setError("");

      await startScreening(job._id);
setScreeningStarted(true);
      setNotice("AI screening has started. Results will appear as resumes are evaluated.");
    } catch (err) {
      setError(err.message || "Unable to start screening.");
    } finally {
      setStarting(false);
    }
  }

  function resetBatch() {
    setJob(null);
    setUploadSummary(null);
    setFiles([]);
    setBatchName("");
    setTopN(10);
    setError("");
    setUploadCompleted(false);
    sessionStorage.removeItem(
  ACTIVE_SCREENING_JOB_KEY
);
    setNotice("");
    setSelectedRequisition("");
    setScreeningStarted(false);
  }

  const summary = uploadSummary?.counts || uploadSummary || {};
const activeStep =
  screeningStarted ||
  ["queued", "processing", "completed", "partially_failed", "failed"].includes(
    job?.status
  )
    ? 2
    : job
      ? 1
      : 0;
  return (
     <div className="mx-auto max-w-7xl space-y-7 p-7">
    {restoringJob ? (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <LoaderCircle
          size={30}
          className="animate-spin text-[#536b45]"
        />
        <p className="text-sm text-stone-500">
          Restoring your previous screening batch...
        </p>
      </div>
    ) : (
    <div className="mx-auto max-w-7xl space-y-7 p-7">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          {/* <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#647a50]">
            <BrainCircuit size={17} />
            TALENTLENS AI
          </div> */}

          <h1 className="text-2xl font-bold tracking-tight text-[#17251b]">
            AI Resume Screening
          </h1>

          <p className="mt-1 text-sm text-stone-500">
            Screen resumes against your job requirements and identify the
            strongest candidates.
          </p>
        </div>

        {job && (
          <button
            onClick={resetBatch}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            <Plus size={16} />
            New screening batch
          </button>
        )}
      </div>

      {/* Error and success messages */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p className="whitespace-pre-line">{error}</p>
          <button onClick={() => setError("")} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{notice}</p>
        </div>
      )}

      {/* Workflow indicator */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-stone-200 bg-white p-4">
        {[
          { number: "01", label: "Configure batch" },
          { number: "02", label: "Upload resumes" },
          { number: "03", label: "AI evaluation" },
        ].map((step, index) => (
          <div key={step.number} className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                 index === activeStep
      ? "bg-[#263d2b] text-white"
      : index < activeStep
        ? "bg-[#e9eee2] text-[#263d2b]"
        : "bg-stone-100 text-stone-500"
              }`}
            >
              {step.number}
            </span>
            <span className="text-xs font-medium text-stone-600 sm:text-sm">
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {!job ? (
        <>
          {/* Batch configuration */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#17251b]">
                Configure screening batch
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Choose a job requisition and define how many candidates you
                want to shortlist.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-stone-700">
                  Job requisition
                </label>

                <div className="relative">
                  <BriefcaseBusiness
                    size={17}
                    className="absolute left-3 top-3.5 text-stone-400"
                  />

                  <select
                    value={selectedRequisition}
                   onChange={(event) => {
  setSelectedRequisition(event.target.value);
  setError("");
}}
                    disabled={loadingRequisitions}
                    className="w-full appearance-none rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#71865b] focus:ring-2 focus:ring-[#71865b]/10"
                  >
                    <option value="">
                      {loadingRequisitions
                        ? "Loading requisitions..."
                        : "Select an open requisition"}
                    </option>

                    {requisitions.map((requisition) => (
                      <option key={requisition._id} value={requisition._id}>
                        {requisition.title} — {requisition.clientName}
                      </option>
                    ))}
                  </select>
                </div>

                {!loadingRequisitions && requisitions.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    No open requisitions found. Create or reopen a requisition
                    before screening resumes.
                  </p>
                )}

                {selectedJob && (
                  <div className="mt-3 rounded-xl bg-[#f7f8f5] p-4">
                    <p className="text-sm font-semibold text-[#263d2b]">
                      {selectedJob.title}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-500">
                      <span>{selectedJob.clientName}</span>
                      <span>{selectedJob.location}</span>
                      <span>
                        Experience: {selectedJob.minExperience ?? 0}–
                        {selectedJob.maxExperience ?? "Any"} years
                      </span>
                      <span>
                        Notice period: {selectedJob.noticePeriodDays ?? "—"} days
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">
                  Batch name
                </label>
               <input
  value={batchName}
  onChange={(event) => {
    setBatchName(event.target.value);
    setError("");
  }}
  placeholder="e.g. November 2026 - SDE Applicants"
  maxLength={100}
  className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-[#71865b] focus:ring-2 focus:ring-[#71865b]/10"
/>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">
                  Shortlist candidates
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={topN}
                  onChange={(event) => setTopN(event.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-[#71865b] focus:ring-2 focus:ring-[#71865b]/10"
                />
                <p className="mt-1.5 text-xs text-stone-400">
                  Maximum 500 candidates.
                </p>
              </div>
            </div>
          </section>
          {/* Requisition scorecard */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#17251b]">
                    Evaluation scorecard
                  </h2>
                  <span className="rounded-full bg-[#e9eee2] px-2.5 py-1 text-xs font-semibold text-[#435b36]">
                    Requisition-based
                  </span>
                </div>

                <p className="mt-1 text-sm text-stone-500">
                  Define the criteria TalentLens AI will use to evaluate every
                  candidate for this requisition.
                </p>
              </div>

              {scorecard?.lockedAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <ShieldAlert size={14} />
                  Locked after screening started
                </span>
              )}
            </div>

            {!selectedRequisition ? (
              <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
                Select a requisition to load its evaluation scorecard.
              </p>
            ) : scorecardLoading ? (
              <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-5 text-sm text-stone-500">
                <LoaderCircle size={18} className="animate-spin" />
                Loading or generating evaluation criteria...
              </div>
            ) : scorecardError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{scorecardError}</p>
                <button
                  type="button"
                  onClick={() => setSelectedRequisition((value) => value)}
                  className="mt-2 text-sm font-semibold text-red-700 underline"
                >
                  Try again
                </button>
              </div>
            ) : scorecard ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-stone-500">
                    {scorecard.generatedByAI
                      ? "AI-generated suggestions — review and save before uploading."
                      : "Saved scorecard for this requisition."}
                  </p>

                  <p className="text-sm font-semibold text-[#263d2b]">
                    Total:{" "}
                    {scorecard.criteria
                      .reduce(
                        (sum, criterion) =>
                          sum + Number(criterion.weight || 0),
                        0,
                      )
                      .toFixed(2)}
                    %
                  </p>
                </div>

                <div className="space-y-4">
                  {scorecard.criteria.map((criterion, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-stone-200 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#263d2b]">
                          Criterion {index + 1}
                        </p>

                        {!scorecard.lockedAt && (
                          <button
                            type="button"
                            onClick={() => removeScorecardCriterion(index)}
                            disabled={scorecard.criteria.length <= 1}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <X size={14} />
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-[1fr_130px]">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-stone-600">
                            Criterion name
                          </label>
                          <input
                            value={criterion.name}
disabled={scorecardIsSaved || Boolean(scorecard.lockedAt)}
                            onChange={(event) =>
                              updateScorecardCriterion(
                                index,
                                "name",
                                event.target.value,
                              )
                            }
                            maxLength={120}
                            placeholder="e.g. Technical proficiency"
                            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-[#71865b] disabled:bg-stone-50 disabled:text-stone-500"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-stone-600">
                            Weight (%)
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={criterion.weight}
disabled={scorecardIsSaved || Boolean(scorecard.lockedAt)}
                            onChange={(event) =>
                              updateScorecardCriterion(
                                index,
                                "weight",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-[#71865b] disabled:bg-stone-50 disabled:text-stone-500"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="mb-1.5 block text-xs font-semibold text-stone-600">
                          What should be evaluated?
                        </label>
                        <textarea
                          value={criterion.description}
disabled={scorecardIsSaved || Boolean(scorecard.lockedAt)}
                          onChange={(event) =>
                            updateScorecardCriterion(
                              index,
                              "description",
                              event.target.value,
                            )
                          }
                          rows={2}
                          maxLength={1000}
                          placeholder="Describe the skills or evidence expected from candidates..."
                          className="w-full resize-y rounded-lg border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-[#71865b] disabled:bg-stone-50 disabled:text-stone-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {scorecardIsSaved && (
  <div className="mt-4 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
    <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
    <p>
      <span className="font-semibold">Scorecard saved successfully.</span>
      {" "}This scorecard is now read-only and will be used for candidate evaluation.
    </p>
  </div>
)}

               {!scorecardIsSaved && (
                  <>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={addScorecardCriterion}
                        disabled={scorecard.criteria.length >= 15}
                        className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                      >
                        <Plus size={16} />
                        Add criterion
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveScorecard}
                        disabled={
                          scorecardSaving ||
                          scorecardLoading ||
                          Math.abs(
                            scorecard.criteria.reduce(
                              (sum, criterion) =>
                                sum + Number(criterion.weight || 0),
                              0,
                            ) - 100
                          ) > 0.01
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#263d2b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#354e39] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {scorecardSaving && (
                          <LoaderCircle size={16} className="animate-spin" />
                        )}
                        {scorecardSaving ? "Saving..." : "Save scorecard"}
                      </button>
                    </div>

                    <p className="mt-3 text-xs text-stone-500">
                      You must save the scorecard before creating a screening
                      batch. Once screening starts for this requisition, the
                      scorecard should be locked.
                    </p>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-stone-500">
                No scorecard is available yet.
              </p>
            )}
          </section>
          {/* Resume upload */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-[#17251b]">
                Upload candidate resumes
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Add PDF or DOCX resumes. You can select multiple files at once.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              onChange={handleFileSelection}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-[#fafbf8] px-5 py-10 text-center transition hover:border-[#71865b] hover:bg-[#f5f7f0]"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e9eee2] text-[#435b36]">
                <UploadCloud size={25} />
              </div>
              <p className="text-sm font-semibold text-[#263d2b]">
                Click to browse resumes
              </p>
              <p className="mt-1 text-xs text-stone-500">
                PDF and DOCX · Maximum 5 MB per file · Up to 500 files
              </p>
            </button>

            {files.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-stone-700">
                    Selected resumes ({files.length})
                  </p>
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    Remove all
                  </button>
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-stone-100 p-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f2eb] text-[#536b45]">
                        <FileText size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-700">
                          {file.name}
                        </p>
                        <p className="text-xs text-stone-400">
                          {formatBytes(file.size)}
                        </p>
                      </div>

                      <button
                        onClick={() => removeFile(index)}
                        className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col justify-between gap-4 border-t border-stone-100 pt-5 sm:flex-row sm:items-center">
              <p className="text-xs text-stone-500">
                Resumes are uploaded first. AI evaluation starts only when you
                explicitly request it.
              </p>

              <button
                onClick={handleCreateAndUpload}
                disabled={
                  creatingJob ||
                  uploading ||
                  loadingRequisitions ||
                  requisitions.length === 0 ||!scorecard?._id || scorecardLoading || scorecardSaving
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#263d2b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#354e39] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingJob || uploading ? (
                  <>
                    <LoaderCircle size={17} className="animate-spin" />
                    {creatingJob ? "Creating batch..." : "Uploading resumes..."}
                  </>
                ) : (
                  <>
                    <FileUp size={17} />
                    Create batch & upload
                  </>
                )}
              </button>
            </div>
          </section>
        </>
      ) : (
        /* Upload summary */
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                <CheckCircle2 size={14} />
                Upload submitted
              </div>

              <h2 className="text-xl font-bold text-[#17251b]">
                {job.name || batchName}
              </h2>
              {/* <p className="mt-1 text-sm text-stone-500">
                Batch ID: {job._id}
              </p> */}
            </div>

       <button
  onClick={handleStartScreening}
disabled={
  starting ||
  uploading ||
  !uploadCompleted ||
  hasScreeningStarted
}
  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#263d2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#354e39] disabled:cursor-not-allowed disabled:opacity-50"
>
  {starting ? (
    <LoaderCircle size={17} className="animate-spin" />
  ) : (
    <Sparkles size={17} />
  )}
{starting
  ? "Starting..."
  : hasScreeningStarted
    ? "Screening already started"
    : uploading
      ? "Uploading resumes..."
      : !uploadCompleted
        ? "Waiting for upload..."
        : "Start AI screening"}
</button>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Uploaded",
                value: summary.uploaded ?? files.length,
                icon: FileText,
              },
              {
                label: "Duplicates",
                value: summary.duplicate ?? summary.duplicates ?? 0,
                icon: RefreshCw,
              },
              {
                label: "Rejected",
                value: summary.rejected ?? 0,
                icon: ShieldAlert,
              },
              {
                label: "Queued",
                value: summary.queued ?? 0,
                icon: BrainCircuit,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-stone-100 bg-[#fafbf8] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-stone-500">
                      {item.label}
                    </span>
                    <Icon size={17} className="text-stone-400" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-[#263d2b]">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl bg-[#f5f7f0] p-4">
            <div className="flex items-start gap-3">
              <Sparkles size={19} className="mt-0.5 shrink-0 text-[#607b4b]" />
              <div>
                <p className="text-sm font-semibold text-[#263d2b]">
                  Ready for AI evaluation?
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-600">
                  Starting screening will add eligible resumes to the
                  evaluation queue. TalentLens AI will compare candidates
                  against the selected requisition and generate scores,
                  recommendations, strengths, and concerns.
                </p>
              </div>
            </div>
          </div>
        </section>


      )}
      {screeningStarted && (
  <ScreeningResults jobId={job._id} />
)}
    </div>
    )}
    </div>
  );
}
