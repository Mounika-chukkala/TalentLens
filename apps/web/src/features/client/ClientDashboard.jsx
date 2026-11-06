
import { useCallback, useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getClientSubmissions,
  getRequisitions,
  getRequisitionById,
  updateClientCandidateFeedback,
} from "../../lib/api";

import WorkspaceLayout from "../../layouts/WorkspaceLayout";
import { clientNavigation } from "../../components/layout/navigation";
import ClientRequisitions from "./ClientRequisitions";
import CandidateSubmissionCard from "./CandidateSubmissionCard";

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

function CandidateCard({ candidate, submissionId, onFeedback, saving }) {
  const snapshot = candidate.candidateSnapshot || {};
  const [feedbackNote, setFeedbackNote] = useState(
    candidate.feedbackNote || "",
  );

  const selectedFeedback = candidate.feedback || null;

  const handleFeedback = async (feedback) => {
    await onFeedback(submissionId, candidate._id, feedback, feedbackNote);
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

function ClientSubmissions({
  submissions,
  loading,
  error,
  loadSubmissions,
  handleFeedback,
  savingCandidateId,
  feedbackError,
}) {
  return (
    <>
      <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">
            Candidate submissions
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Review candidates submitted by your recruitment team.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSubmissions}
          disabled={loading}
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section className="mt-7">
        {loading ? (
          <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
            Loading candidate submissions...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={loadSubmissions}
              className="mt-3 text-sm font-semibold text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : submissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <h3 className="font-semibold text-stone-800">
              No candidates submitted yet
            </h3>
            <p className="mt-2 text-sm text-stone-500">
              Candidates shortlisted by your recruitment team will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs text-stone-500">Submission rounds</p>
                <p className="mt-1 text-2xl font-semibold text-stone-900">
                  {submissions.length}
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs text-stone-500">Candidates received</p>
                <p className="mt-1 text-2xl font-semibold text-stone-900">
                  {submissions.reduce(
                    (total, item) => total + (item.candidates?.length || 0),
                    0,
                  )}
                </p>
              </div>

              <div className="col-span-2 rounded-xl border border-stone-200 bg-white p-4 sm:col-span-1">
                <p className="text-xs text-stone-500">Awaiting feedback</p>
                <p className="mt-1 text-2xl font-semibold text-amber-600">
                  {submissions.reduce(
                    (total, item) =>
                      total +
                      (item.candidates || []).filter(
                        (candidate) => !candidate.feedback,
                      ).length,
                    0,
                  )}
                </p>
              </div>
            </div>

            {feedbackError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {feedbackError}
              </div>
            )}

            <div className="space-y-6">
              {submissions.map((submission) => (
                <section
                  key={submission._id}
                  className="overflow-hidden rounded-xl border border-stone-200 bg-white"
                >
                  <div className="border-b border-stone-100 bg-stone-50 p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#55734b]">
                          {submission.requisitionId?.title || "Requisition"}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-stone-900">
                          {submission.title ||
                            `Submission Round ${submission.round}`}
                        </h3>
                        <p className="mt-1 text-xs text-stone-500">
                          Round {submission.round} · Submitted{" "}
                          {formatDate(submission.submittedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-medium capitalize text-stone-700">
                          {submission.status || "submitted"}
                        </span>
                        <span className="text-sm text-stone-500">
                          {submission.candidates?.length || 0} candidates
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 sm:p-5">
                    {submission.candidates?.map((candidate) => (
                      <CandidateCard
                        key={candidate._id}
                        candidate={candidate}
                        submissionId={submission._id}
                        onFeedback={handleFeedback}
                        saving={savingCandidateId === candidate._id}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function ClientRequisitionDetail({
  requisitions,
  submissions,
  selectedRequisition,
  detailLoading,
  detailError,
  loadRequisitionDetail,
  handleFeedback,
  savingCandidateId,
}) {
  const { requisitionId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (requisitionId) {
      loadRequisitionDetail(requisitionId);
    }
  }, [requisitionId, loadRequisitionDetail]);

  return (
    <ClientRequisitions
      mode="detail"
      requisitions={requisitions}
      submissions={submissions}
      selectedRequisition={selectedRequisition}
      selectedRequisitionId={requisitionId}
      detailLoading={detailLoading}
      detailError={detailError}
      loadRequisitionDetail={loadRequisitionDetail}
      goBackToRequisitions={() => navigate("/client/requisitions")}
      handleFeedback={handleFeedback}
      savingCandidateId={savingCandidateId}
    />
  );
}

export default function ClientDashboard({ user, onSignOut }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingCandidateId, setSavingCandidateId] = useState(null);
  const [feedbackError, setFeedbackError] = useState("");

  const [requisitions, setRequisitions] = useState([]);
  const [requisitionsLoading, setRequisitionsLoading] = useState(false);
  const [requisitionsError, setRequisitionsError] = useState("");

  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getClientSubmissions();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load candidate submissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequisitions = useCallback(async () => {
    try {
      setRequisitionsLoading(true);
      setRequisitionsError("");

      const result = await getRequisitions();
      setRequisitions(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setRequisitionsError(err.message || "Unable to load requisitions.");
    } finally {
      setRequisitionsLoading(false);
    }
  }, []);

  const loadRequisitionDetail = useCallback(async (requisitionId) => {
    try {
      setDetailLoading(true);
      setDetailError("");
      setSelectedRequisition(null);

      const data = await getRequisitionById(requisitionId);
      setSelectedRequisition(data);
    } catch (err) {
      setDetailError(err.message || "Unable to load requisition details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
    loadRequisitions();
  }, [loadSubmissions, loadRequisitions]);

  const handleFeedback = async (
    submissionId,
    candidateFeedbackId,
    feedback,
    feedbackNote,
  ) => {
    try {
      setSavingCandidateId(candidateFeedbackId);
      setFeedbackError("");

      await updateClientCandidateFeedback(submissionId, candidateFeedbackId, {
        feedback,
        feedbackNote,
      });

      setSubmissions((previous) =>
        previous.map((submission) => {
          if (submission._id !== submissionId) return submission;

          const updatedCandidates = submission.candidates.map((candidate) =>
            candidate._id === candidateFeedbackId
              ? {
                  ...candidate,
                  feedback,
                  feedbackNote: feedbackNote || null,
                  feedbackAt: new Date().toISOString(),
                }
              : candidate,
          );

          const allReviewed = updatedCandidates.every(
            (candidate) => candidate.feedback != null,
          );

          return {
            ...submission,
            candidates: updatedCandidates,
            status: allReviewed ? "reviewed" : "submitted",
          };
        }),
      );
    } catch (err) {
      setFeedbackError(err.message || "Could not save feedback.");
    } finally {
      setSavingCandidateId(null);
    }
  };

  const currentPath = location.pathname.replace(/\/$/, "") || "/client/submissions";

  const pageTitle = currentPath.startsWith("/client/requisitions/")
    ? selectedRequisition?.title || "Requisition details"
    : currentPath === "/client/requisitions"
      ? "Requisitions"
      : "Candidate submissions";

  return (
    <WorkspaceLayout
      navigation={clientNavigation}
      user={user}
      roleLabel="Client"
      onSignOut={onSignOut}
      pageTitle={pageTitle}
      requisitionCount={requisitions.length}
      loadingRequisitions={requisitionsLoading}
    >
      <main className="mx-auto max-w-6xl p-5 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#55734b]">
          Client portal
        </p>

        <Routes>
          <Route
            path="/"
            element={<Navigate to="/client/submissions" replace />}
          />

          <Route
            path="/client"
            element={<Navigate to="/client/submissions" replace />}
          />

          <Route
            path="/client/submissions"
            element={
              <ClientSubmissions
                submissions={submissions}
                loading={loading}
                error={error}
                loadSubmissions={loadSubmissions}
                handleFeedback={handleFeedback}
                savingCandidateId={savingCandidateId}
                feedbackError={feedbackError}
              />
            }
          />

          <Route
            path="/client/requisitions"
            element={
              <>
                <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <h2 className="text-2xl font-semibold text-stone-900">
                      Requisitions
                    </h2>
                    <p className="mt-1 text-sm text-stone-500">
                      Explore job openings assigned to your organization.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={loadRequisitions}
                    disabled={requisitionsLoading}
                    className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >
                    {requisitionsLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                <ClientRequisitions
                  mode="list"
                  requisitions={requisitions}
                  requisitionsLoading={requisitionsLoading}
                  requisitionsError={requisitionsError}
                  loadRequisitions={loadRequisitions}
                  submissions={submissions}
                  openRequisition={(id) =>
                    navigate(`/client/requisitions/${id}`)
                  }
                />
              </>
            }
          />

          <Route
            path="/client/requisitions/:requisitionId"
            element={
              <ClientRequisitionDetail
                requisitions={requisitions}
                submissions={submissions}
                selectedRequisition={selectedRequisition}
                detailLoading={detailLoading}
                detailError={detailError}
                loadRequisitionDetail={loadRequisitionDetail}
                handleFeedback={handleFeedback}
                savingCandidateId={savingCandidateId}
              />
            }
          />

          <Route
            path="*"
            element={<Navigate to="/client/submissions" replace />}
          />
        </Routes>
      </main>
    </WorkspaceLayout>
  );
}
