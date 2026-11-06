
import { useEffect, useMemo, useState } from "react";
import { getRequisitions } from "../../lib/api";
import {
  Search,
  BriefcaseBusiness,
  MapPin,
  Plus,
  RefreshCw,
} from "lucide-react";

export default function RequisitionsPage({
  onCreateRequisition,
  createNotice,
  pendingInvitation,
  retryingInvitation,
  onRetryInvitation,
}) {
    const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadRequisitions() {
    setLoading(true);
    setError("");

    try {
      const result = await getRequisitions();
      setRequisitions(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load requisitions.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequisitions();
  }, []);

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

  return (
    <main className="min-w-0 flex-1 bg-[#f7f8f5] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">

      
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

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">Total requisitions</p>
            <p className="mt-3 text-3xl font-semibold">{requisitions.length}</p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">Open roles</p>
            <p className="mt-3 text-3xl font-semibold">{openCount}</p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">Other statuses</p>
            <p className="mt-3 text-3xl font-semibold">
              {requisitions.length - openCount}
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
              <option value="closed">Closed</option>
            </select>

            <button
              type="button"
              onClick={loadRequisitions}
              disabled={loading}
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
                onClick={loadRequisitions}
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
                        <div className="font-medium text-stone-900">
                          {job.title}
                        </div>
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
                        <span className="inline-flex rounded-full bg-[#edf3e8] px-3 py-1 text-xs font-medium capitalize text-[#35543b]">
                          {job.status.replace("_", " ")}
                        </span>
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
