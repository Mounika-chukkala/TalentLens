import { useEffect, useState } from "react";
import { Activity, BriefcaseBusiness, CalendarDays, Users, UserRoundCheck } from "lucide-react";
import WorkspaceLayout from "../../layouts/WorkspaceLayout";
import { recruiterNavigation } from "../../components/layout/navigation";
import OverviewPage from "./OverviewPage";
import RequisitionsPage from "../requisitions/RequisitionsPage";
import CreateRequisitionModal from "../requisitions/components/CreateRequisitionModal";
import CandidatesPage from "../candidates/CandidatesPage";
import CandidatePipelinePage from "../candidates/CandidatePipelinePage";
import {
  createRequisition,
  getCandidates,
  getRequisitions,
} from "../../lib/api";
import ScreeningPage from "../screenings/ScreeningPage";
const pageTitles = {
  overview: "Dashboard",
  requisitions: "Requisitions",
  candidates: "Candidates",
  pipeline: "Hiring pipeline",
  screenings: "Screenings",
  "client-reviews": "Client reviews",
  settings: "Settings",
  help: "Help & support",
};

export default function RecruiterDashboard({ user, onSignOut }) {
  const [currentPage, setCurrentPage] = useState("overview");
  const [requisitions, setRequisitions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [candidateCount, setCandidateCount] = useState(null);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [loadingRequisitions, setLoadingRequisitions] = useState(true);
  const [requisitionError, setRequisitionError] = useState("");
  const [candidateToOpen, setCandidateToOpen] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  async function loadRequisitions() {
    setLoadingRequisitions(true);
    setRequisitionError("");
    try {
      const result = await getRequisitions();
      setRequisitions(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      setRequisitionError(error instanceof Error ? error.message : "Unable to load requisitions.");
    } finally {
      setLoadingRequisitions(false);
    }
  }

  useEffect(() => {
    loadRequisitions();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCandidateData() {
      setLoadingCandidates(true);
      try {
        const result = await getCandidates();
        if (!cancelled) {
          const rows = Array.isArray(result.data) ? result.data : [];
          setCandidates(rows);
          setCandidateCount(rows.length);
        }
      } catch (error) {
        console.error("Failed to load candidates:", error);
      } finally {
        if (!cancelled) setLoadingCandidates(false);
      }
    }
    loadCandidateData();
    return () => { cancelled = true; };
  }, []);

async function handleCreateRequisition(event) {
  event.preventDefault();
  setCreateError("");

  const form = event.currentTarget;
  const formData = new FormData(form);

  const payload = {
    title: String(formData.get("title") || "").trim(),
    clientOrganizationId: String(
      formData.get("clientOrganizationId") || "",
    ).trim(),
    location: String(formData.get("location") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    minExperience: Number(formData.get("minExperience")),
    maxExperience: Number(formData.get("maxExperience")),
    noticePeriodDays: Number(formData.get("noticePeriodDays")),
  };

  if (!payload.clientOrganizationId) {
    setCreateError("Please select a client organization.");
    return;
  }

  if (payload.maxExperience < payload.minExperience) {
    setCreateError(
      "Maximum experience must be at least minimum experience.",
    );
    return;
  }

  setCreateSaving(true);

  try {
    await createRequisition(payload);

    form.reset();
    setCreateModalOpen(false);
    setCurrentPage("requisitions");

    await loadRequisitions();
  } catch (error) {
    setCreateError(
      error instanceof Error
        ? error.message
        : "Unable to create requisition.",
    );
  } finally {
    setCreateSaving(false);
  }
}
  const metrics = [
    {
      label: "Active requisitions",
      value: loadingRequisitions ? "—" : requisitions.filter((job) => job.status === "open").length,
      change: loadingRequisitions ? "Loading from database..." : "Live count from MongoDB",
      icon: BriefcaseBusiness,
    },
    {
      label: "Candidates reviewed",
      value: loadingCandidates ? "—" : candidateCount ?? "—",
      change: loadingCandidates ? "Loading from database..." : "Live count from MongoDB",
      icon: Users,
    },
    { label: "Client decisions", value: "08", change: "Illustrative sample data", icon: UserRoundCheck },
    { label: "Interviews scheduled", value: "14", change: "Illustrative sample data", icon: CalendarDays },
  ];

  function openCreateModal() {
    setCreateError("");
    setCreateModalOpen(true);
  }

  function renderPage() {
    if (currentPage === "overview") {
      return (
        <OverviewPage
          user={user}
          metrics={metrics}
          requisitions={requisitions}
          loadingRequisitions={loadingRequisitions}
          requisitionError={requisitionError}
          candidates={candidates}
          onCreateRequisition={openCreateModal}
          onOpenRequisitions={() => setCurrentPage("requisitions")}
          onOpenCandidates={() => setCurrentPage("candidates")}
          onOpenPipeline={() => setCurrentPage("pipeline")}
          onRetryRequisitions={loadRequisitions}
        />
      );
    }
    if (currentPage === "requisitions") {
      return <RequisitionsPage onCreateRequisition={openCreateModal} />;
    }
    if (currentPage === "candidates") {
      return (
        <CandidatesPage
          candidateToOpen={candidateToOpen}
          onCandidateOpened={() => setCandidateToOpen(null)}
        />
      );
    }
    if (currentPage === "pipeline") {
      return (
        <CandidatePipelinePage
          onOpenCandidate={(candidateId) => {
            setCandidateToOpen(candidateId);
            setCurrentPage("candidates");
          }}
        />
      );
    }
    if (currentPage === "screenings") {
  return <ScreeningPage />;
}
    return (
      <main className="mx-auto max-w-5xl p-5 md:p-9">
        <div className="rounded-xl border border-stone-200 bg-white p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#55734b]">TalentLens workspace</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">{pageTitles[currentPage] || "Workspace"}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500">
            This section is not connected yet. We will implement it after the core recruiter and client workflows.
          </p>
          <button type="button" onClick={() => setCurrentPage("overview")} className="mt-6 rounded-lg bg-[#17251b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2b4030]">
            Back to overview
          </button>
        </div>
      </main>
    );
  }

  return (
    <WorkspaceLayout
      navigation={recruiterNavigation}
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      user={user}
      roleLabel="Recruiter"
      onSignOut={onSignOut}
      pageTitle={pageTitles[currentPage] || "Workspace"}
      requisitionCount={requisitions.length}
      loadingRequisitions={loadingRequisitions}
      onActivity={() => setCurrentPage("pipeline")}
    >
      {renderPage()}
      <CreateRequisitionModal
        open={createModalOpen}
        saving={createSaving}
        error={createError}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateRequisition}
      />
    </WorkspaceLayout>
  );
}
