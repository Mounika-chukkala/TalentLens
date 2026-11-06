
import { BriefcaseBusiness } from "lucide-react";
import CandidateSubmissionCard from "./CandidateSubmissionCard";

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ClientRequisitions({
  mode = "list",
  requisitions = [],
  requisitionsLoading,
  requisitionsError,
  loadRequisitions,
  submissions = [],
  openRequisition,
  selectedRequisition,
  selectedRequisitionId,
  detailLoading,
  detailError,
  loadRequisitionDetail,
  goBackToRequisitions,
  handleFeedback,
  savingCandidateId,
}) {
  const totalRequisitions = requisitions.length;

  const activeRequisitions = requisitions.filter(
    (item) => item.status === "open",
  ).length;

  const totalCandidatesReceived = submissions.reduce(
    (total, submission) =>
      total + (submission.candidates?.length || 0),
    0,
  );

  const requisitionsAwaitingCandidates = requisitions.filter(
    (requisition) => {
      const hasCandidates = submissions.some(
        (submission) =>
          String(
            submission.requisitionId?._id ||
              submission.requisitionId,
          ) === String(requisition._id) &&
          (submission.candidates?.length || 0) > 0,
      );

      return !hasCandidates;
    },
  ).length;

  // Requisitions list
  if (mode === "list") {
    return (
      <section className="mt-7">
        {requisitionsLoading ? (
          <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
            Loading requisitions...
          </div>
        ) : requisitionsError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm text-red-700">
              {requisitionsError}
            </p>

            <button
              type="button"
              onClick={loadRequisitions}
              className="mt-3 text-sm font-semibold text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : requisitions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <BriefcaseBusiness className="mx-auto h-10 w-10 text-stone-300" />

            <h3 className="mt-4 font-semibold text-stone-800">
              No requisitions assigned yet
            </h3>

            <p className="mt-2 text-sm text-stone-500">
              Job openings assigned to your organization will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[
                {
                  label: "Total requisitions",
                  value: totalRequisitions,
                },
                {
                  label: "Active roles",
                  value: activeRequisitions,
                },
                {
                  label: "Candidates received",
                  value: totalCandidatesReceived,
                },
                {
                  label: "Awaiting candidates",
                  value: requisitionsAwaitingCandidates,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-stone-200 bg-white p-5"
                >
                  <p className="text-sm text-stone-500">
                    {item.label}
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-stone-900">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Requisitions table */}
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="flex flex-col justify-between gap-2 border-b border-stone-100 p-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-semibold text-stone-900">
                    All requisitions
                  </h3>

                  <p className="mt-1 text-sm text-stone-500">
                    Track the hiring progress of your assigned positions.
                  </p>
                </div>

                <span className="text-sm text-stone-500">
                  {requisitions.length} roles
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-5 py-4 font-medium">Position</th>
                      <th className="px-5 py-4 font-medium">Location</th>
                      <th className="px-5 py-4 font-medium">Experience</th>
                      <th className="px-5 py-4 font-medium">Candidates</th>
                      <th className="px-5 py-4 font-medium">Status</th>
                      <th className="px-5 py-4 text-right font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-stone-100">
                    {requisitions.map((requisition) => {
                      const relatedSubmissions = submissions.filter(
                        (submission) =>
                          String(
                            submission.requisitionId?._id ||
                              submission.requisitionId,
                          ) === String(requisition._id),
                      );

                      const candidateCount = relatedSubmissions.reduce(
                        (total, submission) =>
                          total + (submission.candidates?.length || 0),
                        0,
                      );

                      return (
                        <tr
                          key={requisition._id}
                          className="transition hover:bg-stone-50"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold text-stone-900">
                              {requisition.title}
                            </p>

                            <p className="mt-1 text-xs text-stone-500">
                              {requisition.clientName || "Your organization"}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-stone-600">
                            {requisition.location || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-stone-600">
                            {requisition.minExperience ?? "—"} –{" "}
                            {requisition.maxExperience ?? "—"} years
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-semibold text-stone-800">
                              {candidateCount}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                                requisition.status === "open"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : requisition.status === "closed"
                                    ? "bg-stone-100 text-stone-600"
                                    : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {requisition.status?.replace("_", " ") ||
                                "Unknown"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => openRequisition(requisition._id)}
                              className="text-sm font-semibold text-[#55734b] hover:underline"
                            >
                              View details →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    );
  }

  // Requisition details
  return (
    <section className="mt-7">
      <button
        type="button"
        onClick={goBackToRequisitions}
        className="mb-5 text-sm font-semibold text-[#55734b] hover:underline"
      >
        ← Back to requisitions
      </button>

      {detailLoading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
          Loading requisition details...
        </div>
      ) : detailError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">{detailError}</p>

          <button
            type="button"
            onClick={() => loadRequisitionDetail(selectedRequisitionId)}
            className="mt-3 text-sm font-semibold text-red-800 underline"
          >
            Try again
          </button>
        </div>
      ) : selectedRequisition ? (
        <>
          {/* Job information */}
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#55734b]">
                  Job requisition
                </p>

                <h3 className="mt-2 text-2xl font-semibold text-stone-900">
                  {selectedRequisition.title}
                </h3>

                <p className="mt-2 text-sm text-stone-500">
                  {selectedRequisition.clientName || "Client"}
                  {selectedRequisition.location
                    ? ` · ${selectedRequisition.location}`
                    : ""}
                </p>
              </div>

              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold capitalize text-stone-700">
                {selectedRequisition.status?.replace("_", " ") || "Unknown"}
              </span>
            </div>

            <div className="mt-7 grid gap-4 border-t border-stone-100 pt-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-stone-400">Experience</p>
                <p className="mt-1 text-sm font-semibold text-stone-800">
                  {selectedRequisition.minExperience ?? "—"} –{" "}
                  {selectedRequisition.maxExperience ?? "—"} years
                </p>
              </div>

              <div>
                <p className="text-xs text-stone-400">Notice period</p>
                <p className="mt-1 text-sm font-semibold text-stone-800">
                  {selectedRequisition.noticePeriodDays != null
                    ? `${selectedRequisition.noticePeriodDays} days`
                    : "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-stone-400">Location</p>
                <p className="mt-1 text-sm font-semibold text-stone-800">
                  {selectedRequisition.location || "Not specified"}
                </p>
              </div>
            </div>

            <div className="mt-7 border-t border-stone-100 pt-5">
              <h4 className="font-semibold text-stone-900">
                Job description
              </h4>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-600">
                {selectedRequisition.description ||
                  "No job description provided."}
              </p>
            </div>
          </div>

          {/* Submitted candidates */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-stone-900">
              Submitted candidates
            </h3>

            <p className="mt-1 text-sm text-stone-500">
              Candidates explicitly shortlisted and submitted by your
              recruitment team.
            </p>

            {(() => {
              const requisitionSubmissions = submissions.filter(
                (submission) =>
                  String(
                    submission.requisitionId?._id ||
                      submission.requisitionId,
                  ) === String(selectedRequisition._id),
              );

              if (requisitionSubmissions.length === 0) {
                return (
                  <div className="mt-5 rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
                    <h4 className="font-semibold text-stone-800">
                      Waiting for HR to submit candidates
                    </h4>

                    <p className="mt-2 text-sm text-stone-500">
                      Your recruitment team has not submitted any candidates
                      for this requisition yet.
                    </p>
                  </div>
                );
              }

              return (
                <div className="mt-5 space-y-6">
                  {requisitionSubmissions
                    .slice()
                    .sort((a, b) => a.round - b.round)
                    .map((submission) => (
                      <section
                        key={submission._id}
                        className="overflow-hidden rounded-xl border border-stone-200 bg-white"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 p-5">
                          <div>
                            <h4 className="font-semibold text-stone-900">
                              {submission.title ||
                                `Submission Round ${submission.round}`}
                            </h4>

                            <p className="mt-1 text-xs text-stone-500">
                              Submitted {formatDate(submission.submittedAt)}
                            </p>
                          </div>

                          <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-medium capitalize text-stone-700">
                            {submission.status || "submitted"}
                          </span>
                        </div>

                        <div className="space-y-4 p-4 sm:p-5">
                          {submission.candidates?.map((candidate) => (
                            <CandidateSubmissionCard
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
              );
            })()}
          </div>
        </>
      ) : null}
    </section>
  );
}
