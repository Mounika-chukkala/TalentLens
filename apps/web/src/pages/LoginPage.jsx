
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

 async function handleSubmit(e) {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    await signIn(email.trim(), password);

    // AuthContext updates the user state.
    // App.jsx will automatically render the correct
    // workspace based on the authenticated user's role.

  } catch (err) {
    setError(
      err.message || "Unable to sign in. Please check your credentials."
    );
  } finally {
    setLoading(false);
  }
}

  return (
    <div className="min-h-screen bg-[#F7F8F4] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-9">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#244C3A] text-white mb-4">
            <span className="text-xl font-bold">T</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-[#1D3027]">
            TalentLens<span className="text-[#64836D]"> AI</span>
          </h1>

          <p className="text-sm text-gray-500 mt-2">
            Intelligent hiring. Better decisions.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-[#E7EAE4] rounded-2xl p-7 sm:p-9 shadow-[0_8px_35px_rgba(30,50,35,0.05)]">

          <div className="mb-7">
            <h2 className="text-xl font-semibold text-[#24382D]">
              Welcome back
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Sign in to access your workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#34483B] mb-2">
                Email address
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-[#E1E6DF] bg-[#FCFDFB] text-sm text-[#24382D] outline-none transition focus:border-[#537A60] focus:ring-2 focus:ring-[#537A60]/10"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[#34483B]">
                  Password
                </label>
              </div>

              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full h-12 pl-11 pr-12 rounded-xl border border-[#E1E6DF] bg-[#FCFDFB] text-sm text-[#24382D] outline-none transition focus:border-[#537A60] focus:ring-2 focus:ring-[#537A60]/10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#244C3A]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-[#244C3A] text-white text-sm font-medium hover:bg-[#193B2B] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                "Signing in..."
              ) : (
                <>
                  Sign in
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-[#EEF0EB]">
            <p className="text-xs text-center text-gray-400">
              Secure access to your TalentLens workspace
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-7">
          © {new Date().getFullYear()} TalentLens AI. All rights reserved.
        </p>
      </div>
    </div>
  );
}
