import { useState } from "react";
import WorkspaceLayout from "../../layouts/WorkspaceLayout";
import { clientNavigation } from "../../components/layout/navigation";

export default function ClientDashboard({ user, onSignOut }) {
  const [currentPage, setCurrentPage] = useState("submissions");
  const pageTitle = currentPage === "interviews" ? "Interviews" : "Candidate submissions";

  return (
    <WorkspaceLayout
      navigation={clientNavigation}
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      user={user}
      roleLabel="Client"
      onSignOut={onSignOut}
      pageTitle={pageTitle}
    >
      <main className="mx-auto max-w-5xl p-5 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#55734b]">Client portal</p>
        <h2 className="mt-2 text-2xl font-semibold">{pageTitle}</h2>
        {currentPage === "submissions" ? (
          <section className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
            <h3 className="font-semibold">Candidate submissions</h3>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Your submitted candidates will appear here. The client review API exists,
              but this interface still needs to be connected to it.
            </p>
          </section>
        ) : (
          <section className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
            <h3 className="font-semibold">Interview schedule</h3>
            <p className="mt-2 text-sm text-stone-600">Interview proposals and confirmed slots will appear here.</p>
          </section>
        )}
      </main>
    </WorkspaceLayout>
  );
}
