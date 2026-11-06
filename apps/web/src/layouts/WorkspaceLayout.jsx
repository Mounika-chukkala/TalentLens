
import { useState } from "react";
import { Outlet } from "react-router-dom";

import WorkspaceHeader from "../components/layout/WorkspaceHeader";
import WorkspaceSidebar from "../components/layout/WorkspaceSidebar";

export default function WorkspaceLayout({
  children,
  navigation,
  user,
  roleLabel,
  onSignOut,
  pageTitle,
  requisitionCount = 0,
  loadingRequisitions = false,
  onActivity,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-[#202820]">
      <WorkspaceSidebar
        navigation={navigation}
        user={user}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        roleLabel={roleLabel}
        requisitionCount={requisitionCount}
        loadingRequisitions={loadingRequisitions}
      />

      <div className="min-w-0 lg:pl-64">
        <WorkspaceHeader
          title={pageTitle}
          user={user}
          roleLabel={roleLabel}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onSignOut={onSignOut}
          onActivity={onActivity}
        />

        <main>
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
