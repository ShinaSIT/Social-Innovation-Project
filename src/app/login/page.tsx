"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Mode = "login" | "register";

function sanitize(value: string, maxLength = 200): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .slice(0, maxLength);
}

// The single field that decides whether a swimmer's profile counts as filled
// in. Row existence is not enough: every field on the profile form is optional,
// so saving a blank form creates an all-null row that would otherwise read as
// "done" and dismiss the prompt forever. Change this if the form grows a better
// signal of completeness.
const PROFILE_COMPLETE_FIELD = "date_of_birth";

// Send a swimmer whose profile is not filled in to the form rather than the
// dashboard. Deliberately non-fatal: if the lookup fails for any reason we fall
// through to the dashboard rather than block a login that already succeeded.
async function swimmerDestination(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("swimmer_personal_details")
    .select(PROFILE_COMPLETE_FIELD)
    .eq("swimmer_id", userId)
    .maybeSingle();

  if (error) return "/swimmer/dashboard";

  const complete = Boolean(
    data?.[PROFILE_COMPLETE_FIELD as keyof typeof data]
  );
  return complete ? "/swimmer/dashboard" : "/swimmer/profile/edit?welcome=1";
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile lookup failed:", profileError);
      setError(
        profileError
          ? `Could not fetch user role: ${profileError.message}`
          : "Could not fetch user role: no profile found for this account."
      );
      setLoading(false);
      return;
    }

    // Redirect based on role
    if (profile.role === "coach") window.location.href = "/coach/dashboard";
    else if (profile.role === "swimmer")
      window.location.href = await swimmerDestination(supabase, data.user.id);
    else if (profile.role === "admin") window.location.href = "/admin/dashboard";
    else {
      setError("Unknown account role.");
      await supabase.auth.signOut();
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "swimmer", // 👈 always register as swimmer
          full_name: fullName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!data.user || data.user.identities?.length === 0) {
      setError("An account with this email already exists. Please log in instead.");
      setLoading(false);
      return;
    }

    // When email confirmation is disabled in Supabase, signUp returns a
    // session and we can drop the new swimmer straight into the profile form.
    // When it is enabled there is no session yet -- the middleware would bounce
    // them back to /login -- so they confirm first and handleLogin routes them
    // to the same form on their first sign-in. Leave `loading` set so the
    // button stays disabled through the navigation.
    if (data.session) {
      window.location.href = "/swimmer/profile/edit?welcome=1";
      return;
    }

    setSuccess(
      "Account created. Check your email to confirm your address, then log in to finish setting up your profile."
    );
    setMode("login");
    setPassword("");
    setConfirmPassword("");
    setFullName("");
    setLoading(false);
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
          <svg className="h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10c2-2 5-3 9-3s7 1 9 3M3 14c2-2 5-3 9-3s7 1 9 3M3 18c2-2 5-3 9-3s7 1 9 3" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">AquaBridge</h1>
        <p className="text-sm text-gray-500">Structured. Inclusive. Developmental.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">

        {/* Login / Register Toggle */}
        <div className="mb-6 flex gap-2 border-b border-gray-100 pb-4">
          <button
            onClick={() => switchMode("login")}
            className={`flex-1 py-2 text-sm font-medium rounded-full transition ${
              mode === "login"
                ? "bg-teal-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => switchMode("register")}
            className={`flex-1 py-2 text-sm font-medium rounded-full transition ${
              mode === "register"
                ? "bg-teal-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Register
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-700">
            {success}
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(sanitize(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="rounded-lg bg-teal-50 px-4 py-3 text-xs text-teal-700">
              New accounts are registered as swimmer accounts. To become a coach, register and contact your club admin.
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(sanitize(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Register"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}