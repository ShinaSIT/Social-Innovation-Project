"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import SwimmerHeader from "@/app/swimmer/components/SwimmerHeader";
import { formatTime, toLocalISODate, DAYS, MONTH_NAMES } from "@/utils/termSchedule";
import { SESSION_STATUS_OPTIONS, formatDateLong } from "@/utils/attendance";
import { REFLECTION_QUESTIONS, reflectionOption, type ReflectionAnswers } from "@/utils/swimmerReflection";
import SessionReflectionModal from "@/app/swimmer/components/SessionReflectionModal";

interface MyGroup {
  id: string;
  group_name: string;
  coachNames: string[];
  isSubstituted: boolean;
  status: string;
  statusReason: string;
  myAttendance: {
    hasRecord: boolean;
    present: boolean;
    absence_reason: "mc" | "other" | null;
    absence_note: string;
  };
  myReflection: ReflectionAnswers | null;
}

interface MyClass {
  id: string;
  name: string;
  start_time: string;
  duration_minutes: number;
  location: string | null;
  groups: MyGroup[];
}

interface MyTerm {
  id: string;
  term_name: string;
  start_date: string;
  end_date: string;
}

type ViewMode = "day" | "week" | "term";

function statusStyle(status: string) {
  if (status === "cancelled") return "bg-red-100 text-red-700";
  if (status === "ran_partial_cat1") return "bg-amber-100 text-amber-700";
  if (status === "land_training") return "bg-blue-100 text-blue-700";
  return "bg-green-100 text-green-700";
}

function statusLabel(status: string) {
  return SESSION_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

type Supabase = ReturnType<typeof createClient>;

// Which swimmer this viewer sees: themself, or (for a caregiver account) the
// swimmer they're linked to via caregiver_swimmers.
async function resolveSwimmerId(supabase: Supabase): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: caregiverLinks } = await supabase
    .from("caregiver_swimmers")
    .select("swimmer_id")
    .eq("caregiver_id", user.id)
    .limit(1);

  return caregiverLinks && caregiverLinks.length > 0 ? caregiverLinks[0].swimmer_id : user.id;
}

// All classes/groups this swimmer is in that actually run on `dateStr`,
// with coaches (regular or that date's substitute), session status, and the
// swimmer's own attendance record for that date.
async function fetchClassesForDate(
  supabase: Supabase,
  swimmerId: string,
  dateStr: string
): Promise<MyClass[]> {
  const fallbackId = ["00000000-0000-0000-0000-000000000000"];

  const { data: myGroupRows } = await supabase
    .from("class_group_swimmers")
    .select("group_id, enrolled_at")
    .eq("swimmer_id", swimmerId);

  const myGroupIds = Array.from(new Set((myGroupRows ?? []).map((r) => r.group_id)));
  if (myGroupIds.length === 0) return [];

  const enrolledAtMap = new Map(
    (myGroupRows ?? []).map((r) => [r.group_id, (r.enrolled_at as string).slice(0, 10)])
  );

  const { data: groupRows } = await supabase
    .from("class_groups")
    .select("id, class_id, group_name")
    .in("id", myGroupIds);

  const classIds = Array.from(new Set((groupRows ?? []).map((g) => g.class_id)));
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, start_time, duration_minutes, location")
    .in("id", classIds.length ? classIds : fallbackId)
    .eq("archived", false);

  const { data: linkRows } = await supabase
    .from("term_schedule_classes")
    .select("term_schedule_id, class_id")
    .in("class_id", classIds.length ? classIds : fallbackId);

  const termIds = Array.from(new Set((linkRows ?? []).map((l) => l.term_schedule_id)));
  const { data: activeDates } = await supabase
    .from("term_schedule_dates")
    .select("term_schedule_id")
    .in("term_schedule_id", termIds.length ? termIds : fallbackId)
    .eq("lesson_date", dateStr)
    .eq("has_lesson", true);

  const activeTermIds = new Set((activeDates ?? []).map((d) => d.term_schedule_id));
  const classesRunningToday = new Set(
    (linkRows ?? []).filter((l) => activeTermIds.has(l.term_schedule_id)).map((l) => l.class_id)
  );

  const runningGroupRows = (groupRows ?? []).filter((g) => {
    if (!classesRunningToday.has(g.class_id)) return false;
    const enrolledAt = enrolledAtMap.get(g.id);
    return !enrolledAt || enrolledAt <= dateStr;
  });
  const runningGroupIds = runningGroupRows.map((g) => g.id);

  if (runningGroupIds.length === 0) return [];

  const [
    { data: gcRows },
    { data: overrideRows },
    { data: logRows },
    { data: myAttendanceRows },
    { data: myReflectionRows },
  ] = await Promise.all([
    supabase.from("class_group_coaches").select("group_id, coach_id").in("group_id", runningGroupIds),
    supabase.from("class_session_coaches").select("class_group_id, coach_id").in("class_group_id", runningGroupIds).eq("lesson_date", dateStr),
    supabase.from("class_session_logs").select("class_group_id, status, status_reason").in("class_group_id", runningGroupIds).eq("lesson_date", dateStr),
    supabase.from("class_session_swimmers").select("class_group_id, present, absence_reason, absence_note").in("class_group_id", runningGroupIds).eq("swimmer_id", swimmerId).eq("lesson_date", dateStr),
    supabase.from("swimmer_session_reflections").select("class_group_id, feeling, difficulty, self_rating").in("class_group_id", runningGroupIds).eq("swimmer_id", swimmerId).eq("lesson_date", dateStr),
  ]);

  const coachIds = Array.from(
    new Set([...(gcRows ?? []).map((r) => r.coach_id), ...(overrideRows ?? []).map((r) => r.coach_id)])
  );
  const { data: coachProfiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", coachIds.length ? coachIds : fallbackId);
  const coachNameMap = new Map((coachProfiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));

  const classInfoMap = new Map((classRows ?? []).map((c) => [c.id, c]));

  return Array.from(classesRunningToday)
    .map((classId) => classInfoMap.get(classId))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => {
      const groupsForClass = runningGroupRows.filter((g) => g.class_id === c.id);
      const groups: MyGroup[] = groupsForClass.map((g) => {
        const overrides = (overrideRows ?? []).filter((r) => r.class_group_id === g.id).map((r) => r.coach_id);
        const isSubstituted = overrides.length > 0;
        const effectiveCoachIds = isSubstituted
          ? overrides
          : (gcRows ?? []).filter((r) => r.group_id === g.id).map((r) => r.coach_id);
        const log = (logRows ?? []).find((l) => l.class_group_id === g.id);
        const myRecord = (myAttendanceRows ?? []).find((r) => r.class_group_id === g.id);
        const myReflection = (myReflectionRows ?? []).find((r) => r.class_group_id === g.id);
        return {
          id: g.id,
          group_name: g.group_name,
          coachNames: effectiveCoachIds.map((id) => coachNameMap.get(id) ?? "Unknown"),
          isSubstituted,
          status: log?.status ?? "ran",
          statusReason: log?.status_reason ?? "",
          myAttendance: {
            hasRecord: !!myRecord,
            present: myRecord ? myRecord.present : true,
            absence_reason: (myRecord?.absence_reason as "mc" | "other" | null) ?? null,
            absence_note: myRecord?.absence_note ?? "",
          },
          myReflection: myReflection
            ? { feeling: myReflection.feeling, difficulty: myReflection.difficulty, self_rating: myReflection.self_rating }
            : null,
        };
      });
      return {
        id: c.id,
        name: c.name,
        start_time: c.start_time,
        duration_minutes: c.duration_minutes,
        location: c.location,
        groups,
      };
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// A swimmer can reflect on a class once it has happened, unless it was
// cancelled or they were marked absent.
function canReflect(g: MyGroup, dateStr: string) {
  if (dateStr > toLocalISODate(new Date())) return false;
  if (g.status === "cancelled") return false;
  if (g.myAttendance.hasRecord && !g.myAttendance.present) return false;
  return true;
}

function ReflectionEmojis({ r }: { r: ReflectionAnswers }) {
  return (
    <span className="inline-flex gap-0.5">
      {REFLECTION_QUESTIONS.map((q) => {
        const o = reflectionOption(q.key, r[q.key]);
        return o ? (
          <span key={q.key} title={`${q.question} ${o.label}`} aria-label={`${q.question} ${o.label}`} role="img">
            {o.emoji}
          </span>
        ) : null;
      })}
    </span>
  );
}

function ClassCard({
  c,
  dateStr,
  onReflect,
}: {
  c: MyClass;
  dateStr: string;
  onReflect: (c: MyClass, g: MyGroup) => void;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-800">{c.name}</h2>
          <p className="text-xs text-gray-500">
            {formatTime(c.start_time)} · {c.duration_minutes} mins{c.location ? ` · ${c.location}` : ""}
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        {c.groups.map((g) => (
          <div key={g.id} className="rounded-lg border border-gray-100 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">{g.group_name}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(g.status)}`}>
                {statusLabel(g.status)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Coach{g.coachNames.length > 1 ? "es" : ""}: {g.coachNames.length > 0 ? g.coachNames.join(", ") : "Not yet assigned"}
              {g.isSubstituted && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Substitute
                </span>
              )}
            </p>
            <div className="mt-2 flex items-center gap-2 border-t border-gray-50 pt-2">
              <span className="text-xs text-gray-500">My attendance:</span>
              {!g.myAttendance.hasRecord ? (
                <span className="text-xs text-gray-400">Not marked yet</span>
              ) : g.myAttendance.present ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Present</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Absent</span>
                  {g.myAttendance.absence_reason && (
                    <span className="text-xs text-gray-500">
                      ({g.myAttendance.absence_reason === "mc" ? "MC" : g.myAttendance.absence_note || "Other"})
                    </span>
                  )}
                </span>
              )}
            </div>
            {canReflect(g, dateStr) && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-50 pt-2">
                {g.myReflection ? (
                  <>
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      My reflection: <span className="text-lg leading-none"><ReflectionEmojis r={g.myReflection} /></span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onReflect(c, g)}
                      className="text-xs text-teal-600 underline hover:text-teal-700"
                    >
                      Change
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-gray-500">How did this session go?</span>
                    <button
                      type="button"
                      onClick={() => onReflect(c, g)}
                      className="rounded-full bg-teal-500 px-3 py-1 text-xs font-medium text-white hover:bg-teal-600"
                    >
                      Add my reflection
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact one-liner used in Week/Term rows: class · group · status, plus my
// attendance if it's been marked.
function ClassRow({ c }: { c: MyClass }) {
  return (
    <div className="space-y-1">
      {c.groups.map((g) => (
        <div key={g.id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-gray-700">{c.name}</span>
          <span className="text-gray-400">{formatTime(c.start_time)}</span>
          {c.groups.length > 1 && <span className="text-gray-400">· {g.group_name}</span>}
          <span className={`rounded-full px-2 py-0.5 font-medium ${statusStyle(g.status)}`}>{statusLabel(g.status)}</span>
          {g.isSubstituted && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Sub</span>}
          {!g.myAttendance.hasRecord ? (
            <span className="text-gray-400">Not marked yet</span>
          ) : g.myAttendance.present ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">Present</span>
          ) : (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">Absent</span>
          )}
          {g.myReflection && <ReflectionEmojis r={g.myReflection} />}
        </div>
      ))}
    </div>
  );
}

function getWeekStart(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - d.getDay()); // back up to Sunday
  return d;
}

export default function SwimmerCalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(toLocalISODate(new Date()));
  const [swimmerId, setSwimmerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Day view
  const [dayClasses, setDayClasses] = useState<MyClass[]>([]);
  const [reflecting, setReflecting] = useState<{ c: MyClass; g: MyGroup } | null>(null);

  // Week view
  const [weekDays, setWeekDays] = useState<{ dateStr: string; classes: MyClass[] }[]>([]);

  // Term view
  const [myTerms, setMyTerms] = useState<MyTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [termDays, setTermDays] = useState<{ dateStr: string; classes: MyClass[] }[]>([]);

  // Resolve which swimmer we're viewing, once.
  useEffect(() => {
    const supabase = createClient();
    resolveSwimmerId(supabase)
      .then(setSwimmerId)
      .catch((err) => setError(err.message));
  }, []);

  const loadDay = useCallback(async (swimmerId: string, dateStr: string) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      setDayClasses(await fetchClassesForDate(supabase, swimmerId, dateStr));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeek = useCallback(async (swimmerId: string, dateStr: string) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      const start = getWeekStart(dateStr);
      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return toLocalISODate(d);
      });
      const results = await Promise.all(dates.map((d) => fetchClassesForDate(supabase, swimmerId, d)));
      setWeekDays(dates.map((dateStr, i) => ({ dateStr, classes: results[i] })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Which terms cover this swimmer's classes, loaded once we know who they are.
  useEffect(() => {
    if (!swimmerId) return;
    (async () => {
      const supabase = createClient();
      const fallbackId = ["00000000-0000-0000-0000-000000000000"];
      const { data: myGroupRows } = await supabase
        .from("class_group_swimmers")
        .select("group_id")
        .eq("swimmer_id", swimmerId);
      const groupIds = Array.from(new Set((myGroupRows ?? []).map((r) => r.group_id)));
      if (groupIds.length === 0) return;

      const { data: groupRows } = await supabase.from("class_groups").select("class_id").in("id", groupIds);
      const classIds = Array.from(new Set((groupRows ?? []).map((g) => g.class_id)));

      const { data: linkRows } = await supabase
        .from("term_schedule_classes")
        .select("term_schedule_id")
        .in("class_id", classIds.length ? classIds : fallbackId);
      const termIds = Array.from(new Set((linkRows ?? []).map((l) => l.term_schedule_id)));
      if (termIds.length === 0) return;

      const { data: termRows } = await supabase
        .from("term_schedules")
        .select("id, term_name, start_date, end_date")
        .in("id", termIds)
        .order("start_date", { ascending: true });

      const terms = termRows ?? [];
      setMyTerms(terms);

      // Default to the term containing today; else the nearest upcoming one;
      // else the most recent past one.
      const today = toLocalISODate(new Date());
      const current = terms.find((t) => t.start_date <= today && today <= t.end_date);
      const upcoming = terms.filter((t) => t.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
      const past = [...terms].filter((t) => t.end_date < today).sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
      setSelectedTermId((current ?? upcoming ?? past ?? terms[0])?.id ?? null);
    })();
  }, [swimmerId]);

  const loadTerm = useCallback(async (swimmerId: string, termId: string) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      const { data: dateRows } = await supabase
        .from("term_schedule_dates")
        .select("lesson_date")
        .eq("term_schedule_id", termId)
        .eq("has_lesson", true)
        .order("lesson_date", { ascending: true });
      const dates = (dateRows ?? []).map((d) => d.lesson_date as string);
      const results = await Promise.all(dates.map((d) => fetchClassesForDate(supabase, swimmerId, d)));
      setTermDays(dates.map((dateStr, i) => ({ dateStr, classes: results[i] })).filter((d) => d.classes.length > 0));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!swimmerId) return;
    if (viewMode === "day") loadDay(swimmerId, selectedDate);
    else if (viewMode === "week") loadWeek(swimmerId, selectedDate);
  }, [swimmerId, viewMode, selectedDate, loadDay, loadWeek]);

  useEffect(() => {
    if (!swimmerId || !selectedTermId || viewMode !== "term") return;
    loadTerm(swimmerId, selectedTermId);
  }, [swimmerId, selectedTermId, viewMode, loadTerm]);

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(toLocalISODate(d));
  };

  const shiftTerm = (delta: number) => {
    const idx = myTerms.findIndex((t) => t.id === selectedTermId);
    const next = myTerms[idx + delta];
    if (next) setSelectedTermId(next.id);
  };

  const selectedTerm = myTerms.find((t) => t.id === selectedTermId) ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <SwimmerHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-800">My Schedule</h1>
            <p className="text-sm text-gray-500">Your classes, coaches, and attendance.</p>
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
            {(["day", "week", "term"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`border-l border-gray-200 px-3 py-2 text-sm font-medium capitalize transition first:border-l-0 ${
                  viewMode === mode ? "bg-teal-500 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {(viewMode === "day" || viewMode === "week") && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => shiftDate(viewMode === "week" ? -7 : -1)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                aria-label={viewMode === "week" ? "Previous week" : "Previous day"}
              >
                &larr;
              </button>
              <button onClick={() => setSelectedDate(toLocalISODate(new Date()))} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Today</button>
              <button
                onClick={() => shiftDate(viewMode === "week" ? 7 : 1)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                aria-label={viewMode === "week" ? "Next week" : "Next day"}
              >
                &rarr;
              </button>
            </div>
            {viewMode === "day" && (
              <>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600"
                />
                <span className="text-sm font-medium text-gray-700">{formatDateLong(selectedDate)}</span>
              </>
            )}
            {viewMode === "week" && (
              <span className="text-sm font-medium text-gray-700">
                Week of {formatDateLong(toLocalISODate(getWeekStart(selectedDate)))}
              </span>
            )}
          </div>
        )}

        {viewMode === "term" && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => shiftTerm(-1)}
                disabled={myTerms.findIndex((t) => t.id === selectedTermId) <= 0}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                aria-label="Previous term"
              >
                &larr;
              </button>
              <button
                onClick={() => shiftTerm(1)}
                disabled={myTerms.findIndex((t) => t.id === selectedTermId) >= myTerms.length - 1}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                aria-label="Next term"
              >
                &rarr;
              </button>
            </div>
            {myTerms.length > 0 && (
              <select
                value={selectedTermId ?? ""}
                onChange={(e) => setSelectedTermId(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600"
              >
                {myTerms.map((t) => (
                  <option key={t.id} value={t.id}>{t.term_name}</option>
                ))}
              </select>
            )}
            {selectedTerm && (
              <span className="text-sm text-gray-500">
                {formatDateLong(selectedTerm.start_date)} &ndash; {formatDateLong(selectedTerm.end_date)}
              </span>
            )}
          </div>
        )}

        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : viewMode === "day" ? (
          dayClasses.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">No classes scheduled for {formatDateLong(selectedDate)}.</p>
          ) : (
            <div className="space-y-3">
              {dayClasses.map((c) => (
                <ClassCard key={c.id} c={c} dateStr={selectedDate} onReflect={(c, g) => setReflecting({ c, g })} />
              ))}
            </div>
          )
        ) : viewMode === "week" ? (
          <div className="space-y-2">
            {weekDays.map(({ dateStr, classes }) => {
              const d = new Date(dateStr + "T00:00:00");
              const isToday = dateStr === toLocalISODate(new Date());
              return (
                <div key={dateStr} className={`rounded-xl bg-white p-3 shadow-sm ${isToday ? "ring-1 ring-teal-300" : ""}`}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isToday ? "text-teal-600" : "text-gray-700"}`}>
                      {DAYS[d.getDay()].slice(0, 3)} {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0, 3)}
                    </span>
                    {isToday && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700">Today</span>}
                  </div>
                  {classes.length === 0 ? (
                    <p className="text-xs text-gray-400">No classes.</p>
                  ) : (
                    <div className="space-y-1">
                      {classes.map((c) => <ClassRow key={c.id} c={c} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // term
          termDays.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">
              {myTerms.length === 0 ? "No term schedule found for your classes." : "No sessions found in this term."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
                    <th className="w-[22%] px-4 py-2">Date</th>
                    <th className="px-4 py-2">Classes</th>
                  </tr>
                </thead>
                <tbody>
                  {termDays.map(({ dateStr, classes }) => {
                    const d = new Date(dateStr + "T00:00:00");
                    const isToday = dateStr === toLocalISODate(new Date());
                    return (
                      <tr key={dateStr} className={`border-b border-gray-50 last:border-0 ${isToday ? "bg-teal-50/50" : ""}`}>
                        <td className="px-4 py-2.5 align-top text-xs text-gray-600">
                          {DAYS[d.getDay()].slice(0, 3)} {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0, 3)}
                          {isToday && <span className="ml-1.5 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">Today</span>}
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          <div className="space-y-1.5">
                            {classes.map((c) => <ClassRow key={c.id} c={c} />)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {reflecting && swimmerId && (
        <SessionReflectionModal
          swimmerId={swimmerId}
          groupId={reflecting.g.id}
          lessonDate={selectedDate}
          className={reflecting.c.name}
          initial={reflecting.g.myReflection}
          onClose={() => setReflecting(null)}
          onSaved={() => {
            setReflecting(null);
            loadDay(swimmerId, selectedDate);
          }}
        />
      )}
    </div>
  );
}
