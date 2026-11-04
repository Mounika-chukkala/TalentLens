import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RecruiterDashboard from "./features/dashboard/RecruiterDashboard";
import ClientDashboard from "./features/client/ClientDashboard";

export default function App() {
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
      <p className="text-sm text-stone-600">This account does not have workspace access.</p>
      <button onClick={signOut} className="rounded-lg bg-[#17251b] px-4 py-2 text-sm font-semibold text-white">Sign out</button>
    </div>
  );
}
