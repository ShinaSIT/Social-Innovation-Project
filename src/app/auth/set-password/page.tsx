"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

// First login for an invited account: /auth/confirm has already signed the
// user in from the email link, so all that's left is choosing a password.
export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { data, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError || !data.user) {
      setError(updateError?.message ?? "Could not set your password.");
      setSaving(false);
      return;
    }

    const role = data.user.user_metadata?.role;
    // Leave `saving` set so the button stays disabled through the navigation.
    window.location.href =
      role === "coach"
        ? "/coach/profile?welcome=1"
        : role === "admin"
        ? "/admin/dashboard"
        : "/swimmer/dashboard";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Welcome to AquaBridge</h1>
        <p className="text-sm text-gray-500">Choose a password to finish setting up your account.</p>
      </div>

      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-700">New Password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
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
            disabled={saving}
            className="w-full rounded-full bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
