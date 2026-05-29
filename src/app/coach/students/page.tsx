"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import CoachHeader from "@/app/coach/components/CoachHeader";
import Pagination from "@/app/components/Pagination";

const PAGE_SIZE = 10;

interface Student {
  id: string;
  name: string;
  age: number | null;
  level: number | null;
  category: string | null;
  lastSession: string | null;
  progress: number | null;
}

interface PendingUpdate {
  id: string;
  name: string;
  sessionDate: string;
}

export default function MyStudentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "age" | "level" | "progress">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      setLoading(true);
      setError(null);

      try {
        // 1. Get the logged in coach's ID
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("Not authenticated.");

        // 2. Get swimmer IDs assigned to this coach
        const { data: assignments, error: assignError } = await supabase
          .from("coach_students")
          .select("swimmer_id")
          .eq("coach_id", user.id);

        if (assignError) throw new Error("Failed to load student assignments.");
        if (!assignments || assignments.length === 0) {
          setStudents([]);
          setPendingUpdates([]);
          setLoading(false);
          return;
        }

        const swimmerIds = assignments.map((a) => a.swimmer_id);

        // 3. Fetch profiles and swimmer data for all assigned swimmers
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", swimmerIds);

        const { data: swimmerData, error: swimmersError } = await supabase
          .from("swimmers")
          .select("id, age, level, category, last_session, progress")
          .in("id", swimmerIds);

        if (profilesError || swimmersError) throw new Error("Failed to load student data.");

        // 4. Merge profiles and swimmer data
        const merged: Student[] = (profiles ?? []).map((profile) => {
          const swimmer = swimmerData?.find((s) => s.id === profile.id);
          return {
            id: profile.id,
            name: profile.full_name ?? "Unknown",
            age: swimmer?.age ?? null,
            level: swimmer?.level ?? null,
            category: swimmer?.category ?? null,
            lastSession: swimmer?.last_session ?? null,
            progress: swimmer?.progress ?? null,
          };
        });

        setStudents(merged);

        // 5. Find sessions without reflections (for any date up to today)
        const { data: sessions, error: sessionsError } = await supabase
          .from("sessions")
          .select("id, swimmer_id, session_date")
          .in("swimmer_id", swimmerIds)
          .eq("coach_id", user.id)
          .eq("status", "completed")
          .lte("session_date", new Date().toISOString().split("T")[0]);

        if (sessionsError) throw new Error("Failed to load sessions.");

        if (!sessions || sessions.length === 0) {
          setPendingUpdates([]);
          setLoading(false);
          return;
        }

        // 6. Get session IDs that already have reflections
        const sessionIds = sessions.map((s) => s.id);
        const { data: reflections, error: reflectionsError } = await supabase
          .from("session_reflections")
          .select("session_id")
          .in("session_id", sessionIds);

        if (reflectionsError) throw new Error("Failed to load reflections.");

        const reflectedSessionIds = new Set((reflections ?? []).map((r) => r.session_id));

        // 7. Filter sessions without reflections, one per swimmer (most recent)
        const unreflectedMap: Record<string, { sessionDate: string }> = {};
        for (const session of sessions) {
          if (!reflectedSessionIds.has(session.id)) {
            // Keep the most recent session per swimmer
            if (
              !unreflectedMap[session.swimmer_id] ||
              session.session_date > unreflectedMap[session.swimmer_id].sessionDate
            ) {
              unreflectedMap[session.swimmer_id] = { sessionDate: session.session_date };
            }
          }
        }

        // 8. Build pending updates list with swimmer names
        const pending: PendingUpdate[] = Object.entries(unreflectedMap).map(([swimmerId, { sessionDate }]) => {
          const student = merged.find((s) => s.id === swimmerId);
          return {
            id: swimmerId,
            name: student?.name ?? "Unknown",
            sessionDate,
          };
        });

        setPendingUpdates(pending);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const categories = [...new Set(students.map((s) => s.category).filter(Boolean))];

  const filtered = students
    .filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = filterCategory ? s.category === filterCategory : true;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortBy) {
        case "age":
          valA = a.age ?? 0;
          valB = b.age ?? 0;
          break;
        case "level":
          valA = a.level ?? 0;
          valB = b.level ?? 0;
          break;
        case "progress":
          valA = a.progress ?? 0;
          valB = b.progress ?? 0;
          break;
        default:
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "No sessions yet";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading students...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CoachHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold text-gray-800">My Students</h1>
      </div>
      <p className="mb-4 text-sm text-gray-500">{students.length} students</p>

      {/* Search */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
              showFilters || filterCategory || sortBy !== "name"
                ? "border-teal-400 bg-teal-50 text-teal-600"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            &#9881; Filter
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
            {/* Sort By */}
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">Sort By</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "name", label: "Name" },
                  { key: "age", label: "Age" },
                  { key: "level", label: "Level" },
                  { key: "progress", label: "Progress" },
                ] as { key: typeof sortBy; label: string }[]).map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      if (sortBy === option.key) {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy(option.key);
                        setSortOrder("asc");
                      }
                      setPage(1);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      sortBy === option.key
                        ? "bg-teal-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {option.label}
                    {sortBy === option.key && (
                      <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Category */}
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">Category</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setFilterCategory(""); setPage(1); }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filterCategory === ""
                      ? "bg-teal-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setFilterCategory(cat === filterCategory ? "" : cat!); setPage(1); }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      filterCategory === cat
                        ? "bg-teal-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => {
                setSortBy("name");
                setSortOrder("asc");
                setFilterCategory("");
                setPage(1);
              }}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Today's Updates */}
      {pendingUpdates.length > 0 && (
        <div className="mb-6 rounded-xl bg-teal-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Pending Reflections</h2>
              <p className="text-xs text-gray-500">{pendingUpdates.length} students need session reflections</p>
            </div>
            <span className="rounded-full bg-teal-500 px-2 py-0.5 text-xs text-white">{pendingUpdates.length}</span>
          </div>
          <div className="space-y-2">
            {pendingUpdates.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-medium text-teal-700">
                    {s.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-500">Session on {formatDate(s.sessionDate)}</p>
                  </div>
                </div>
                <Link
                  href={`/coach/students/${s.id}`}
                  className="rounded-full border border-teal-300 px-3 py-1 text-xs text-teal-600 hover:bg-teal-50"
                >
                  Add Reflection
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Students */}
      <h2 className="mb-3 font-semibold text-gray-800">All Students</h2>
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">No students found.</p>
      ) : (
        <div className="space-y-3">
          {paginated.map((student) => (
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
                      {student.age ? `Age ${student.age}` : ""}
                      {student.level ? ` • Level ${student.level}` : ""}
                      {student.category ? ` • ${student.category}` : ""}
                    </p>
                    <p className="text-xs text-gray-400">Last session: {formatDate(student.lastSession)}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">&rsaquo;</span>
              </div>
              {student.progress !== null && (
                <div className="mt-3">
                  <p className="mb-1 text-xs text-gray-500">Overall Progress: {student.progress}%</p>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-teal-400"
                      style={{ width: `${student.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="students"
      />
      </div>
    </div>
  );
}