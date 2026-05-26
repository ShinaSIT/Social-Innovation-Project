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

interface CalendarSession {
  id: string;
  session_date: string;
  session_time: string | null;
  duration_minutes: number | null;
  status: string;
  swimmer_name: string;
  swimmer_id: string;
  notes: string | null;
}

interface AssignedSwimmer {
  id: string;
  name: string;
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

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarSessions, setCalendarSessions] = useState<CalendarSession[]>([]);
  const [assignedSwimmers, setAssignedSwimmers] = useState<AssignedSwimmer[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>("");
  const [scheduleForm, setScheduleForm] = useState({
    swimmer_id: "",
    session_date: "",
    session_time: "",
    duration_minutes: "45",
    notes: "",
  });
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [editSession, setEditSession] = useState<CalendarSession | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (showCalendar) fetchCalendarData();
  }, [showCalendar, calendarDate]);

  const fetchDashboard = async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setCoachName(profile?.full_name ?? "Coach");

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

      const todayList = enriched.filter((s) => s.session_date === today && s.status === "planned");
      const upcomingList = enriched.filter((s) => s.session_date > today && s.status === "planned");
      const recentList = enriched
        .filter((s) => s.session_date < today)
        .sort((a, b) => b.session_date.localeCompare(a.session_date))
        .slice(0, 5);

      setTodaySessions(todayList);
      setUpcomingSessions(upcomingList);
      setRecentSessions(recentList);

      const thisWeekSessions = enriched.filter((s) => {
        const d = new Date(s.session_date);
        return d >= weekStart && d <= weekEnd;
      });

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

  const fetchCalendarData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const endOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);

    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, session_date, session_time, duration_minutes, status, swimmer_id, notes")
      .eq("coach_id", user.id)
      .gte("session_date", startOfMonth.toISOString().split("T")[0])
      .lte("session_date", endOfMonth.toISOString().split("T")[0]);

    const swimmerIds = [...new Set((sessions ?? []).map((s) => s.swimmer_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", swimmerIds);

    const nameMap: Record<string, string> = {};
    for (const p of profiles ?? []) nameMap[p.id] = p.full_name ?? "Unknown";

    setCalendarSessions(
      (sessions ?? []).map((s) => ({
        ...s,
        swimmer_name: nameMap[s.swimmer_id] ?? "Unknown",
      }))
    );

    const { data: assignments } = await supabase
      .from("coach_students")
      .select("swimmer_id")
      .eq("coach_id", user.id);

    const assignedIds = (assignments ?? []).map((a) => a.swimmer_id);
    const { data: swimmerProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", assignedIds);

    setAssignedSwimmers(
      (swimmerProfiles ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "Unknown" }))
    );
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);
    setScheduleSuccess(null);

    if (!scheduleForm.swimmer_id) { setScheduleError("Please select a swimmer."); return; }
    if (!scheduleForm.session_date) { setScheduleError("Please select a date."); return; }
    if (!scheduleForm.session_time) { setScheduleError("Please select a time."); return; }

    setScheduleSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: coachData } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", user.id)
      .single();

    const { error } = await supabase
      .from("sessions")
      .insert({
        coach_id: user.id,
        swimmer_id: scheduleForm.swimmer_id,
        club_id: coachData?.club_id,
        session_date: scheduleForm.session_date,
        session_time: scheduleForm.session_time,
        duration_minutes: parseInt(scheduleForm.duration_minutes),
        status: "planned",
        notes: scheduleForm.notes || null,
      });

    if (error) {
      setScheduleError("Failed to schedule session: " + error.message);
    } else {
      setScheduleSuccess("Session scheduled successfully!");
      setScheduleForm({ swimmer_id: "", session_date: selectedCalendarDate, session_time: "", duration_minutes: "45", notes: "" });
      await fetchCalendarData();
      await fetchDashboard();
      setTimeout(() => {
        setShowScheduleModal(false);
        setScheduleSuccess(null);
      }, 1500);
    }
    setScheduleSaving(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSession) return;
    setScheduleError(null);
    setScheduleSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("sessions")
      .update({
        session_date: editSession.session_date,
        session_time: editSession.session_time,
        duration_minutes: editSession.duration_minutes,
        status: editSession.status,
        notes: editSession.notes || null,
      })
      .eq("id", editSession.id);

    if (error) {
      setScheduleError("Failed to update session: " + error.message);
    } else {
      setShowEditModal(false);
      setEditSession(null);
      await fetchCalendarData();
      await fetchDashboard();
    }
    setScheduleSaving(false);
  };

  const handleCancelSession = async (sessionId: string) => {
    const supabase = createClient();
    await supabase
      .from("sessions")
      .update({ status: "cancelled" })
      .eq("id", sessionId);
    await fetchCalendarData();
    await fetchDashboard();
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const getSessionsForDay = (day: number) => {
    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return calendarSessions.filter((s) => s.session_date === dateStr);
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
    <div className="min-h-screen bg-gray-50">
      <CoachHeader />

      <div id="main-content" tabIndex={-1} className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Good morning, {coachName.split(" ")[0]} 👋</h1>
            <p className="text-sm text-gray-500">Here's your schedule overview</p>
          </div>
          <button
            onClick={() => setShowCalendar(true)}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition"
          >
            📅 Schedule
          </button>
        </div>

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

      {/* Calendar Modal */}
      {showCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <button
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                className="rounded-full p-1 hover:bg-gray-100 text-lg"
              >
                &#8249;
              </button>
              <h2 className="font-semibold text-gray-800">
                {calendarDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
              </h2>
              <button
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                className="rounded-full p-1 hover:bg-gray-100 text-lg"
              >
                &#8250;
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-gray-100 px-4 py-2">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 p-4">
              {(() => {
                const { firstDay, daysInMonth } = getDaysInMonth(calendarDate);
                const today = new Date().toDateString();
                const cells = [];

                for (let i = 0; i < firstDay; i++) {
                  cells.push(<div key={`empty-${i}`} />);
                }

                for (let day = 1; day <= daysInMonth; day++) {
                  const sessions = getSessionsForDay(day);
                  const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isToday = new Date(dateStr).toDateString() === today;

                  cells.push(
                    <div
                      key={day}
                      className={`relative min-h-[52px] cursor-pointer rounded-lg p-1 text-center transition hover:bg-teal-50 ${isToday ? "bg-teal-50 ring-1 ring-teal-400" : ""}`}
                      onClick={() => {
                        setSelectedCalendarDate(dateStr);
                        setScheduleForm((prev) => ({ ...prev, session_date: dateStr }));
                        setShowScheduleModal(true);
                        setScheduleError(null);
                        setScheduleSuccess(null);
                      }}
                    >
                      <p className={`text-xs font-medium ${isToday ? "text-teal-600" : "text-gray-700"}`}>{day}</p>
                      <div className="mt-0.5 space-y-0.5">
                        {sessions.slice(0, 2).map((s) => (
                          <div
                            key={s.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditSession(s);
                              setShowEditModal(true);
                              setScheduleError(null);
                            }}
                            className={`truncate rounded px-0.5 text-left text-xs ${
                              s.status === "completed" ? "bg-teal-100 text-teal-700" :
                              s.status === "cancelled" ? "bg-red-100 text-red-600" :
                              "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {s.swimmer_name.split(" ")[0]}
                          </div>
                        ))}
                        {sessions.length > 2 && (
                          <p className="text-xs text-gray-400">+{sessions.length - 2}</p>
                        )}
                      </div>
                    </div>
                  );
                }
                return cells;
              })()}
            </div>

            <div className="flex gap-4 border-t border-gray-100 px-4 py-3">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="h-2 w-2 rounded bg-blue-200" /> Planned
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="h-2 w-2 rounded bg-teal-200" /> Completed
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="h-2 w-2 rounded bg-red-200" /> Cancelled
              </div>
            </div>

            <div className="border-t border-gray-100 p-4">
              <button
                onClick={() => setShowCalendar(false)}
                className="w-full rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Session Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 className="font-semibold text-gray-800">
                Schedule Session — {selectedCalendarDate ? new Date(selectedCalendarDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}
              </h2>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {calendarSessions.filter((s) => s.session_date === selectedCalendarDate).length > 0 && (
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="mb-2 text-xs font-medium text-gray-500">Existing sessions this day:</p>
                <div className="space-y-1">
                  {calendarSessions
                    .filter((s) => s.session_date === selectedCalendarDate)
                    .map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{s.swimmer_name}</p>
                          <p className="text-xs text-gray-500">{formatTime(s.session_time)} • {s.duration_minutes} mins</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          s.status === "completed" ? "bg-teal-100 text-teal-700" :
                          s.status === "cancelled" ? "bg-red-100 text-red-600" :
                          "bg-blue-100 text-blue-700"
                        }`}>{s.status}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="p-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Swimmer</label>
                <select
                  value={scheduleForm.swimmer_id}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, swimmer_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                >
                  <option value="">-- Select swimmer --</option>
                  {assignedSwimmers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Time</label>
                <input
                  type="time"
                  value={scheduleForm.session_time}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, session_time: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Duration (minutes)</label>
                <select
                  value={scheduleForm.duration_minutes}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                    Notes <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                    value={scheduleForm.notes}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any notes for this session..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                />
                </div>

              {scheduleError && <p className="text-sm text-red-500">{scheduleError}</p>}
              {scheduleSuccess && <p className="text-sm text-teal-600">{scheduleSuccess}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleSaving}
                  className="flex-1 rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
                >
                  {scheduleSaving ? "Saving..." : "Schedule Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {showEditModal && editSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 className="font-semibold text-gray-800">Edit Session — {editSession.swimmer_name}</h2>
              <button
                onClick={() => { setShowEditModal(false); setEditSession(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={editSession.session_date}
                  onChange={(e) => setEditSession((prev) => prev ? { ...prev, session_date: e.target.value } : null)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Time</label>
                <input
                  type="time"
                  value={editSession.session_time ?? ""}
                  onChange={(e) => setEditSession((prev) => prev ? { ...prev, session_time: e.target.value } : null)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Duration (minutes)</label>
                <select
                  value={editSession.duration_minutes ?? 45}
                  onChange={(e) => setEditSession((prev) => prev ? { ...prev, duration_minutes: parseInt(e.target.value) } : null)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={editSession.status}
                  onChange={(e) => setEditSession((prev) => prev ? { ...prev, status: e.target.value } : null)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                >
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                    Notes <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                    value={editSession.notes ?? ""}
                    onChange={(e) => setEditSession((prev) => prev ? { ...prev, notes: e.target.value } : null)}
                    placeholder="Any notes for this session..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                />
               </div>

              {scheduleError && <p className="text-sm text-red-500">{scheduleError}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Are you sure you want to cancel this session?")) {
                      handleCancelSession(editSession.id);
                      setShowEditModal(false);
                      setEditSession(null);
                    }
                  }}
                  className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50"
                >
                  Cancel Session
                </button>
                <button
                  type="submit"
                  disabled={scheduleSaving}
                  className="flex-1 rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
                >
                  {scheduleSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}