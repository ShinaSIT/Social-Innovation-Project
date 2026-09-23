"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import SwimmerHeader from "@/app/swimmer/components/SwimmerHeader";
import SessionReflectionModal from "@/app/swimmer/components/SessionReflectionModal";
import { fetchPendingReflections, type PendingReflection } from "@/utils/swimmerReflection";
import { formatTime as formatClassTime } from "@/utils/termSchedule";
import { formatDateLong } from "@/utils/attendance";

interface SwimmerData {
  id: string;
  name: string;
  age: number | null;
  category: string | null;
  progress: number | null;
}

interface SkillCategory {
  category: string;
  total: number;
  mastered: number;
  progress: number;
}

interface Milestone {
  id: string;
  title: string;
  achieved_on: string;
  category: string | null;
}

interface RecentUpdate {
  id: string;
  date: string;
  coach_notes: string | null;
  parent_feedback: string | null;
  mood: string | null;
  type: "reflection" | "pre_session";
}

interface SwimmerSession {
  id: string;
  session_date: string;
  session_time: string | null;
  duration_minutes: number | null;
  status: string;
  notes: string | null;
  coach_name: string;
}

function formatTime(time: string | null) {
  if (!time) return "—";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export default function SwimmerDashboardPage() {
  const [swimmer, setSwimmer] = useState<SwimmerData | null>(null);
  const [skillCategories, setSkillCategories] = useState<SkillCategory[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [swimmerSessions, setSwimmerSessions] = useState<SwimmerSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<SwimmerSession | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);

  // Classes waiting for the swimmer's emoji reflection
  const [pendingReflections, setPendingReflections] = useState<PendingReflection[]>([]);
  const [reflecting, setReflecting] = useState<PendingReflection | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (swimmer) loadPendingReflections(swimmer.id);
  }, [swimmer?.id]);

  // Non-fatal: the reminder is a nice-to-have, so a failed lookup just hides it.
  const loadPendingReflections = async (swimmerId: string) => {
    try {
      setPendingReflections(await fetchPendingReflections(createClient(), swimmerId));
    } catch {
      setPendingReflections([]);
    }
  };

  useEffect(() => {
    if (showCalendar && swimmer) {
      fetchSwimmerSessions(swimmer.id);
    }
  }, [showCalendar, calendarDate, swimmer]);

  const fetchDashboard = async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      let swimmerId = user.id;

      const { data: caregiverLinks } = await supabase
        .from("caregiver_swimmers")
        .select("swimmer_id")
        .eq("caregiver_id", user.id)
        .limit(1);

      if (caregiverLinks && caregiverLinks.length > 0) {
        swimmerId = caregiverLinks[0].swimmer_id;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", swimmerId)
        .single();

      if (profileError) throw new Error("Failed to load swimmer profile.");

      // maybeSingle, and no throw: a swimmer who registered for themselves and
      // has not filled in their profile yet has no swimmers row. That should
      // render as an empty dashboard, not an error screen.
      const { data: swimmerData } = await supabase
        .from("swimmers")
        .select("age, category, progress")
        .eq("id", swimmerId)
        .maybeSingle();

      setSwimmer({
        id: swimmerId,
        name: profileData.full_name ?? "Swimmer",
        age: swimmerData?.age ?? null,
        category: swimmerData?.category ?? null,
        progress: swimmerData?.progress ?? null,
      });

      const { data: skillsData } = await supabase
        .from("skill_progress")
        .select("category, status")
        .eq("swimmer_id", swimmerId);

      if (skillsData) {
        const categoryMap: Record<string, { total: number; mastered: number }> = {};
        for (const skill of skillsData) {
          if (!categoryMap[skill.category]) {
            categoryMap[skill.category] = { total: 0, mastered: 0 };
          }
          categoryMap[skill.category].total++;
          if (skill.status === "mastered") {
            categoryMap[skill.category].mastered++;
          }
        }
        const categories: SkillCategory[] = Object.entries(categoryMap).map(
          ([category, { total, mastered }]) => ({
            category,
            total,
            mastered,
            progress: total > 0 ? Math.round((mastered / total) * 100) : 0,
          })
        );
        setSkillCategories(categories);
      }

      const { data: milestonesData } = await supabase
        .from("milestones")
        .select("id, title, achieved_on, category")
        .eq("swimmer_id", swimmerId)
        .order("achieved_on", { ascending: false })
        .limit(5);

      setMilestones(milestonesData ?? []);

      const { data: reflectionsData } = await supabase
        .from("session_reflections")
        .select("id, coach_notes, parent_feedback, mood, created_at")
        .eq("swimmer_id", swimmerId)
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: preSessionData } = await supabase
        .from("pre_session_logs")
        .select("id, general_notes, mood_before, created_at")
        .eq("swimmer_id", swimmerId)
        .order("created_at", { ascending: false })
        .limit(5);

      const updates: RecentUpdate[] = [
        ...(reflectionsData ?? []).map((r) => ({
          id: r.id,
          date: r.created_at,
          coach_notes: r.coach_notes,
          parent_feedback: r.parent_feedback,
          mood: r.mood,
          type: "reflection" as const,
        })),
        ...(preSessionData ?? []).map((p) => ({
          id: p.id,
          date: p.created_at,
          coach_notes: p.general_notes,
          parent_feedback: null,
          mood: p.mood_before,
          type: "pre_session" as const,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      setRecentUpdates(updates);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSwimmerSessions = async (targetSwimmerId: string) => {
    const supabase = createClient();

    const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const endOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);

    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, session_date, session_time, duration_minutes, status, notes, coach_id")
      .eq("swimmer_id", targetSwimmerId)
      .gte("session_date", startOfMonth.toISOString().split("T")[0])
      .lte("session_date", endOfMonth.toISOString().split("T")[0]);

    const coachIds = [...new Set((sessions ?? []).map((s) => s.coach_id))];
    const { data: coachProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", coachIds);

    const coachMap: Record<string, string> = {};
    for (const p of coachProfiles ?? []) coachMap[p.id] = p.full_name ?? "Unknown";

    setSwimmerSessions(
      (sessions ?? []).map((s) => ({
        ...s,
        coach_name: coachMap[s.coach_id] ?? "Unknown",
      }))
    );
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
    return swimmerSessions.filter((s) => s.session_date === dateStr);
  };

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function moodEmoji(mood: string | null) {
    const map: Record<string, string> = {
      happy: "😊",
      neutral: "😐",
      sad: "😢",
      anxious: "😰",
      excited: "🤩",
      tired: "😴",
      upset: "😠",
    };
    return mood ? map[mood] ?? "😐" : null;
  }

  if (loading) {
    return (
      <div className="min-h-screen page-shell bg-gray-50">
        <SwimmerHeader />
        <div className="flex items-center justify-center px-6 py-16">
              <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !swimmer) {
    return (
      <div className="min-h-screen page-shell bg-gray-50">
        <SwimmerHeader />
        <div className="flex items-center justify-center px-6 py-16">
              <p className="text-sm text-red-500">{error ?? "Could not load dashboard."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell bg-gray-50">
      <SwimmerHeader />

      {/* Header with gradient */}
      <div id="main-content" tabIndex={-1} className="bg-gradient-to-b from-teal-50 to-gray-50 px-6 pt-6 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <div />
          <button
            onClick={() => setShowCalendar(true)}
            className="rounded-full bg-teal-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 transition"
          >
            &#128197; My Sessions
          </button>
        </div>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-700">
            {swimmer.name[0]}
          </div>
          <h1 className="text-xl font-bold text-gray-800">{swimmer.name}</h1>
          {swimmer.age && <p className="text-sm text-gray-500">{swimmer.age} years old</p>}
          {swimmer.category && <p className="text-xs text-gray-400">{swimmer.category}</p>}
        </div>

        {/* Overall Progress */}
        <div className="mt-6 rounded-xl bg-teal-500 p-4 text-center text-white">
          <p className="text-sm opacity-80">Overall Progress</p>
          <p className="text-3xl font-bold">{swimmer.progress ?? 0}%</p>
        </div>
      </div>

      <div className="px-6 space-y-6 pb-8">
        {/* Reflection reminder */}
        {pendingReflections.length > 0 && (
          <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-gray-800">&#128172; How did your sessions go?</h2>
                <p className="text-xs text-gray-500">
                  {pendingReflections.length === 1
                    ? "1 session is waiting for your reflection."
                    : `${pendingReflections.length} sessions are waiting for your reflection.`}
                </p>
              </div>
              <span className="rounded-full bg-teal-500 px-2 py-0.5 text-xs text-white">{pendingReflections.length}</span>
            </div>
            <div className="space-y-2">
              {pendingReflections.slice(0, 3).map((p) => (
                <div
                  key={`${p.groupId}-${p.lessonDate}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.className}</p>
                    <p className="text-xs text-gray-500">
                      {formatDateLong(p.lessonDate)} · {formatClassTime(p.startTime)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReflecting(p)}
                    className="rounded-full bg-teal-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600"
                  >
                    Add my reflection
                  </button>
                </div>
              ))}
            </div>
            <Link
              href="/swimmer/reflections"
              className="mt-2 inline-block text-xs text-teal-600 underline hover:text-teal-700"
            >
              {pendingReflections.length > 3
                ? `See all ${pendingReflections.length} in My Reflections`
                : "Go to My Reflections"}
            </Link>
          </div>
        )}

        {reflecting && (
          <SessionReflectionModal
            swimmerId={swimmer.id}
            groupId={reflecting.groupId}
            lessonDate={reflecting.lessonDate}
            className={reflecting.className}
            initial={null}
            onClose={() => setReflecting(null)}
            onSaved={() => {
              setReflecting(null);
              loadPendingReflections(swimmer.id);
            }}
          />
        )}

        {/* Skills Progress */}
        <div>
          <h2 className="mb-3 font-semibold text-gray-800">Skills Progress</h2>
          {skillCategories.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No skill data available yet.</p>
          ) : (
            <div className="space-y-3">
              {skillCategories.map((skill) => (
                <div key={skill.category} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{skill.category}</span>
                    <span className="text-xs text-gray-500">{skill.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-teal-400"
                      style={{ width: `${skill.progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {skill.mastered} of {skill.total} skills mastered
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Milestones */}
        <div>
          <h2 className="mb-3 font-semibold text-gray-800">&#127942; Recent Milestones</h2>
          {milestones.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No milestones yet.</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100">
                    <span className="text-teal-600 text-sm">&#10003;</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.title}</p>
                    <p className="text-xs text-gray-500">
                      {m.category && `${m.category} • `}{formatDate(m.achieved_on)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Updates */}
        <div>
          <h2 className="mb-3 font-semibold text-gray-800">&#128221; Recent Updates</h2>
          {recentUpdates.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No updates yet.</p>
          ) : (
            <div className="space-y-3">
              {recentUpdates.map((u) => (
                <div key={u.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">{formatDate(u.date)}</p>
                    <div className="flex items-center gap-1">
                      {u.mood && (
                        <span className="text-sm">{moodEmoji(u.mood)}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        u.type === "reflection"
                          ? "bg-teal-50 text-teal-600"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {u.type === "reflection" ? "Session" : "Pre-session"}
                      </span>
                    </div>
                  </div>
                  {u.coach_notes && (
                    <p className="text-sm text-gray-700">{u.coach_notes}</p>
                  )}
                  {u.parent_feedback && (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      <p className="text-xs text-gray-500">Parent feedback</p>
                      <p className="text-sm text-gray-700">{u.parent_feedback}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Encouragement */}
        <div className="rounded-xl bg-teal-50 p-4 text-center">
          <p className="text-sm text-gray-700">
            {swimmer.name} is making wonderful progress! Every small step forward is a celebration. Keep encouraging their love of water! &#128153;
          </p>
        </div>
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

            {/* Day Labels */}
            <div className="grid grid-cols-7 border-b border-gray-100 px-4 py-2">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400">{d}</div>
              ))}
            </div>

            {/* Calendar Grid */}
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
                      className={`relative min-h-[52px] rounded-lg p-1 text-center ${
                        sessions.length > 0 ? "cursor-pointer hover:bg-teal-50" : ""
                      } ${isToday ? "bg-teal-50 ring-1 ring-teal-400" : ""}`}
                    >
                      <p className={`text-xs font-medium ${isToday ? "text-teal-600" : "text-gray-700"}`}>{day}</p>
                      <div className="mt-0.5 space-y-0.5">
                        {sessions.slice(0, 2).map((s) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setSelectedSession(s);
                              setShowSessionModal(true);
                            }}
                            className={`truncate rounded px-0.5 text-left text-xs cursor-pointer ${
                              s.status === "completed" ? "bg-teal-100 text-teal-700" :
                              s.status === "cancelled" ? "bg-red-100 text-red-600" :
                              "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {formatTime(s.session_time)}
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

            {/* Legend */}
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

      {/* Session Detail Modal */}
      {showSessionModal && selectedSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 className="font-semibold text-gray-800">Session Details</h2>
              <button
                onClick={() => { setShowSessionModal(false); setSelectedSession(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Status</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  selectedSession.status === "completed" ? "bg-teal-100 text-teal-700" :
                  selectedSession.status === "cancelled" ? "bg-red-100 text-red-600" :
                  "bg-blue-100 text-blue-700"
                }`}>
                  {selectedSession.status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Date</span>
                <span className="text-sm font-medium text-gray-800">
                  {new Date(selectedSession.session_date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric", year: "numeric",
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Time</span>
                <span className="text-sm font-medium text-gray-800">{formatTime(selectedSession.session_time)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Duration</span>
                <span className="text-sm font-medium text-gray-800">
                  {selectedSession.duration_minutes ? `${selectedSession.duration_minutes} mins` : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Coach</span>
                <span className="text-sm font-medium text-gray-800">{selectedSession.coach_name}</span>
              </div>

              {selectedSession.notes && (
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="mb-1 text-xs font-medium text-gray-500">Notes</p>
                  <p className="text-sm text-gray-700">{selectedSession.notes}</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 p-4">
              <button
                onClick={() => { setShowSessionModal(false); setSelectedSession(null); }}
                className="w-full rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}