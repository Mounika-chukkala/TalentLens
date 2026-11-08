
import {  useMemo, useState } from "react";
// import { getRequisitions,updateRequisitionStatus } from "../../lib/api";
import {
  Search,
  BriefcaseBusiness,
  MapPin,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
export default function RequisitionsPage({
  requisitions = [],
  loading,
  error,
  onRefresh,
  onStatusChange,
  onCreateRequisition,
  createNotice,
  pendingInvitation,
  retryingInvitation,
  onRetryInvitation,
}) {    
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
const [updatingStatusId, setUpdatingStatusId] = useState(null);
const [statusUpdateError, setStatusUpdateError] = useState("");
 


async function handleStatusChange(requisitionId, status) {
  setUpdatingStatusId(requisitionId);
  setStatusUpdateError("");

  try {
    await onStatusChange(requisitionId, status);
  } catch (error) {
    setStatusUpdateError(
      error instanceof Error
        ? error.message
        : "Unable to update requisition status."
    );
  } finally {
    setUpdatingStatusId(null);
  }
}


  const filteredRequisitions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requisitions.filter((job) => {
      const matchesSearch =
        !query ||
        job.title.toLowerCase().includes(query) ||
        job.clientName.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || job.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requisitions, search, statusFilter]);

  const openCount = requisitions.filter(
    (job) => job.status === "open",
  ).length;
  const onHoldCount = requisitions.filter(
  (job) => job.status === "on_hold",
).length;

const closedCount = requisitions.filter(
  (job) => job.status === "closed",
).length;

  return (
    <main className="min-w-0 flex-1 bg-[#f7f8f5] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
  {statusUpdateError && (
  <div
    role="alert"
    className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
  >
    {statusUpdateError}
  </div>
)}
      
{createNotice && (
  <div
    role="status"
    className="mb-5 rounded-xl border border-stone-200 bg-white p-4"
  >
    <p className="text-sm text-stone-700">{createNotice}</p>

    {pendingInvitation && (
      <button
        type="button"
        onClick={onRetryInvitation}
        disabled={retryingInvitation}
        className="mt-3 rounded-lg bg-[#17251b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2b4030] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {retryingInvitation ? "Sending invitation..." : "Retry invitation"}
      </button>
    )}
  </div>
)}

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            {/* <p className="text-sm text-stone-500">
              Workspace / Requisitions
            </p> */}
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#17251b]">
              Requisitions
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Manage open roles and track your hiring requirements.
            </p>
          </div>

          <button
            type="button"
            onClick={onCreateRequisition}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#17251b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b4030]"
          >
            <Plus size={17} />
            Create requisition
          </button>
        </div>

    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
  <div className="rounded-xl border border-stone-200 bg-white p-5">
    <p className="text-sm text-stone-500">Total requisitions</p>
    <p className="mt-3 text-3xl font-semibold">{requisitions.length}</p>
  </div>

  <div className="rounded-xl border border-green-200 bg-white p-5">
    <p className="text-sm text-stone-500">Open roles</p>
    <p className="mt-3 text-3xl font-semibold text-green-700">
      {openCount}
    </p>
  </div>

  <div className="rounded-xl border border-amber-200 bg-white p-5">
    <p className="text-sm text-stone-500">On hold</p>
    <p className="mt-3 text-3xl font-semibold text-amber-700">
      {onHoldCount}
    </p>
  </div>

  <div className="rounded-xl border border-stone-200 bg-white p-5">
    <p className="text-sm text-stone-500">Closed roles</p>
    <p className="mt-3 text-3xl font-semibold text-stone-700">
      {closedCount}
    </p>
  </div>
</div>

        <section className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-stone-100 p-5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search job title, client, or location..."
                aria-label="Search requisitions"
                className="w-full rounded-lg border border-stone-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15"
              />
            </div>

          <select
  value={statusFilter}
  onChange={(event) => setStatusFilter(event.target.value)}
  aria-label="Filter requisitions by status"
  className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#55734b]"
>
  <option value="all">All statuses</option>
  <option value="open">Open</option>
  <option value="on_hold">On hold</option>
  <option value="closed">Closed</option>
</select>

            <button
              type="button"
onClick={onRefresh}              disabled={loading}
              aria-label="Refresh requisitions"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 text-sm hover:bg-stone-50 disabled:opacity-50"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-stone-500">
              Loading requisitions...
            </div>
          ) : error ? (
            <div className="p-10 text-center">
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
              <button
                type="button"
onClick={onRefresh}
                className="mt-4 rounded-lg border border-stone-200 px-4 py-2 text-sm hover:bg-stone-50"
              >
                Try again
              </button>
            </div>
          ) : filteredRequisitions.length === 0 ? (
            <div className="p-12 text-center">
              <BriefcaseBusiness
                size={28}
                className="mx-auto text-stone-400"
              />
              <p className="mt-3 font-medium text-stone-800">
                {requisitions.length === 0
                  ? "No requisitions yet"
                  : "No matching requisitions"}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {requisitions.length === 0
                  ? "Create a role to start building your hiring pipeline."
                  : "Try changing your search or status filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Role</th>
                    <th className="px-5 py-4 font-medium">Experience</th>
                    <th className="px-5 py-4 font-medium">Notice limit</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Created</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-100">
                  {filteredRequisitions.map((job) => (
                    <tr key={job._id} className="hover:bg-stone-50/70">
                      <td className="px-5 py-4">
                        <Link
  to={`/requisitions/${job._id}`}
  className="font-medium text-stone-900 hover:text-[#55734b] hover:underline"
>
  {job.title}
</Link>
                        <div className="mt-1 text-sm text-stone-500">
                          {job.clientName}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                          <MapPin size={12} />
                          {job.location}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-stone-600">
                        {job.minExperience}–{job.maxExperience} years
                      </td>

                      <td className="px-5 py-4 text-sm text-stone-600">
                        {job.noticePeriodDays} days
                      </td>

                   <td className="px-5 py-4">
  <select
    value={job.status}
    disabled={updatingStatusId === job._id}
    onChange={(event) =>
      handleStatusChange(job._id, event.target.value)
    }
    aria-label={`Change status for ${job.title}`}
    className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize outline-none disabled:opacity-50 ${
      job.status === "open"
        ? "border-green-200 bg-green-50 text-green-800"
        : job.status === "on_hold"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-stone-200 bg-stone-100 text-stone-700"
    }`}
  >
    <option value="open">Open</option>
    <option value="on_hold">On hold</option>
    <option value="closed">Closed</option>
  </select>

  {updatingStatusId === job._id && (
    <span className="ml-2 text-xs text-stone-400">
      Saving...
    </span>
  )}
</td>

                      <td className="px-5 py-4 text-sm text-stone-500">
                        {new Date(job.createdAt).toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
                Showing {filteredRequisitions.length} of {requisitions.length} requisitions
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
