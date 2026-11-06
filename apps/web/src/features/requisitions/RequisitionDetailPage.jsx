
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  UserRound,
} from "lucide-react";

import { getRequisitionById } from "../../lib/api";

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-[#edf3e8] p-2 text-[#35543b]">
        <Icon size={18} />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-stone-500">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-stone-800">
          {value ?? "Not specified"}
        </p>
      </div>
    </div>
  );
}

function formatDate(date) {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function RequisitionDetailPage() {
  const { requisitionId } = useParams();

  const [requisition, setRequisition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRequisition() {
      setLoading(true);
      setError("");

      try {
        const result = await getRequisitionById(requisitionId);

        if (!cancelled) {
          setRequisition(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || "Unable to load requisition details."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRequisition();

    return () => {
      cancelled = true;
    };
  }, [requisitionId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-6 md:p-9">
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
          Loading requisition details...
        </div>
      </main>
    );
  }

  if (error || !requisition) {
    return (
      <main className="mx-auto max-w-6xl p-6 md:p-9">
        <Link
          to="/requisitions"
          className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft size={16} />
          Back to requisitions
        </Link>

        <div className="mt-6 rounded-xl border border-red-200 bg-white p-8">
          <h2 className="font-semibold text-stone-900">
            Unable to load requisition
          </h2>
          <p className="mt-2 text-sm text-red-700">
            {error || "Requisition not found."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 bg-[#f7f8f5] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/requisitions"
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-[#24432b]"
        >
          <ArrowLeft size={16} />
          Back to requisitions
        </Link>

        {/* Header */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#edf3e8] px-3 py-1 text-xs font-semibold capitalize text-[#35543b]">
                  {requisition.status?.replaceAll("_", " ")}
                </span>

                <span className="text-xs text-stone-400">
                  Created {formatDate(requisition.createdAt)}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#17251b] md:text-3xl">
                {requisition.title}
              </h1>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-500">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={15} />
                  {requisition.clientName}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} />
                  {requisition.location}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Job overview */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
          <h2 className="text-lg font-semibold text-[#17251b]">
            Job overview
          </h2>

          <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem
              icon={BriefcaseBusiness}
              label="Job title"
              value={requisition.title}
            />

            <DetailItem
              icon={Building2}
              label="Client organization"
              value={requisition.clientName}
            />

            <DetailItem
              icon={MapPin}
              label="Location"
              value={requisition.location}
            />

            <DetailItem
              icon={UserRound}
              label="Minimum experience"
              value={`${requisition.minExperience} years`}
            />

            <DetailItem
              icon={UserRound}
              label="Maximum experience"
              value={`${requisition.maxExperience} years`}
            />

            <DetailItem
              icon={Clock3}
              label="Maximum notice period"
              value={`${requisition.noticePeriodDays} days`}
            />

            <DetailItem
              icon={CalendarDays}
              label="Last updated"
              value={formatDate(requisition.updatedAt)}
            />
          </div>
        </section>

        {/* Description */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
          <h2 className="text-lg font-semibold text-[#17251b]">
            Job description and requirements
          </h2>

          <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-stone-600">
            {requisition.description || "No job description provided."}
          </div>
        </section>

        {/* Candidate submissions placeholder */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
          <h2 className="text-lg font-semibold text-[#17251b]">
            Candidate submissions
          </h2>

          <p className="mt-2 text-sm leading-6 text-stone-500">
            Candidate submissions for this requisition will be displayed here.
            Recruiter submissions and client feedback will be connected in the
            next stage.
          </p>
        </section>
      </div>
    </main>
  );
}
