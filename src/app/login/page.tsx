"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Role = "coach" | "swimmer" | "admin";
type Mode = "login" | "register";

function sanitize(value: string, maxLength = 200): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .slice(0, maxLength);
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("coach");
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
      setError("Could not fetch user role.");
      setLoading(false);
      return;
    }

    if (profile.role !== role) {
      setError(`This account is not registered as a ${role}.`);
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (role === "coach") window.location.href = "/coach/dashboard";
    else if (role === "swimmer") window.location.href = "/swimmer/dashboard";
    else window.location.href = "/admin/dashboard";
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

  // Pass role and full_name in metadata — the trigger will create the profile
  const { data, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
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

  // No manual profile insert needed — the trigger handles it!

  setSuccess("Account created successfully! You can now log in.");
  setMode("login");
  setPassword("");
  setConfirmPassword("");
  setFullName("");
  setLoading(false);
};

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setRole("coach");
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

        {/* Role Selector */}
        <div className="mb-6 flex gap-2">
          {(mode === "register" ? ["coach", "swimmer"] : ["coach", "swimmer", "admin"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRole(r as Role);
                setError(null);
              }}
              className={`flex-1 rounded-full py-2 text-sm font-medium capitalize transition ${
                role === r
                  ? "bg-teal-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r}
            </button>
          ))}
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(sanitize(e.target.value))}
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