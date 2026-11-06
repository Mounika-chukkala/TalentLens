
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

import { acceptClientInvitation } from "../lib/api";

export default function AcceptInvitationPage({ token }) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("The invitation link is missing its token.");
      return;
    }

    if (fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (password.length < 12) {
      setError("Your password must contain at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await acceptClientInvitation({
        token,
        fullName: fullName.trim(),
        password,
      });

      setSuccess(true);
    } catch (err) {
      setError(
        err.message || "Unable to activate your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8F4] px-5 py-10">
      <div className="w-full max-w-md">

        <div className="mb-9 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#244C3A] text-white">
            <span className="text-xl font-bold">T</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-[#1D3027]">
            TalentLens<span className="text-[#64836D]"> AI</span>
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Intelligent hiring. Better decisions.
          </p>
        </div>

        <div className="rounded-2xl border border-[#E7EAE4] bg-white p-7 shadow-[0_8px_35px_rgba(30,50,35,0.05)] sm:p-9">

          {success ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 size={30} className="text-green-600" />
              </div>

              <h2 className="text-xl font-semibold text-[#24382D]">
                Account activated!
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Your TalentLens client account has been created successfully.
                You can now sign in and access your organization's hiring
                workspace.
              </p>

              <button
                type="button"
                onClick={() => window.location.assign("/")}
                className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#244C3A] text-sm font-medium text-white transition hover:bg-[#193B2B]"
              >
                Go to sign in
                <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4EF] text-[#244C3A]">
                  <ShieldCheck size={22} />
                </div>

                <h2 className="text-xl font-semibold text-[#24382D]">
                  Accept your invitation
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  You've been invited to TalentLens. Create your account
                  to access your organization's hiring workspace.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#34483B]">
                    Full name
                  </label>

                  <div className="relative">
                    <UserRound
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      autoComplete="name"
                      maxLength={120}
                      required
                      className="h-12 w-full rounded-xl border border-[#E1E6DF] bg-[#FCFDFB] pl-11 pr-4 text-sm text-[#24382D] outline-none transition focus:border-[#537A60] focus:ring-2 focus:ring-[#537A60]/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#34483B]">
                    Password
                  </label>

                  <div className="relative">
                    <LockKeyhole
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                      className="h-12 w-full rounded-xl border border-[#E1E6DF] bg-[#FCFDFB] pl-11 pr-12 text-sm text-[#24382D] outline-none transition focus:border-[#537A60] focus:ring-2 focus:ring-[#537A60]/10"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#244C3A]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <p className="mt-1.5 text-xs text-gray-400">
                    Use at least 12 characters.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#34483B]">
                    Confirm password
                  </label>

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Enter your password again"
                    autoComplete="new-password"
                    required
                    className="h-12 w-full rounded-xl border border-[#E1E6DF] bg-[#FCFDFB] px-4 text-sm text-[#24382D] outline-none transition focus:border-[#537A60] focus:ring-2 focus:ring-[#537A60]/10"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#244C3A] text-sm font-medium text-white transition hover:bg-[#193B2B] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    "Activating account..."
                  ) : (
                    <>
                      Create account
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-7 text-center text-xs text-gray-400">
          Secure access to your TalentLens workspace
        </p>
      </div>
    </div>
  );
}
