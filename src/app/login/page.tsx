"use client";

import { useState } from "react";
import Link from "next/link";

type Role = "coach" | "swimmer" | "admin";

export default function LoginPage() {
  const [role, setRole] = useState<Role>("coach");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Supabase auth login
    // Redirect based on role
    if (role === "coach") {
      window.location.href = "/coach/students";
    } else if (role === "swimmer") {
      window.location.href = "/swimmer/dashboard";
    } else {
      window.location.href = "/admin/dashboard";
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      {/* Logo & Branding */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
          <svg className="h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10c2-2 5-3 9-3s7 1 9 3M3 14c2-2 5-3 9-3s7 1 9 3M3 18c2-2 5-3 9-3s7 1 9 3" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">AquaBridge</h1>
        <p className="text-sm text-gray-500">Structured. Inclusive. Developmental.</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        {/* Role Selector */}
        <div className="mb-6 flex gap-2">
          {(["coach", "swimmer", "admin"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
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

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          <button
            type="submit"
            className="w-full rounded-full bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
