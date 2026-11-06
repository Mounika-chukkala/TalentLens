
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import LoginPage from "./pages/LoginPage";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";

import RecruiterDashboard from "./features/dashboard/RecruiterDashboard";
import ClientDashboard from "./features/client/ClientDashboard";

function AuthenticatedApp() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8f5]">
        Restoring your TalentLens session...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (user.role === "recruiter") {
    return <RecruiterDashboard user={user} onSignOut={signOut} />;
  }

  if (user.role === "client") {
    return <ClientDashboard user={user} onSignOut={signOut} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p>Unsupported account role.</p>
      <button onClick={signOut}>Sign out</button>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/accept-invitation"
        element={<AcceptInvitationRoute />}
      />
      <Route path="/*" element={<AuthenticatedApp />} />
    </Routes>
  );
}

function AcceptInvitationRoute() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  return <AcceptInvitationPage token={token} />;
}
