"use client";

import Link from "next/link";

// Mock data — replace with Supabase queries
const stats = [
  { label: "Total Swimmers", value: 48, icon: "&#128101;" },
  { label: "Active Coaches", value: 6, icon: "&#128105;&#8205;&#127891;" },
  { label: "At Risk", value: 3, icon: "&#9888;&#65039;" },
  { label: "Avg Progress", value: "67%", icon: "&#128200;" },
];

const coachProgress = [
  { name: "Sarah Johnson", students: 8, completion: 100 },
  { name: "Michael Chen", students: 6, completion: 85 },
  { name: "Emma Davis", students: 7, completion: 75 },
  { name: "David Wilson", students: 4, completion: 60 },
  { name: "Lisa Martinez", students: 5, completion: 45 },
  { name: "James Brown", students: 6, completion: 30 },
];

const atRiskStudents = [
  { name: "Alex Thompson", issue: "3 missed sessions", id: "1" },
  { name: "Jordan Lee", issue: "Low engagement scores", id: "2" },
  { name: "Casey Miller", issue: "Regression in skills", id: "3" },
];

const swimmerLevels = [
  { level: "Level 1", count: 18, color: "bg-teal-200" },
  { level: "Level 2", count: 15, color: "bg-teal-400" },
  { level: "Level 3", count: 10, color: "bg-teal-600" },
  { level: "Level 4", count: 5, color: "bg-teal-800" },
];

const monthlyEnrollment = [
  { month: "Sep", count: 20 },
  { month: "Oct", count: 25 },
  { month: "Nov", count: 30 },
  { month: "Dec", count: 28 },
  { month: "Jan", count: 35 },
  { month: "Feb", count: 48 },
];

export default function AdminDashboardPage() {
  const maxEnrollment = Math.max(...monthlyEnrollment.map((m) => m.count));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-gray-400 hover:text-gray-600">&larr;</Link>
            <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
          </div>
          <p className="text-sm text-gray-500 ml-6">Little Swim School Overview</p>
        </div>
        <Link
          href="/admin/reports"
          className="flex items-center gap-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition"
        >
          &#128202; Generate Reports
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm text-center">
            <p className="text-2xl" dangerouslySetInnerHTML={{ __html: s.icon }} />
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {/* Swimmer Level Distribution */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-800">Swimmer Level Distribution</h2>
          <div className="flex items-center justify-center gap-6">
            {/* Simple pie representation */}
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
                {(() => {
                  const total = swimmerLevels.reduce((a, b) => a + b.count, 0);
                  let offset = 0;
                  const colors = ["#99f6e4", "#2dd4bf", "#0d9488", "#134e4a"];
                  return swimmerLevels.map((level, i) => {
                    const pct = (level.count / total) * 100;
                    const el = (
                      <circle
                        key={level.level}
                        cx="18" cy="18" r="15.9155"
                        fill="transparent"
                        stroke={colors[i]}
                        strokeWidth="3.5"
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeDashoffset={`${-offset}`}
                      />
                    );
                    offset += pct;
                    return el;
                  });
                })()}
              </svg>
            </div>
            <div className="space-y-2">
              {swimmerLevels.map((l) => (
                <div key={l.level} className="flex items-center gap-2 text-sm">
                  <div className={`h-3 w-3 rounded-full ${l.color}`} />
                  <span className="text-gray-600">{l.level} ({l.count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Enrollment Trend */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-800">Monthly Enrollment Trend</h2>
          <div className="flex items-end gap-3 h-40">
            {monthlyEnrollment.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center">
                <div
                  className="w-full rounded-t bg-teal-400"
                  style={{ height: `${(m.count / maxEnrollment) * 120}px` }}
                />
                <p className="mt-1 text-xs text-gray-500">{m.month}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Coach Certification Progress */}
      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">Coach Certification Progress</h2>
        <div className="space-y-3">
          {coachProgress.map((coach) => (
            <div key={coach.name} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-medium text-teal-700">
                {coach.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{coach.name}</span>
                  <span className="text-xs text-gray-500">{coach.students} students &bull; {coach.completion}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-teal-400" style={{ width: `${coach.completion}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Students Requiring Attention */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">&#9888;&#65039; Students Requiring Attention</h2>
        <div className="space-y-3">
          {atRiskStudents.map((s) => (
            <div key={s.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">{s.name}</p>
                <p className="text-xs text-gray-500">{s.issue}</p>
              </div>
              <Link
                href={`/coach/students/${s.id}`}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Review
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
