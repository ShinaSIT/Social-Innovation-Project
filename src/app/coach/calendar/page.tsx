"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import CoachHeader from "@/app/coach/components/CoachHeader";
import { toLocalISODate, formatTime, DAYS, MONTH_NAMES } from "@/utils/termSchedule";
import {
  CoachDay,
  SwimmerRow,
  GroupDay,
  DayClass,
  formatDateLong,
} from "@/utils/attendance";
import ClassAttendanceCard from "@/app/admin/components/ClassAttendanceCard";
import { RangeClassInfo, dateRangeArray, fetchCoverageRange } from "@/utils/coachCoverage";

function getWeekStart(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return d;
}

// Coach-facing General Calendar: same List-view attendance experience as
// admin's, but scoped to only the classes/groups this coach is actually
// covering on the selected date (their regular assignment, or that date's
// substitute override if admin has arranged one) — never the whole club's
// schedule. Coaches can't arrange substitutes themselves (admin-only), so
// this always renders with allowSubstitution={false}.
type ViewMode = "list" | "week" | "month";

export default function CoachCalendarPage() {
  const [selectedDate, setSelectedDate] = useState(toLocalISODate(new Date()));
  const [dayClasses, setDayClasses] = useState<DayClass[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [rangeClasses, setRangeClasses] = useState<Map<string, RangeClassInfo[]>>(new Map());
  const [rangeLoading, setRangeLoading] = useState(false);
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [popupClassId, setPopupClassId] = useState<string | null>(null);

  const loadDay = useCallback(async (dateStr: string) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");
      setCoachId(user.id);

      const fallbackId = ["00000000-0000-0000-0000-000000000000"];

      // 1. Which term schedule dates fall on this day and are actually running.
      const { data: lessonDates, error: ldError } = await supabase
        .from("term_schedule_dates")
        .select("term_schedule_id")
        .eq("lesson_date", dateStr)
        .eq("has_lesson", true);

      if (ldError) throw new Error("Failed to load lesson dates.");

      const termIds = Array.from(new Set((lessonDates ?? []).map((d) => d.term_schedule_id)));
      if (termIds.length === 0) {
        setDayClasses([]);
        setLoading(false);
        return;
      }

      // 2. Which classes those term schedules apply to.
      const { data: links } = await supabase
        .from("term_schedule_classes")
        .select("class_id")
        .in("term_schedule_id", termIds);

      const classIds = Array.from(new Set((links ?? []).map((l) => l.class_id)));
      if (classIds.length === 0) {
        setDayClasses([]);
        setLoading(false);
        return;
      }

      // 3. Class details + their groups.
      const [{ data: classes, error: classesError }, { data: groupRows }] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name, start_time, duration_minutes, location")
          .in("id", classIds)
          .eq("archived", false),
        supabase.from("class_groups").select("id, class_id, group_name").in("class_id", classIds),
      ]);

      if (classesError) throw new Error("Failed to load classes.");

      const groupIds = (groupRows ?? []).map((g) => g.id);
      const gFallback = groupIds.length ? groupIds : fallbackId;

      // 4. Regular roster + that date's override, to work out who's actually
      // covering each group today — same computation admin uses.
      const [{ data: gcRows }, { data: sessionCoaches }] = await Promise.all([
        supabase.from("class_group_coaches").select("group_id, coach_id").in("group_id", gFallback),
        supabase.from("class_session_coaches").select("class_group_id, coach_id").in("class_group_id", gFallback).eq("lesson_date", dateStr),
      ]);

      // 5. Keep only the groups where THIS coach is in the effective (not
      // just regular) coach list for today.
      const myGroupIds = (groupRows ?? [])
        .filter((g) => {
          const overrideIds = (sessionCoaches ?? []).filter((l) => l.class_group_id === g.id).map((l) => l.coach_id);
          const isSubstituted = overrideIds.length > 0;
          const effectiveIds = isSubstituted
            ? overrideIds
            : (gcRows ?? []).filter((l) => l.group_id === g.id).map((l) => l.coach_id);
          return effectiveIds.includes(user.id);
        })
        .map((g) => g.id);

      if (myGroupIds.length === 0) {
        setDayClasses([]);
        setLoading(false);
        return;
      }

      const myGroupRows = (groupRows ?? []).filter((g) => myGroupIds.includes(g.id));

      // 6. Everything else for those groups: full roster, status, attendance.
      const [
        { data: gsRows },
        { data: sessionLogs },
        { data: sessionSwimmers },
        { data: coachAttendance },
        { data: swimmerReflections },
      ] = await Promise.all([
        supabase.from("class_group_swimmers").select("group_id, swimmer_id").in("group_id", myGroupIds),
        supabase.from("class_session_logs").select("class_group_id, status, status_reason").in("class_group_id", myGroupIds).eq("lesson_date", dateStr),
        supabase.from("class_session_swimmers").select("class_group_id, swimmer_id, present, absence_reason, absence_note, attachment_path").in("class_group_id", myGroupIds).eq("lesson_date", dateStr),
        supabase.from("class_coach_attendance").select("class_group_id, coach_id, attended, absence_reason, absence_note, attachment_path").in("class_group_id", myGroupIds).eq("lesson_date", dateStr),
        supabase.from("swimmer_session_reflections").select("class_group_id, swimmer_id, feeling, difficulty, self_rating").in("class_group_id", myGroupIds).eq("lesson_date", dateStr),
      ]);

      const coachIds = Array.from(
        new Set([...(gcRows ?? []).map((l) => l.coach_id), ...(sessionCoaches ?? []).map((l) => l.coach_id)])
      );
      const swimmerIds = Array.from(new Set((gsRows ?? []).map((l) => l.swimmer_id)));

      const [{ data: coachProfiles }, { data: swimmerRows }, { data: swimmerProfiles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", coachIds.length ? coachIds : fallbackId),
        supabase.from("swimmers").select("id, level").in("id", swimmerIds.length ? swimmerIds : fallbackId),
        supabase.from("profiles").select("id, full_name").in("id", swimmerIds.length ? swimmerIds : fallbackId),
      ]);

      const nameMap = new Map([...(coachProfiles ?? []), ...(swimmerProfiles ?? [])].map((p) => [p.id, p.full_name ?? "Unknown"]));
      const levelMap = new Map((swimmerRows ?? []).map((s) => [s.id, s.level]));

      const merged: DayClass[] = (classes ?? [])
        .map((c) => {
          const classGroups = myGroupRows.filter((g) => g.class_id === c.id);
          if (classGroups.length === 0) return null;

          const groups: GroupDay[] = classGroups.map((g) => {
            const regularCoachIds = (gcRows ?? []).filter((l) => l.group_id === g.id).map((l) => l.coach_id);
            const overrideCoachIds = (sessionCoaches ?? []).filter((l) => l.class_group_id === g.id).map((l) => l.coach_id);
            const isSubstituted = overrideCoachIds.length > 0;
            const effectiveCoachIds = isSubstituted ? overrideCoachIds : regularCoachIds;

            const coaches: CoachDay[] = effectiveCoachIds.map((coachId) => {
              const att = (coachAttendance ?? []).find((a) => a.class_group_id === g.id && a.coach_id === coachId);
              return {
                id: coachId,
                name: nameMap.get(coachId) ?? "Unknown",
                isSubstitute: isSubstituted && !regularCoachIds.includes(coachId),
                attended: att ? att.attended : true,
                hasRecord: !!att,
                absence_reason: (att?.absence_reason as "cat1" | "mc" | "other" | null) ?? null,
                absence_note: att?.absence_note ?? "",
                attachment_path: att?.attachment_path ?? null,
              };
            });

            const log = (sessionLogs ?? []).find((l) => l.class_group_id === g.id);
            const roster = (gsRows ?? []).filter((l) => l.group_id === g.id);

            const swimmers: SwimmerRow[] = roster.map((r) => {
              const record = (sessionSwimmers ?? []).find((s) => s.class_group_id === g.id && s.swimmer_id === r.swimmer_id);
              const reflection = (swimmerReflections ?? []).find((s) => s.class_group_id === g.id && s.swimmer_id === r.swimmer_id);
              return {
                id: r.swimmer_id,
                name: nameMap.get(r.swimmer_id) ?? "Unknown",
                level: levelMap.get(r.swimmer_id) ?? null,
                present: record ? record.present : true,
                hasRecord: !!record,
                absence_reason: (record?.absence_reason as "mc" | "other" | null) ?? null,
                absence_note: record?.absence_note ?? "",
                attachment_path: record?.attachment_path ?? null,
                reflection: reflection
                  ? { feeling: reflection.feeling, difficulty: reflection.difficulty, self_rating: reflection.self_rating }
                  : null,
              };
            });

            return {
              id: g.id,
              group_name: g.group_name,
              coaches,
              regularCoachNames: regularCoachIds.map((id) => nameMap.get(id) ?? "Unknown"),
              status: log?.status ?? "ran",
              statusReason: log?.status_reason ?? "",
              swimmers,
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
        .filter((c): c is DayClass => !!c)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));

      setDayClasses(merged);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(toLocalISODate(d));
  };

  const shiftMonth = (delta: number) => {
    let m = calendarMonth + delta;
    let y = calendarYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCalendarMonth(m);
    setCalendarYear(y);
  };

  const loadRangeFor = useCallback(async (start: string, end: string) => {
    if (!coachId) return;
    const supabase = createClient();
    setRangeLoading(true);
    try {
      setRangeClasses(await fetchCoverageRange(supabase, coachId, start, end));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRangeLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    if (!coachId) return;
    if (viewMode === "week") {
      const start = getWeekStart(selectedDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      loadRangeFor(toLocalISODate(start), toLocalISODate(end));
    } else if (viewMode === "month") {
      const start = toLocalISODate(new Date(calendarYear, calendarMonth, 1));
      const end = toLocalISODate(new Date(calendarYear, calendarMonth + 1, 0));
      loadRangeFor(start, end);
    }
  }, [coachId, viewMode, selectedDate, calendarYear, calendarMonth, loadRangeFor]);

  const openClassPopup = (dateStr: string, classId: string) => {
    setPopupClassId(classId);
    setSelectedDate(dateStr);
  };

  const expandPopupToList = () => {
    setPopupClassId(null);
    setViewMode("list");
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // ── mutations — same tables as admin's, RLS scopes these to a coach's own
  // assigned groups automatically, so no extra checks needed here ──────────
  const handleSetStatus = async (groupId: string, status: string) => {
    setBusyKey(`status-${groupId}`);
    const supabase = createClient();
    await supabase
      .from("class_session_logs")
      .upsert(
        { class_group_id: groupId, lesson_date: selectedDate, status, marked_by: coachId, marked_at: new Date().toISOString() },
        { onConflict: "class_group_id,lesson_date" }
      );
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleSetStatusReason = async (groupId: string, status: string, reason: string) => {
    const supabase = createClient();
    await supabase
      .from("class_session_logs")
      .upsert(
        { class_group_id: groupId, lesson_date: selectedDate, status, status_reason: reason, marked_by: coachId, marked_at: new Date().toISOString() },
        { onConflict: "class_group_id,lesson_date" }
      );
    await loadDay(selectedDate);
  };

  const handleSetSwimmerPresent = async (groupId: string, swimmerId: string, present: boolean) => {
    setBusyKey(`sw-${groupId}-${swimmerId}`);
    const supabase = createClient();
    await supabase
      .from("class_session_swimmers")
      .upsert(
        {
          class_group_id: groupId,
          lesson_date: selectedDate,
          swimmer_id: swimmerId,
          present,
          absence_reason: present ? null : "other",
          marked_by: coachId,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "class_group_id,lesson_date,swimmer_id" }
      );
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleClearSwimmerRecord = async (groupId: string, swimmerId: string, attachmentPath: string | null) => {
    setBusyKey(`sw-${groupId}-${swimmerId}`);
    const supabase = createClient();
    if (attachmentPath) await supabase.storage.from("mc-attachments").remove([attachmentPath]);
    await supabase
      .from("class_session_swimmers")
      .delete()
      .eq("class_group_id", groupId)
      .eq("lesson_date", selectedDate)
      .eq("swimmer_id", swimmerId);
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleSetSwimmerAbsenceReason = async (groupId: string, swimmerId: string, reason: "mc" | "other") => {
    const supabase = createClient();
    await supabase
      .from("class_session_swimmers")
      .upsert(
        { class_group_id: groupId, lesson_date: selectedDate, swimmer_id: swimmerId, present: false, absence_reason: reason, marked_by: coachId, marked_at: new Date().toISOString() },
        { onConflict: "class_group_id,lesson_date,swimmer_id" }
      );
    await loadDay(selectedDate);
  };

  const handleSetSwimmerNote = async (groupId: string, swimmerId: string, note: string) => {
    const supabase = createClient();
    await supabase
      .from("class_session_swimmers")
      .update({ absence_note: note })
      .eq("class_group_id", groupId)
      .eq("lesson_date", selectedDate)
      .eq("swimmer_id", swimmerId);
  };

  const handleUploadSwimmerMC = async (groupId: string, swimmerId: string, file: File) => {
    setBusyKey(`mc-sw-${groupId}-${swimmerId}`);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `swimmers/${swimmerId}/${groupId}_${selectedDate}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("mc-attachments").upload(path, file, { upsert: true });
    if (!uploadError) {
      await supabase
        .from("class_session_swimmers")
        .upsert(
          { class_group_id: groupId, lesson_date: selectedDate, swimmer_id: swimmerId, present: false, absence_reason: "mc", attachment_path: path, marked_by: coachId, marked_at: new Date().toISOString() },
          { onConflict: "class_group_id,lesson_date,swimmer_id" }
        );
    } else {
      setError("MC upload failed: " + uploadError.message);
    }
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleRemoveSwimmerMC = async (groupId: string, swimmerId: string, path: string) => {
    setBusyKey(`mc-sw-${groupId}-${swimmerId}`);
    const supabase = createClient();
    await supabase.storage.from("mc-attachments").remove([path]);
    await supabase
      .from("class_session_swimmers")
      .update({ attachment_path: null })
      .eq("class_group_id", groupId)
      .eq("lesson_date", selectedDate)
      .eq("swimmer_id", swimmerId);
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleViewMC = async (path: string) => {
    const supabase = createClient();
    const { data, error: signError } = await supabase.storage.from("mc-attachments").createSignedUrl(path, 300);
    if (signError || !data) {
      setError("Couldn't open attachment: " + (signError?.message ?? "unknown error"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleMarkAllPresent = async (groupId: string, swimmerIds: string[]) => {
    setBusyKey(`markall-${groupId}`);
    const supabase = createClient();
    await supabase.from("class_session_swimmers").upsert(
      swimmerIds.map((swimmerId) => ({
        class_group_id: groupId,
        lesson_date: selectedDate,
        swimmer_id: swimmerId,
        present: true,
        absence_reason: null,
        marked_by: coachId,
        marked_at: new Date().toISOString(),
      })),
      { onConflict: "class_group_id,lesson_date,swimmer_id" }
    );
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleSetCoachAttended = async (groupId: string, coachIdArg: string, attended: boolean) => {
    setBusyKey(`coach-${groupId}-${coachIdArg}`);
    const supabase = createClient();
    await supabase
      .from("class_coach_attendance")
      .upsert(
        {
          class_group_id: groupId,
          lesson_date: selectedDate,
          coach_id: coachIdArg,
          attended,
          absence_reason: attended ? null : "other",
          marked_by: coachId,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "class_group_id,lesson_date,coach_id" }
      );
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleClearCoachRecord = async (groupId: string, coachIdArg: string, attachmentPath: string | null) => {
    setBusyKey(`coach-${groupId}-${coachIdArg}`);
    const supabase = createClient();
    if (attachmentPath) await supabase.storage.from("mc-attachments").remove([attachmentPath]);
    await supabase
      .from("class_coach_attendance")
      .delete()
      .eq("class_group_id", groupId)
      .eq("lesson_date", selectedDate)
      .eq("coach_id", coachIdArg);
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleSetCoachAbsenceReason = async (groupId: string, coachIdArg: string, reason: "cat1" | "mc" | "other") => {
    const supabase = createClient();
    await supabase
      .from("class_coach_attendance")
      .upsert(
        { class_group_id: groupId, lesson_date: selectedDate, coach_id: coachIdArg, attended: false, absence_reason: reason, marked_by: coachId, marked_at: new Date().toISOString() },
        { onConflict: "class_group_id,lesson_date,coach_id" }
      );
    await loadDay(selectedDate);
  };

  const handleSetCoachNote = async (groupId: string, coachIdArg: string, note: string) => {
    const supabase = createClient();
    await supabase
      .from("class_coach_attendance")
      .update({ absence_note: note })
      .eq("class_group_id", groupId)
      .eq("lesson_date", selectedDate)
      .eq("coach_id", coachIdArg);
  };

  const handleUploadCoachMC = async (groupId: string, coachIdArg: string, file: File) => {
    setBusyKey(`mc-coach-${groupId}-${coachIdArg}`);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `coaches/${coachIdArg}/${groupId}_${selectedDate}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("mc-attachments").upload(path, file, { upsert: true });
    if (!uploadError) {
      await supabase
        .from("class_coach_attendance")
        .upsert(
          { class_group_id: groupId, lesson_date: selectedDate, coach_id: coachIdArg, attended: false, absence_reason: "mc", attachment_path: path, marked_by: coachId, marked_at: new Date().toISOString() },
          { onConflict: "class_group_id,lesson_date,coach_id" }
        );
    } else {
      setError("MC upload failed: " + uploadError.message);
    }
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleRemoveCoachMC = async (groupId: string, coachIdArg: string, path: string) => {
    setBusyKey(`mc-coach-${groupId}-${coachIdArg}`);
    const supabase = createClient();
    await supabase.storage.from("mc-attachments").remove([path]);
    await supabase
      .from("class_coach_attendance")
      .update({ attachment_path: null })
      .eq("class_group_id", groupId)
      .eq("lesson_date", selectedDate)
      .eq("coach_id", coachIdArg);
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  // Coaches can't arrange substitutes themselves — admin-only — so these are
  // never actually invoked (ClassAttendanceCard hides the controls that
  // would call them when allowSubstitution is false), but the component
  // still requires the props to exist.
  const noopOverride = async () => {};

  const attendanceCardFor = (c: DayClass) => (
    <ClassAttendanceCard
      key={c.id}
      c={c}
      dateStr={selectedDate}
      allowSubstitution={false}
      linkToClass={false}
      expandedGroups={expandedGroups}
      toggleGroupExpanded={toggleGroupExpanded}
      busyKey={busyKey}
      allClubCoaches={[]}
      handleSetStatus={handleSetStatus}
      handleSetStatusReason={handleSetStatusReason}
      handleSetCoachAttended={handleSetCoachAttended}
      handleClearCoachRecord={handleClearCoachRecord}
      handleSetCoachAbsenceReason={handleSetCoachAbsenceReason}
      handleSetCoachNote={handleSetCoachNote}
      handleAddOverrideCoach={noopOverride}
      handleRemoveOverrideCoach={noopOverride}
      handleUploadCoachMC={handleUploadCoachMC}
      handleRemoveCoachMC={handleRemoveCoachMC}
      handleViewMC={handleViewMC}
      handleMarkAllPresent={handleMarkAllPresent}
      handleSetSwimmerPresent={handleSetSwimmerPresent}
      handleClearSwimmerRecord={handleClearSwimmerRecord}
      handleSetSwimmerAbsenceReason={handleSetSwimmerAbsenceReason}
      handleSetSwimmerNote={handleSetSwimmerNote}
      handleUploadSwimmerMC={handleUploadSwimmerMC}
      handleRemoveSwimmerMC={handleRemoveSwimmerMC}
    />
  );

  const todayStr = toLocalISODate(new Date());

  return (
    <div className="min-h-screen bg-gray-50">
      <CoachHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-800">My Calendar</h1>
            <p className="text-sm text-gray-500">The classes you're covering, and their attendance.</p>
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
            {(["list", "week", "month"] as ViewMode[]).map((mode) => (
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

        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        {viewMode === "list" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button onClick={() => shiftDate(-1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" aria-label="Previous day">&larr;</button>
                <button onClick={() => setSelectedDate(toLocalISODate(new Date()))} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Today</button>
                <button onClick={() => shiftDate(1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" aria-label="Next day">&rarr;</button>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600"
              />
              <span className="text-sm font-medium text-gray-700">{formatDateLong(selectedDate)}</span>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : dayClasses.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">You're not covering any classes on {formatDateLong(selectedDate)}.</p>
            ) : (
              <div className="space-y-3">{dayClasses.map((c) => attendanceCardFor(c))}</div>
            )}
          </>
        )}

        {viewMode === "week" && (() => {
          const start = getWeekStart(selectedDate);
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            return toLocalISODate(d);
          });
          return (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => shiftDate(-7)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" aria-label="Previous week">&larr;</button>
                  <button onClick={() => setSelectedDate(toLocalISODate(new Date()))} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Today</button>
                  <button onClick={() => shiftDate(7)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" aria-label="Next week">&rarr;</button>
                </div>
                <span className="text-sm font-medium text-gray-700">Week of {formatDateLong(toLocalISODate(start))}</span>
                {rangeLoading && <span className="text-xs text-gray-400">Loading...</span>}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
                {days.map((dateStr) => {
                  const d = new Date(dateStr + "T00:00:00");
                  const isToday = dateStr === todayStr;
                  const classes = rangeClasses.get(dateStr) ?? [];
                  return (
                    <div key={dateStr} className={`rounded-xl bg-white p-3 shadow-sm ${isToday ? "ring-1 ring-teal-300" : ""}`}>
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className={`text-sm font-semibold ${isToday ? "text-teal-600" : "text-gray-700"}`}>
                          {DAYS[d.getDay()].slice(0, 3)} {d.getDate()}
                        </span>
                      </div>
                      {classes.length === 0 ? (
                        <p className="text-xs text-gray-400">No classes.</p>
                      ) : (
                        <div className="space-y-1">
                          {classes.map((c) => (
                            <button
                              key={c.groupId}
                              onClick={() => openClassPopup(dateStr, c.classId)}
                              className={`block w-full truncate rounded px-1.5 py-1 text-left text-xs font-medium ${
                                c.cancelled ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}
                            >
                              {formatTime(c.start_time)} {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {viewMode === "month" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button onClick={() => shiftMonth(-1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" aria-label="Previous month">&larr;</button>
              <button
                onClick={() => { const t = new Date(); setCalendarYear(t.getFullYear()); setCalendarMonth(t.getMonth()); }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Today
              </button>
              <button onClick={() => shiftMonth(1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" aria-label="Next month">&rarr;</button>
              <span className="text-sm font-medium text-gray-700">{MONTH_NAMES[calendarMonth]} {calendarYear}</span>
              {rangeLoading && <span className="text-xs text-gray-400">Loading...</span>}
            </div>

            <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400">
                {DAYS.map((d) => <div key={d} className="py-1">{d.slice(0, 3)}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const firstOfMonth = new Date(calendarYear, calendarMonth, 1);
                  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                  const leadingBlanks = firstOfMonth.getDay();
                  const cells: (number | null)[] = [
                    ...Array(leadingBlanks).fill(null),
                    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                  ];
                  return cells.map((day, i) => {
                    if (day === null) return <div key={`blank-${i}`} />;
                    const dateStr = toLocalISODate(new Date(calendarYear, calendarMonth, day));
                    const classes = rangeClasses.get(dateStr) ?? [];
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;
                    const visiblePills = classes.slice(0, 2);
                    const extra = classes.length - visiblePills.length;
                    return (
                      <div
                        key={dateStr}
                        role="button"
                        tabIndex={0}
                        onClick={() => (classes.length > 0 ? setPopupDate(dateStr) : setSelectedDate(dateStr))}
                        onKeyDown={(e) => { if (e.key === "Enter") (classes.length > 0 ? setPopupDate(dateStr) : setSelectedDate(dateStr)); }}
                        className={`flex min-h-[64px] cursor-pointer flex-col items-stretch gap-0.5 rounded-lg border p-1 text-left transition hover:bg-gray-50 ${
                          isSelected ? "border-teal-400 bg-teal-50" : isToday ? "border-teal-200" : "border-transparent"
                        }`}
                      >
                        <span className={`px-0.5 text-sm font-medium ${isToday ? "text-teal-600" : "text-gray-700"}`}>{day}</span>
                        {visiblePills.map((c) => (
                          <button
                            key={c.groupId}
                            onClick={(e) => { e.stopPropagation(); openClassPopup(dateStr, c.classId); }}
                            className={`truncate rounded px-1 py-0.5 text-left text-[10px] font-medium ${
                              c.cancelled ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}
                        {extra > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPopupDate(dateStr); }}
                            className="px-1 text-left text-[10px] text-gray-400 hover:underline"
                          >
                            +{extra} more
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </>
        )}

        {popupDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4" onClick={() => setPopupDate(null)}>
            <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{formatDateLong(popupDate)}</span>
                <button onClick={() => setPopupDate(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">&times;</button>
              </div>
              <div className="space-y-1.5">
                {(rangeClasses.get(popupDate) ?? []).map((c) => (
                  <button
                    key={c.groupId}
                    onClick={() => { openClassPopup(popupDate, c.classId); setPopupDate(null); }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-800">{c.name}</span>
                      <span className="block truncate text-xs text-gray-500">{formatTime(c.start_time)} · {c.groupName}</span>
                    </span>
                    <span className="text-xs text-teal-600 whitespace-nowrap">Expand &rsaquo;</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {popupClassId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4" onClick={() => setPopupClassId(null)}>
            <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-800">{formatDateLong(selectedDate)}</span>
                <div className="flex items-center gap-3">
                  <button onClick={expandPopupToList} className="flex items-center gap-1 text-xs text-teal-600 hover:underline" title="Open in List view">
                    Expand &#8599;
                  </button>
                  <button onClick={() => setPopupClassId(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">&times;</button>
                </div>
              </div>
              {loading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : (() => {
                const cls = dayClasses.find((d) => d.id === popupClassId);
                if (!cls) return <p className="text-sm text-gray-500">This class isn't scheduled on this date.</p>;
                return attendanceCardFor(cls);
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
