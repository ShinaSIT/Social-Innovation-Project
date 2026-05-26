"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import CoachHeader from "@/app/coach/components/CoachHeader";

interface Session {
  id: string;
  session_date: string;
  session_time: string | null;
  duration_minutes: number | null;
  status: string;
  swimmer_name: string;
  swimmer_id: string;
}

interface Stats {
  totalStudents: number;
  sessionsThisWeek: number;
  pendingReflections: number;
  completedSessions: number;
}

function formatTime(time: string | null) {
  if (!time) return "—";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function groupSessionsByDate(sessions: Session[]) {
  const map: Record<string, Session[]> = {};
  for (const s of sessions) {
    if (!map[s.session_date]) map[s.session_date] = [];
    map[s.session_date].push(s);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export default function CoachDashboardPage() {
  const [coachName, setCoachName] = useState<string>("");
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    sessionsThisWeek: 0,
    pendingReflections: 0,
    completedSessions: 0,
  });
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      // Fetch coach name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setCoachName(profile?.full_name ?? "Coach");

      // Fetch all sessions for this coach
      const today = new Date().toISOString().split("T")[0];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const { data: allSessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("id, session_date, session_time, duration_minutes, status, swimmer_id")
        .eq("coach_id", user.id)
        .order("session_date", { ascending: true })
        .order("session_time", { ascending: true });

      if (sessionsError) throw new Error("Failed to load sessions.");

      // Get swimmer names
      const swimmerIds = [...new Set((allSessions ?? []).map((s) => s.swimmer_id))];
      const { data: swimmerProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", swimmerIds);

      const nameMap: Record<string, string> = {};
      for (const p of swimmerProfiles ?? []) {
        nameMap[p.id] = p.full_name ?? "Unknown";
      }

      const enriched: Session[] = (allSessions ?? []).map((s) => ({
        ...s,
        swimmer_name: nameMap[s.swimmer_id] ?? "Unknown",
      }));

      // Split into today, upcoming, recent
      const todayList = enriched.filter((s) => s.session_date === today && s.status === "planned");
      const upcomingList = enriched.filter((s) => s.session_date > today && s.status === "planned");
      const recentList = enriched
        .filter((s) => s.session_date < today)
        .sort((a, b) => b.session_date.localeCompare(a.session_date))
        .slice(0, 5);

      setTodaySessions(todayList);
      setUpcomingSessions(upcomingList);
      setRecentSessions(recentList);

      // Stats
      const thisWeekSessions = enriched.filter((s) => {
        const d = new Date(s.session_date);
        return d >= weekStart && d <= weekEnd;
      });

      // Pending reflections — completed sessions without a reflection
      const completedSessionIds = enriched
        .filter((s) => s.status === "completed")
        .map((s) => s.id);

      let pendingReflections = 0;
      if (completedSessionIds.length > 0) {
        const { data: reflections } = await supabase
          .from("session_reflections")
          .select("session_id")
          .in("session_id", completedSessionIds);

        const reflectedIds = new Set((reflections ?? []).map((r) => r.session_id));
        pendingReflections = completedSessionIds.filter((id) => !reflectedIds.has(id)).length;
      }

      // Total assigned students
      const { count: studentCount } = await supabase
        .from("coach_students")
        .select("*", { count: "exact", head: true })
        .eq("coach_id", user.id);

      setStats({
        totalStudents: studentCount ?? 0,
        sessionsThisWeek: thisWeekSessions.length,
        pendingReflections,
        completedSessions: enriched.filter((s) => s.status === "completed").length,
      });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const groupedUpcoming = groupSessionsByDate(upcomingSessions);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading dashboard...</p>
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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <CoachHeader />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-teal-600">{stats.totalStudents}</p>
          <p className="text-xs text-gray-500">My Students</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-teal-600">{stats.sessionsThisWeek}</p>
          <p className="text-xs text-gray-500">Sessions This Week</p>
        </div>
        <div className={`rounded-xl p-4 shadow-sm text-center ${stats.pendingReflections > 0 ? "bg-amber-50" : "bg-white"}`}>
          <p className={`text-2xl font-bold ${stats.pendingReflections > 0 ? "text-amber-500" : "text-teal-600"}`}>
            {stats.pendingReflections}
          </p>
          <p className="text-xs text-gray-500">Pending Reflections</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-teal-600">{stats.completedSessions}</p>
          <p className="text-xs text-gray-500">Completed Sessions</p>
        </div>
      </div>

      {/* Today's Sessions */}
      <div className="mb-6">
        <h2 className="mb-3 font-semibold text-gray-800">
          📅 Today's Sessions
          {todaySessions.length > 0 && (
            <span className="ml-2 rounded-full bg-teal-500 px-2 py-0.5 text-xs text-white">
              {todaySessions.length}
            </span>
          )}
        </h2>
        {todaySessions.length === 0 ? (
          <div className="rounded-xl bg-white p-6 shadow-sm text-center">
            <p className="text-sm text-gray-500">No sessions scheduled for today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todaySessions.map((session) => (
              <div key={session.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                      {session.swimmer_name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{session.swimmer_name}</p>
                      <p className="text-xs text-gray-500">
                        {formatTime(session.session_time)}
                        {session.duration_minutes && ` • ${session.duration_minutes} mins`}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/coach/students/${session.swimmer_id}`}
                    className="rounded-full bg-teal-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 transition"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Sessions */}
      <div className="mb-6">
        <h2 className="mb-3 font-semibold text-gray-800">🗓 Upcoming Sessions</h2>
        {upcomingSessions.length === 0 ? (
          <div className="rounded-xl bg-white p-6 shadow-sm text-center">
            <p className="text-sm text-gray-500">No upcoming sessions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedUpcoming.map(([date, sessions]) => (
              <div key={date}>
                <p className="mb-2 text-sm font-medium text-gray-500">{formatDate(date)}</p>
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                          {session.swimmer_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{session.swimmer_name}</p>
                          <p className="text-xs text-gray-500">
                            {formatTime(session.session_time)}
                            {session.duration_minutes && ` • ${session.duration_minutes} mins`}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/coach/students/${session.swimmer_id}`}
                        className="rounded-full border border-teal-300 px-3 py-1 text-xs text-teal-600 hover:bg-teal-50 transition"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">⏱ Recent Sessions</h2>
          <Link href="/coach/students" className="text-xs text-teal-600 hover:underline">
            View all students →
          </Link>
        </div>
        {recentSessions.length === 0 ? (
          <div className="rounded-xl bg-white p-6 shadow-sm text-center">
            <p className="text-sm text-gray-500">No recent sessions.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                    {session.swimmer_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{session.swimmer_name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(session.session_date)} • {formatTime(session.session_time)}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  session.status === "completed"
                    ? "bg-teal-100 text-teal-700"
                    : "bg-red-100 text-red-600"
                }`}>
                  {session.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Reflections Alert */}
      {stats.pendingReflections > 0 && (
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            ⚠️ You have {stats.pendingReflections} session{stats.pendingReflections > 1 ? "s" : ""} without reflections.
          </p>
          <Link href="/coach/students" className="mt-1 block text-xs text-amber-700 hover:underline">
            Go to students to add reflections →
          </Link>
        </div>
      )}
    </div>
  );
}