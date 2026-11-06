
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
import RecruiterDashboard from "./features/dashboard/RecruiterDashboard";
import ClientDashboard from "./features/client/ClientDashboard";

export default function App() {
  const pathname = window.location.pathname;

  // Invitation acceptance is a public page.
  // It must work even when the visitor is not logged in.
  if (pathname === "/accept-invitation") {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";

    return <AcceptInvitationPage token={token} />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5] text-sm text-stone-500">
        Restoring your TalentLens session...
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (user.role === "client") {
    return <ClientDashboard user={user} onSignOut={signOut} />;
  }

  if (user.role === "recruiter") {
    return <RecruiterDashboard user={user} onSignOut={signOut} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f7f8f5]">
      <p className="text-sm text-stone-600">
        This account does not have workspace access.
      </p>

      <button
        onClick={signOut}
        className="rounded-lg bg-[#17251b] px-4 py-2 text-sm font-semibold text-white"
      >
        Sign out
      </button>
    </div>
  );
}
