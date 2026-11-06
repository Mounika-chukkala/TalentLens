import { useEffect, useState } from "react";
import {
  createClientOrganization,
  getClientOrganizations,
} from "../../../lib/api";

export default function CreateRequisitionModal({
  open,
  saving,
  error,
  onClose,
  onSubmit,
}) {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [addingOrganization, setAddingOrganization] = useState(false);
  const [organizationError, setOrganizationError] = useState("");
  const [showAddOrganization, setShowAddOrganization] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadOrganizations() {
      setLoadingOrganizations(true);
      setOrganizationError("");

      try {
        const result = await getClientOrganizations();

        if (!cancelled) {
          const rows = Array.isArray(result) ? result : [];
          setOrganizations(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setOrganizationError(
            err instanceof Error
              ? err.message
              : "Unable to load client organizations.",
          );
        }
      } finally {
        if (!cancelled) setLoadingOrganizations(false);
      }
    }

    loadOrganizations();

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleAddOrganization() {
    const name = organizationName.trim();

    if (name.length < 2) {
      setOrganizationError("Organization name must contain at least 2 characters.");
      return;
    }

    setAddingOrganization(true);
    setOrganizationError("");

    try {
      const organization = await createClientOrganization(name);

      if (!organization?._id) {
        throw new Error("Organization was created, but its ID was not returned.");
      }

      setOrganizations((current) => {
        const alreadyExists = current.some(
          (item) => item._id === organization._id,
        );

        return alreadyExists ? current : [...current, organization];
      });

      setSelectedOrganizationId(organization._id);
      setOrganizationName("");
      setShowAddOrganization(false);
    } catch (err) {
      setOrganizationError(
        err instanceof Error
          ? err.message
          : "Unable to create client organization.",
      );
    } finally {
      setAddingOrganization(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-requisition-title"
        className="my-auto w-full max-w-2xl rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-stone-100 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#55734b]">
              Hiring workspace
            </p>
            <h2
              id="create-requisition-title"
              className="mt-2 text-xl font-semibold tracking-tight"
            >
              Create requisition
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Define the role and its basic hiring requirements.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close form"
            disabled={saving || addingOrganization}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-stone-500 hover:bg-stone-100 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Job title *
              <input
                name="title"
                required
                minLength={2}
                maxLength={120}
                placeholder="e.g. Senior Java Developer"
                className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15"
              />
            </label>

            <div className="text-sm font-medium">
              <label htmlFor="clientOrganizationId">
                Client organization *
              </label>

              <select
                id="clientOrganizationId"
                name="clientOrganizationId"
                required
                value={selectedOrganizationId}
                onChange={(event) =>
                  setSelectedOrganizationId(event.target.value)
                }
                disabled={loadingOrganizations}
                className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15 disabled:bg-stone-50"
              >
                <option value="">
                  {loadingOrganizations
                    ? "Loading organizations..."
                    : "Select an organization"}
                </option>

                {organizations.map((organization) => (
                  <option key={organization._id} value={organization._id}>
                    {organization.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setShowAddOrganization((current) => !current);
                  setOrganizationError("");
                }}
                className="mt-2 text-xs font-semibold text-[#55734b] hover:underline"
              >
                {showAddOrganization
                  ? "− Cancel adding organization"
                  : "+ Add a new organization"}
              </button>

              {showAddOrganization && (
                <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <label
                    htmlFor="newOrganizationName"
                    className="text-xs font-semibold text-stone-700"
                  >
                    New organization name
                  </label>

                  <input
                    id="newOrganizationName"
                    value={organizationName}
                    onChange={(event) =>
                      setOrganizationName(event.target.value)
                    }
                    maxLength={160}
                    placeholder="e.g. Bright Technologies"
                    className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#55734b]"
                  />

                  <button
                    type="button"
                    onClick={handleAddOrganization}
                    disabled={addingOrganization || !organizationName.trim()}
                    className="mt-2 w-full rounded-lg bg-[#17251b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2b4030] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addingOrganization ? "Adding..." : "Add organization"}
                  </button>
                </div>
              )}
            </div>

<label className="text-sm font-medium">
  Client contact email *
  <input
    name="clientContactEmail"
    type="email"
    required
    maxLength={254}
    placeholder="e.g. hiring@company.com"
    autoComplete="email"
    className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15"
  />
  <span className="mt-1 block text-xs font-normal text-stone-500">
    An invitation to access the client portal will be sent to this address.
  </span>
</label>

            <label className="text-sm font-medium">
              Location *
              <input
                name="location"
                required
                minLength={2}
                maxLength={120}
                placeholder="e.g. Hyderabad"
                className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15"
              />
            </label>

            <label className="text-sm font-medium">
              Notice period limit (days) *
              <input
                name="noticePeriodDays"
                type="number"
                required
                min={0}
                max={365}
                step={1}
                defaultValue={60}
                className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15"
              />
            </label>

            <label className="text-sm font-medium">
              Minimum experience (years) *
              <input
                name="minExperience"
                type="number"
                required
                min={0}
                max={60}
                step={0.5}
                defaultValue={3}
                className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15"
              />
            </label>

            <label className="text-sm font-medium">
              Maximum experience (years) *
              <input
                name="maxExperience"
                type="number"
                required
                min={0}
                max={60}
                step={0.5}
                defaultValue={6}
                className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15"
              />
            </label>

            <label className="text-sm font-medium sm:col-span-2">
              Job description *
              <textarea
                name="description"
                required
                minLength={20}
                maxLength={10000}
                rows={4}
                placeholder="Describe the role, required skills, responsibilities, and experience..."
                className="mt-2 w-full resize-y rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#55734b] focus:ring-2 focus:ring-[#55734b]/15"
              />
            </label>
          </div>

          {organizationError && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {organizationError}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse justify-end gap-3 border-t border-stone-100 pt-5 sm:flex-row">
            <button
              type="button"
              disabled={saving || addingOrganization}
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                loadingOrganizations ||
                addingOrganization ||
                !selectedOrganizationId
              }
              className="rounded-lg bg-[#17251b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2b4030] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create requisition"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}