"use client";

import { useState } from "react";
import Link from "next/link";

// Mock data — replace with Supabase queries
const mockStudents = [
  { id: "1", name: "Emma Wilson", age: 7, level: 2, category: "LFA", lastSession: "Feb 18, 2026", progress: 65 },
  { id: "2", name: "Liam Chen", age: 5, level: 1, category: "GPA", lastSession: "Feb 18, 2026", progress: 40 },
  { id: "3", name: "Sofia Martinez", age: 8, level: 2, category: "Development", lastSession: "Feb 17, 2026", progress: 85 },
  { id: "4", name: "Noah Thompson", age: 5, level: 1, category: "GPA", lastSession: "Feb 16, 2026", progress: 30 },
  { id: "5", name: "Ava Johnson", age: 9, level: 3, category: "Competitive", lastSession: "Feb 18, 2026", progress: 70 },
  { id: "6", name: "Oliver Davis", age: 7, level: 2, category: "Development", lastSession: "Feb 18, 2026", progress: 55 },
  { id: "7", name: "Mia Rodriguez", age: 6, level: 1, category: "GPA", lastSession: "Feb 15, 2026", progress: 20 },
];

const todaysUpdates = [
  { id: "5", name: "Ava Johnson", note: "Completed drill" },
  { id: "6", name: "Oliver Davis", note: "LFA" },
  { id: "7", name: "Mia Rodriguez", note: "LFA" },
];

export default function MyStudentsPage() {
  const [search, setSearch] = useState("");

  const filtered = mockStudents.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <Link href="/login" className="text-gray-400 hover:text-gray-600">&larr;</Link>
        <h1 className="text-xl font-bold text-gray-800">My Students</h1>
      </div>
      <p className="mb-4 text-sm text-gray-500">{mockStudents.length} students</p>

      {/* Nav */}
      <div className="mb-4 flex gap-4 text-sm">
        <Link href="/coach/students" className="flex items-center gap-1 text-teal-600 font-medium">
          <span>&#128101;</span> Students
        </Link>
        <Link href="/coach/toolkit" className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
          <span>&#128444;</span> Visual Toolkit
        </Link>
        <Link href="/coach/training" className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
          <span>&#127891;</span> Training
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
        />
      </div>

      {/* Today's Updates */}
      <div className="mb-6 rounded-xl bg-teal-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Today&apos;s Updates</h2>
            <p className="text-xs text-gray-500">{todaysUpdates.length} students need lesson updates</p>
          </div>
          <span className="rounded-full bg-teal-500 px-2 py-0.5 text-xs text-white">{todaysUpdates.length}</span>
        </div>
        <div className="space-y-2">
          {todaysUpdates.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-medium text-teal-700">
                  {s.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.note}</p>
                </div>
              </div>
              <Link
                href={`/coach/students/${s.id}`}
                className="rounded-full border border-teal-300 px-3 py-1 text-xs text-teal-600 hover:bg-teal-50"
              >
                Quick Update
              </Link>
            </div>
          ))}
        </div>
        <button className="mt-3 w-full rounded-lg bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition">
          Complete All {todaysUpdates.length} Updates
        </button>
      </div>

      {/* All Students */}
      <h2 className="mb-3 font-semibold text-gray-800">All Students</h2>
      <div className="space-y-3">
        {filtered.map((student) => (
          <Link
            key={student.id}
            href={`/coach/students/${student.id}`}
            className="block rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-medium text-teal-700">
                  {student.name[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{student.name}</p>
                  <p className="text-xs text-gray-500">
                    Age {student.age} &bull; Level {student.level} &bull; {student.category}
                  </p>
                  <p className="text-xs text-gray-400">Last lesson: {student.lastSession}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400">&rsaquo;</span>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <p className="mb-1 text-xs text-gray-500">Overall Progress</p>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-teal-400"
                  style={{ width: `${student.progress}%` }}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
