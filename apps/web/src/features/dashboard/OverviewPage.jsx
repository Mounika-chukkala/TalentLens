import { Activity, ArrowUpRight, BriefcaseBusiness } from "lucide-react";

export default function OverviewPage({
  user,
  metrics,
  requisitions,
  loadingRequisitions,
  requisitionError,
  candidates,
  onCreateRequisition,
  onOpenRequisitions,
  onOpenCandidates,
  onOpenPipeline,
  onRetryRequisitions,
}) {
  return (
<main className="mx-auto max-w-[1440px] p-5 md:p-9">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-sm text-stone-500">
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>

                <h2 className="text-2xl font-semibold tracking-tight md:text-[30px]">
                  Good afternoon, {user?.name || user?.fullName || "there"}.
                </h2>

                <p className="mt-2 text-sm text-stone-500">
                  Here’s what’s happening across your hiring pipeline.
                </p>
              </div>

              <button
                type="button"
                onClick={onCreateRequisition}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#17251b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b4030]"
              >
                <BriefcaseBusiness size={16} />
                Create requisition
                <ArrowUpRight size={16} />
              </button>
            </div>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => {
                const Icon = metric.icon;

                return (
                  <article
                    key={metric.label}
                    className="rounded-xl border border-stone-200 bg-white p-5"
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-stone-500">
                        {metric.label}
                      </p>
                      <span className="rounded-lg bg-[#f1f4ed] p-2 text-[#35543b]">
                        <Icon size={18} />
                      </span>
                    </div>

                    <p className="mt-5 text-3xl font-semibold tracking-tight">
                      {metric.value}
                    </p>

                    <p className="mt-2 text-xs text-stone-500">
                      {metric.change}
                    </p>
                  </article>
                );
              })}
            </section>

            <section className="mt-6 rounded-xl border border-stone-200 bg-white">
              <div className="flex flex-col justify-between gap-2 border-b border-stone-100 px-5 py-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-semibold">Live requisitions</h3>
                  <p className="mt-1 text-xs text-stone-500">
                    Jobs retrieved from your database
                  </p>
                </div>

                <span className="w-fit rounded-full bg-[#edf3e8] px-3 py-1 text-xs font-medium text-[#35543b]">
                  {requisitions.length} total
                </span>
              </div>

              <div className="p-5">
                {loadingRequisitions ? (
                  <p className="text-sm text-stone-500">
                    Loading requisitions...
                  </p>
                ) : requisitionError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-800">
                      Couldn’t load requisitions
                    </p>
                    <p className="mt-1 text-sm text-red-700">
                      {requisitionError}
                    </p>

                    <button
                      type="button"
                      onClick={onRetryRequisitions}
                      className="mt-3 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-800 hover:bg-red-100"
                    >
                      Try again
                    </button>
                  </div>
                ) : requisitions.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-stone-500">
                      No requisitions yet.
                    </p>
                    <button
                      type="button"
                      onClick={onCreateRequisition}
                      className="mt-3 text-sm font-medium text-[#35543b] hover:underline"
                    >
                      Create your first role
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requisitions.map((job) => (
                      <button
                        key={job._id}
                        type="button"
                        onClick={() => onOpenRequisitions()}
                        className="flex w-full flex-col justify-between gap-3 rounded-lg border border-stone-100 p-4 text-left transition hover:border-stone-300 hover:bg-stone-50/60 sm:flex-row sm:items-center"
                      >
                        <div>
                          <h4 className="font-medium">{job.title}</h4>
                          <p className="mt-1 text-sm text-stone-500">
                            {job.clientName} · {job.location}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {job.minExperience}–{job.maxExperience} years
                            of experience · Notice up to{" "}
                            {job.noticePeriodDays} days
                          </p>
                        </div>

                        <span className="w-fit rounded-full bg-stone-100 px-3 py-1 text-xs capitalize text-stone-600">
                          {job.status.replace("_", " ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="flex items-center justify-between border-b border-stone-100 px-5 py-5">
                  <div>
                    <h3 className="font-semibold">
                      Recent candidate reviews
                    </h3>
                    <p className="mt-1 text-xs text-stone-500">
                      Review evidence before making a decision.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenCandidates()}
                    className="text-sm font-medium text-[#35543b] hover:underline"
                  >
                    View all
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[570px] text-left text-sm">
                    <thead className="bg-stone-50/80 text-xs text-stone-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Candidate</th>
                        <th className="px-4 py-3 font-medium">Match score</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium"></th>
                      </tr>
                    </thead>

                    <tbody>
                      {candidates.map((candidate) => (
                        <tr
                          key={candidate._id}
                          className="border-t border-stone-100 hover:bg-stone-50/60"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${candidate.color}`}
                              >
                                {candidate.initials}
                              </div>

                              <div>
                                <p className="font-medium">
                                  {candidate.name}
                                </p>
                                <p className="mt-1 text-xs text-stone-500">
                                  {candidate.role} · {candidate.experience}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {candidate.score}
                              </span>
                              <span className="text-xs text-stone-400">
                                /100
                              </span>
                            </div>

                            <div className="mt-2 h-1.5 w-20 rounded-full bg-stone-100">
                              <div
                                className="h-1.5 rounded-full bg-[#6c914d]"
                                style={{ width: `${candidate.score}%` }}
                              />
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span className="whitespace-nowrap rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                              {candidate.status}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              aria-label={`Review ${candidate.name}`}
                              onClick={() => onOpenCandidates()}
                              className="rounded-md p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-800"
                            >
                              <ArrowUpRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="border-t border-stone-100 px-5 py-3 text-xs text-stone-400">
                  Sample candidate data — connected candidate records are
                  not implemented yet.
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Hiring activity</h3>
                    <p className="mt-1 text-xs text-stone-500">
                      A snapshot of your current workflow.
                    </p>
                  </div>
                  <Activity size={18} className="text-stone-400" />
                </div>

                <div className="mt-6 space-y-6">
                  {[
                    {
                      title: "New candidates uploaded",
                      detail: "Senior Java Developer · 8 candidates",
                      time: "24 min ago",
                      dot: "bg-lime-500",
                    },
                    {
                      title: "Shortlist sent to client",
                      detail: "Product Designer · 3 candidates",
                      time: "2 hours ago",
                      dot: "bg-blue-400",
                    },
                    {
                      title: "Interview scheduled",
                      detail: "Frontend Engineer · Ritika Bansal",
                      time: "Yesterday",
                      dot: "bg-orange-400",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`mt-1.5 h-2.5 w-2.5 rounded-full ${item.dot}`}
                        />
                        <span className="mt-2 h-full w-px bg-stone-100" />
                      </div>

                      <div className="flex-1 pb-1">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {item.detail}
                        </p>
                        <p className="mt-2 text-[11px] text-stone-400">
                          {item.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-lg bg-[#f5f7f1] p-4">
                  <p className="text-xs font-semibold text-[#35543b]">
                    Evidence-first hiring
                  </p>
                  <p className="mt-1 text-xs leading-5 text-stone-600">
                    AI recommendations support recruiter judgment. Every
                    score should be traceable to resume evidence.
                  </p>
                </div>

                <p className="mt-3 text-xs text-stone-400">
                  Activity entries above are illustrative sample data.
                </p>
              </div>
            </section> */}

            <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-stone-200 py-5 text-xs text-stone-400 sm:flex-row">
              <p>TalentLens AI · Recruitment intelligence workspace</p>
              <p>Designed for human-led, evidence-based hiring</p>
            </footer>
          </main>
  );
}
