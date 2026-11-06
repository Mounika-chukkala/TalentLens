
import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  BriefcaseBusiness,
  CalendarDays,
  Users,
  UserRoundCheck,
} from "lucide-react";

import WorkspaceLayout from "../../layouts/WorkspaceLayout";
import { recruiterNavigation } from "../../components/layout/navigation";

import OverviewPage from "./OverviewPage";
import RequisitionsPage from "../requisitions/RequisitionsPage";
import CreateRequisitionModal from "../requisitions/components/CreateRequisitionModal";
import CandidatesPage from "../candidates/CandidatesPage";
import CandidatePipelinePage from "../candidates/CandidatePipelinePage";
import ScreeningPage from "../screenings/ScreeningPage";
import RequisitionDetailPage from "../requisitions/RequisitionDetailPage";
import {
  createRequisition,
  getCandidates,
  inviteClientContact,
  getRequisitions,
} from "../../lib/api";

const pageTitles = {
  "/overview": "Dashboard",
  "/requisitions": "Requisitions",
  "/candidates": "Candidates",
  "/screenings": "AI Resume Screening",
  "/pipeline": "Hiring pipeline",
  "/client-reviews": "Client reviews",
};

export default function RecruiterDashboard({ user, onSignOut }) {
  const navigate = useNavigate();
  const location = useLocation();

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
  const [createNotice, setCreateNotice] = useState("");

  const [pendingInvitation, setPendingInvitation] = useState(null);
  const [retryingInvitation, setRetryingInvitation] = useState(false);

  async function loadRequisitions() {
    setLoadingRequisitions(true);
    setRequisitionError("");

    try {
      const result = await getRequisitions();
      setRequisitions(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      setRequisitionError(
        error instanceof Error
          ? error.message
          : "Unable to load requisitions."
      );
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
        if (!cancelled) {
          setLoadingCandidates(false);
        }
      }
    }

    loadCandidateData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateRequisition(event) {
    event.preventDefault();

    setCreateError("");
    setCreateNotice("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      title: String(formData.get("title") || "").trim(),
      clientOrganizationId: String(
        formData.get("clientOrganizationId") || ""
      ).trim(),
      location: String(formData.get("location") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      minExperience: Number(formData.get("minExperience")),
      maxExperience: Number(formData.get("maxExperience")),
      noticePeriodDays: Number(formData.get("noticePeriodDays")),
    };

    const invitation = {
      email: String(formData.get("clientContactEmail") || "")
        .trim()
        .toLowerCase(),
      clientOrganizationId: payload.clientOrganizationId,
    };

    if (!payload.clientOrganizationId) {
      setCreateError("Please select a client organization.");
      return;
    }

    if (!invitation.email) {
      setCreateError("Please enter the client contact email.");
      return;
    }

    if (payload.maxExperience < payload.minExperience) {
      setCreateError(
        "Maximum experience must be at least minimum experience."
      );
      return;
    }

    setCreateSaving(true);

    try {
      await createRequisition(payload);

      form.reset();
      setCreateModalOpen(false);

      await loadRequisitions();
      navigate("/requisitions");

      try {
        await inviteClientContact(invitation);

        setPendingInvitation(null);
        setCreateNotice(
          `Requisition created successfully. Invitation sent to ${invitation.email}.`
        );
      } catch (inviteError) {
        setPendingInvitation(invitation);
        setCreateNotice(
          `Requisition created successfully, but the invitation to ${invitation.email} failed: ${
            inviteError.message || "Unknown email error"
          }`
        );
      }
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Unable to create requisition."
      );
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleRetryInvitation() {
    if (!pendingInvitation || retryingInvitation) return;

    setRetryingInvitation(true);

    try {
      await inviteClientContact(pendingInvitation);

      setCreateNotice(
        `Invitation successfully sent to ${pendingInvitation.email}.`
      );

      setPendingInvitation(null);
    } catch (error) {
      setCreateNotice(
        `Invitation retry failed: ${
          error.message || "Unable to send email."
        }`
      );
    } finally {
      setRetryingInvitation(false);
    }
  }

  const metrics = [
    {
      label: "Active requisitions",
      value: loadingRequisitions
        ? "—"
        : requisitions.filter((job) => job.status === "open").length,
      change: loadingRequisitions
        ? "Loading from database..."
        : "Live count from MongoDB",
      icon: BriefcaseBusiness,
    },
    {
      label: "Candidates reviewed",
      value: loadingCandidates ? "—" : candidateCount ?? "—",
      change: loadingCandidates
        ? "Loading from database..."
        : "Live count from MongoDB",
      icon: Users,
    },
    {
      label: "Client decisions",
      value: "08",
      change: "Illustrative sample data",
      icon: UserRoundCheck,
    },
    {
      label: "Interviews scheduled",
      value: "14",
      change: "Illustrative sample data",
      icon: CalendarDays,
    },
  ];

  function openCreateModal() {
    setCreateError("");
    setCreateModalOpen(true);
  }

  const currentPath = location.pathname.replace(/\/$/, "") || "/overview";

  const pageTitle =
    currentPath.startsWith("/requisitions/")
      ? "Requisition details"
      : pageTitles[currentPath] || "TalentLens workspace";

  return (
    <WorkspaceLayout
      navigation={recruiterNavigation}
      user={user}
      roleLabel="Recruiter"
      onSignOut={onSignOut}
      pageTitle={pageTitle}
      requisitionCount={requisitions.length}
      loadingRequisitions={loadingRequisitions}
      onActivity={() => navigate("/pipeline")}
    >
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/overview" replace />}
        />

        <Route
          path="/overview"
          element={
            <OverviewPage
              user={user}
              metrics={metrics}
              requisitions={requisitions}
              loadingRequisitions={loadingRequisitions}
              requisitionError={requisitionError}
              candidates={candidates}
              onCreateRequisition={openCreateModal}
              onOpenRequisitions={() => navigate("/requisitions")}
              onOpenCandidates={() => navigate("/candidates")}
              onOpenPipeline={() => navigate("/pipeline")}
              onRetryRequisitions={loadRequisitions}
            />
          }
        />

        <Route
          path="/requisitions"
          element={
            <RequisitionsPage
              onCreateRequisition={openCreateModal}
              createNotice={createNotice}
              pendingInvitation={pendingInvitation}
              retryingInvitation={retryingInvitation}
              onRetryInvitation={handleRetryInvitation}
            />
          }
        />

<Route
  path="/requisitions/:requisitionId"
  element={<RequisitionDetailPage />}
/>

        <Route
          path="/candidates"
          element={
            <CandidatesPage
              candidateToOpen={candidateToOpen}
              onCandidateOpened={() => setCandidateToOpen(null)}
            />
          }
        />

        <Route
          path="/pipeline"
          element={
            <CandidatePipelinePage
              onOpenCandidate={(candidateId) => {
                setCandidateToOpen(candidateId);
                navigate("/candidates");
              }}
            />
          }
        />

        <Route
          path="/screenings"
          element={<ScreeningPage />}
        />

        <Route
          path="/client-reviews"
          element={
            <WorkspacePlaceholder
              title="Client reviews"
              onBack={() => navigate("/overview")}
            />
          }
        />

        <Route
          path="*"
          element={<Navigate to="/overview" replace />}
        />
      </Routes>

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

function RequisitionRoutePlaceholder() {
  const { requisitionId } = useParams();

  return (
    <WorkspacePlaceholder
      title="Requisition details"
      description={`Requisition ID: ${requisitionId}. The full detail page will be connected next.`}
    />
  );
}

function WorkspacePlaceholder({ title, description, onBack }) {
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-5xl p-5 md:p-9">
      <div className="rounded-xl border border-stone-200 bg-white p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#55734b]">
          TalentLens workspace
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          {title}
        </h2>

        <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500">
          {description || "This section will be connected in a later step."}
        </p>

        <button
          type="button"
          onClick={onBack || (() => navigate("/overview"))}
          className="mt-6 rounded-lg bg-[#17251b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2b4030]"
        >
          Back to overview
        </button>
      </div>
    </main>
  );
}
