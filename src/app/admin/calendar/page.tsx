"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminHeader from "@/app/admin/components/AdminHeader";
import { formatTime, toLocalISODate, DAYS, MONTH_NAMES } from "@/utils/termSchedule";
import {
  CoachDay,
  SwimmerRow,
  GroupDay,
  MonthClassInfo,
  DayClass,
  SESSION_STATUS_OPTIONS,
  COACH_ABSENCE_REASONS,
  formatDateLong,
} from "@/utils/attendance";
import ClassAttendanceCard from "@/app/admin/components/ClassAttendanceCard";

export default function AdminCalendarPage() {
  const [selectedDate, setSelectedDate] = useState(toLocalISODate(new Date()));
  const [dayClasses, setDayClasses] = useState<DayClass[]>([]);
  const [allClubCoaches, setAllClubCoaches] = useState<{ id: string; name: string }[]>([]);
  const [coachFilter, setCoachFilter] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth()); // 0-11
  const [monthClasses, setMonthClasses] = useState<Map<string, MonthClassInfo[]>>(new Map());
  const [monthLoading, setMonthLoading] = useState(false);
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [popupClassId, setPopupClassId] = useState<string | null>(null);

  const loadMonth = useCallback(async (year: number, month: number) => {
    const supabase = createClient();
    setMonthLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminProfile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
      const clubId = adminProfile?.club_id ?? null;

      const monthStart = toLocalISODate(new Date(year, month, 1));
      const monthEnd = toLocalISODate(new Date(year, month + 1, 0));

      const { data: lessonDates } = await supabase
        .from("term_schedule_dates")
        .select("lesson_date, term_schedule_id")
        .gte("lesson_date", monthStart)
        .lte("lesson_date", monthEnd)
        .eq("has_lesson", true);

      const termIds = Array.from(new Set((lessonDates ?? []).map((d) => d.term_schedule_id)));
      const fallbackId = ["00000000-0000-0000-0000-000000000000"];

      const { data: links } = await supabase
        .from("term_schedule_classes")
        .select("term_schedule_id, class_id")
        .in("term_schedule_id", termIds.length ? termIds : fallbackId);

      const linkedClassIds = Array.from(new Set((links ?? []).map((l) => l.class_id)));
      const { data: validClasses } = await supabase
        .from("classes")
        .select("id, name, start_time")
        .eq("club_id", clubId)
        .in("id", linkedClassIds.length ? linkedClassIds : fallbackId);
      const validClassIds = new Set((validClasses ?? []).map((c) => c.id));
      const classInfoMap = new Map((validClasses ?? []).map((c) => [c.id, c]));

      // Coach names per class, for the popup (regular assignment only — kept light).
      const { data: groupRows } = await supabase
        .from("class_groups")
        .select("id, class_id")
        .in("class_id", validClasses?.length ? Array.from(validClassIds) : fallbackId);
      const groupIds = (groupRows ?? []).map((g) => g.id);
      const { data: gcRows } = await supabase
        .from("class_group_coaches")
        .select("group_id, coach_id")
        .in("group_id", groupIds.length ? groupIds : fallbackId);
      const coachIds = Array.from(new Set((gcRows ?? []).map((l) => l.coach_id)));
      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", coachIds.length ? coachIds : fallbackId);
      const coachNameMap = new Map((coachProfiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));

      const classCoachNames = new Map<string, string[]>();
      (groupRows ?? []).forEach((g) => {
        const names = (gcRows ?? [])
          .filter((l) => l.group_id === g.id)
          .map((l) => coachNameMap.get(l.coach_id) ?? "Unknown");
        const existing = classCoachNames.get(g.class_id) ?? [];
        classCoachNames.set(g.class_id, Array.from(new Set([...existing, ...names])));
      });

      // Session status per group per date, so cancelled sessions can be flagged red.
      const { data: logRows } = await supabase
        .from("class_session_logs")
        .select("class_group_id, lesson_date, status")
        .in("class_group_id", groupIds.length ? groupIds : fallbackId)
        .gte("lesson_date", monthStart)
        .lte("lesson_date", monthEnd);

      const groupToClass = new Map((groupRows ?? []).map((g) => [g.id, g.class_id]));
      const cancelledSet = new Set<string>(); // `${classId}|${dateStr}`
      (logRows ?? []).forEach((l) => {
        if (l.status !== "cancelled") return;
        const classId = groupToClass.get(l.class_group_id);
        if (classId) cancelledSet.add(`${classId}|${l.lesson_date}`);
      });

      const dateClassSets = new Map<string, Set<string>>();
      (lessonDates ?? []).forEach((d) => {
        const classIdsForTerm = (links ?? [])
          .filter((l) => l.term_schedule_id === d.term_schedule_id)
          .map((l) => l.class_id)
          .filter((id) => validClassIds.has(id));
        if (classIdsForTerm.length === 0) return;
        if (!dateClassSets.has(d.lesson_date)) dateClassSets.set(d.lesson_date, new Set());
        const set = dateClassSets.get(d.lesson_date)!;
        classIdsForTerm.forEach((id) => set.add(id));
      });

      const finalClasses = new Map<string, MonthClassInfo[]>();
      dateClassSets.forEach((set, dateStr) => {
        const list = Array.from(set)
          .map((id) => classInfoMap.get(id))
          .filter((c): c is { id: string; name: string; start_time: string } => !!c)
          .map((c) => ({
            id: c.id,
            name: c.name,
            start_time: c.start_time,
            coachNames: classCoachNames.get(c.id) ?? [],
            cancelled: cancelledSet.has(`${c.id}|${dateStr}`),
          }))
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        finalClasses.set(dateStr, list);
      });

      setMonthClasses(finalClasses);
    } finally {
      setMonthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "calendar") loadMonth(calendarYear, calendarMonth);
  }, [viewMode, calendarYear, calendarMonth, loadMonth]);

  const shiftMonth = (delta: number) => {
    let m = calendarMonth + delta;
    let y = calendarYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCalendarMonth(m);
    setCalendarYear(y);
  };

  const jumpToDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setViewMode("list");
  };

  const openClassPopup = (dateStr: string, classId: string) => {
    setPopupClassId(classId);
    setSelectedDate(dateStr);
  };

  const expandPopupToList = () => {
    setPopupClassId(null);
    setViewMode("list");
  };

  const loadDay = useCallback(async (dateStr: string) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");
      setUserId(user.id);

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

      const clubId = adminProfile?.club_id ?? null;
      const fallbackId = ["00000000-0000-0000-0000-000000000000"];

      const { data: clubCoachRows } = await supabase.from("coaches").select("id").eq("club_id", clubId);
      const clubCoachIds = (clubCoachRows ?? []).map((c) => c.id);

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
        setAllClubCoaches([]);
        setLoading(false);
        return;
      }

      // 2. Which classes those term schedules apply to.
      const { data: links, error: linksError } = await supabase
        .from("term_schedule_classes")
        .select("class_id")
        .in("term_schedule_id", termIds);

      if (linksError) throw new Error("Failed to load linked classes.");

      const classIds = Array.from(new Set((links ?? []).map((l) => l.class_id)));

      if (classIds.length === 0) {
        setDayClasses([]);
        setAllClubCoaches([]);
        setLoading(false);
        return;
      }

      // 3. Class details + their groups.
      const [{ data: classes, error: classesError }, { data: groupRows }] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name, start_time, duration_minutes, location")
          .in("id", classIds)
          .eq("club_id", clubId)
          .eq("archived", false)
          .order("start_time", { ascending: true }),
        supabase.from("class_groups").select("id, class_id, group_name").in("class_id", classIds),
      ]);

      if (classesError) throw new Error("Failed to load classes.");

      const groupIds = (groupRows ?? []).map((g) => g.id);
      const gFallback = groupIds.length ? groupIds : fallbackId;

      // 4. Everything for those groups: regular roster, date overrides, status, attendance.
      const [
        { data: gcRows },
        { data: gsRows },
        { data: sessionLogs },
        { data: sessionCoaches },
        { data: sessionSwimmers },
        { data: coachAttendance },
      ] = await Promise.all([
        supabase.from("class_group_coaches").select("group_id, coach_id").in("group_id", gFallback),
        supabase.from("class_group_swimmers").select("group_id, swimmer_id").in("group_id", gFallback),
        supabase.from("class_session_logs").select("class_group_id, status, status_reason").in("class_group_id", gFallback).eq("lesson_date", dateStr),
        supabase.from("class_session_coaches").select("class_group_id, coach_id").in("class_group_id", gFallback).eq("lesson_date", dateStr),
        supabase.from("class_session_swimmers").select("class_group_id, swimmer_id, present, absence_reason, absence_note, attachment_path").in("class_group_id", gFallback).eq("lesson_date", dateStr),
        supabase.from("class_coach_attendance").select("class_group_id, coach_id, attended, absence_reason, absence_note, attachment_path").in("class_group_id", gFallback).eq("lesson_date", dateStr),
      ]);

      const swimmerIds = Array.from(new Set((gsRows ?? []).map((l) => l.swimmer_id)));
      // Names: every club coach (so substitute pickers never show "Unknown") + every enrolled swimmer.
      const [{ data: coachProfiles }, { data: swimmerRows }, { data: swimmerProfiles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", clubCoachIds.length ? clubCoachIds : fallbackId),
        supabase.from("swimmers").select("id, level").in("id", swimmerIds.length ? swimmerIds : fallbackId),
        supabase.from("profiles").select("id, full_name").in("id", swimmerIds.length ? swimmerIds : fallbackId),
      ]);

      const nameMap = new Map([...(coachProfiles ?? []), ...(swimmerProfiles ?? [])].map((p) => [p.id, p.full_name ?? "Unknown"]));
      const levelMap = new Map((swimmerRows ?? []).map((s) => [s.id, s.level]));

      const merged: DayClass[] = (classes ?? []).map((c) => {
        const classGroups = (groupRows ?? []).filter((g) => g.class_id === c.id);
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
            return {
              id: r.swimmer_id,
              name: nameMap.get(r.swimmer_id) ?? "Unknown",
              level: levelMap.get(r.swimmer_id) ?? null,
              present: record ? record.present : true,
              hasRecord: !!record,
              absence_reason: (record?.absence_reason as "mc" | "other" | null) ?? null,
              absence_note: record?.absence_note ?? "",
              attachment_path: record?.attachment_path ?? null,
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
      });

      setDayClasses(merged);
      setAllClubCoaches(
        clubCoachIds.map((id) => ({ id, name: nameMap.get(id) ?? "Unknown" })).sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
    setCoachFilter(null);
  }, [selectedDate, loadDay]);

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(toLocalISODate(d));
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // ── mutations ────────────────────────────────────────────────────────
  const handleSetStatus = async (groupId: string, status: string) => {
    setBusyKey(`status-${groupId}`);
    const supabase = createClient();
    await supabase
      .from("class_session_logs")
      .upsert(
        { class_group_id: groupId, lesson_date: selectedDate, status, marked_by: userId, marked_at: new Date().toISOString() },
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
        { class_group_id: groupId, lesson_date: selectedDate, status, status_reason: reason, marked_by: userId, marked_at: new Date().toISOString() },
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
          marked_by: userId,
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
        { class_group_id: groupId, lesson_date: selectedDate, swimmer_id: swimmerId, present: false, absence_reason: reason, marked_by: userId, marked_at: new Date().toISOString() },
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
          { class_group_id: groupId, lesson_date: selectedDate, swimmer_id: swimmerId, present: false, absence_reason: "mc", attachment_path: path, marked_by: userId, marked_at: new Date().toISOString() },
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
        marked_by: userId,
        marked_at: new Date().toISOString(),
      })),
      { onConflict: "class_group_id,lesson_date,swimmer_id" }
    );
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleSetCoachAttended = async (groupId: string, coachId: string, attended: boolean) => {
    setBusyKey(`coach-${groupId}-${coachId}`);
    const supabase = createClient();
    await supabase
      .from("class_coach_attendance")
      .upsert(
        {
          class_group_id: groupId,
          lesson_date: selectedDate,
          coach_id: coachId,
          attended,
          absence_reason: attended ? null : "other",
          marked_by: userId,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "class_group_id,lesson_date,coach_id" }
      );
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleClearCoachRecord = async (groupId: string, coachId: string, attachmentPath: string | null) => {
    setBusyKey(`coach-${groupId}-${coachId}`);
    const supabase = createClient();
    if (attachmentPath) await supabase.storage.from("mc-attachments").remove([attachmentPath]);
    await supabase
      .from("class_coach_attendance")
      .delete()
      .eq("class_group_id", groupId)
      .eq("lesson_date", selectedDate)
      .eq("coach_id", coachId);
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleSetCoachAbsenceReason = async (groupId: string, coachId: string, reason: "cat1" | "mc" | "other") => {
    const supabase = createClient();
    await supabase
      .from("class_coach_attendance")
      .upsert(
        { class_group_id: groupId, lesson_date: selectedDate, coach_id: coachId, attended: false, absence_reason: reason, marked_by: userId, marked_at: new Date().toISOString() },
        { onConflict: "class_group_id,lesson_date,coach_id" }
      );
    await loadDay(selectedDate);
  };

  const handleSetCoachNote = async (groupId: string, coachId: string, note: string) => {
    const supabase = createClient();
    await supabase
      .from("class_coach_attendance")
      .update({ absence_note: note })
      .eq("class_group_id", groupId)
      .eq("lesson_date", selectedDate)
      .eq("coach_id", coachId);
  };

  const handleUploadCoachMC = async (groupId: string, coachId: string, file: File) => {
    setBusyKey(`mc-coach-${groupId}-${coachId}`);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `coaches/${coachId}/${groupId}_${selectedDate}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("mc-attachments").upload(path, file, { upsert: true });
    if (!uploadError) {
      await supabase
        .from("class_coach_attendance")
        .upsert(
          { class_group_id: groupId, lesson_date: selectedDate, coach_id: coachId, attended: false, absence_reason: "mc", attachment_path: path, marked_by: userId, marked_at: new Date().toISOString() },
          { onConflict: "class_group_id,lesson_date,coach_id" }
        );
    } else {
      setError("MC upload failed: " + uploadError.message);
    }
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleRemoveCoachMC = async (groupId: string, coachId: string, path: string) => {
    setBusyKey(`mc-coach-${groupId}-${coachId}`);
    const supabase = createClient();
    await supabase.storage.from("mc-attachments").remove([path]);
    await supabase
      .from("class_coach_attendance")
      .update({ attachment_path: null })
      .eq("class_group_id", groupId)
      .eq("lesson_date", selectedDate)
      .eq("coach_id", coachId);
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleAddOverrideCoach = async (groupId: string, coachId: string) => {
    setBusyKey(`addsub-${groupId}-${coachId}`);
    const supabase = createClient();
    await supabase.from("class_session_coaches").insert({
      class_group_id: groupId,
      lesson_date: selectedDate,
      coach_id: coachId,
      assigned_by: userId,
    });
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  const handleRemoveOverrideCoach = async (groupId: string, coachId: string) => {
    setBusyKey(`addsub-${groupId}-${coachId}`);
    const supabase = createClient();
    await supabase
      .from("class_session_coaches")
      .delete()
      .eq("class_group_id", groupId)
      .eq("lesson_date", selectedDate)
      .eq("coach_id", coachId);
    await loadDay(selectedDate);
    setBusyKey(null);
  };

  // ── derived ──────────────────────────────────────────────────────────
  const allCoachOptions = (() => {
    const map = new Map<string, string>();
    dayClasses.forEach((c) => c.groups.forEach((g) => g.coaches.forEach((p) => map.set(p.id, p.name))));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const filteredClasses = coachFilter
    ? dayClasses
        .map((c) => ({ ...c, groups: c.groups.filter((g) => g.coaches.some((p) => p.id === coachFilter)) }))
        .filter((c) => c.groups.length > 0)
    : dayClasses;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">General Calendar</h1>
            <p className="text-sm text-gray-500">Every class running on a given day, across the whole school.</p>
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 text-sm font-medium transition ${viewMode === "list" ? "bg-teal-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`border-l border-gray-200 px-3 py-2 text-sm font-medium transition ${viewMode === "calendar" ? "bg-teal-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Calendar
            </button>
          </div>
        </div>

        {viewMode === "calendar" && (
          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <button onClick={() => shiftMonth(-1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" aria-label="Previous month">&larr;</button>
              <button
                onClick={() => { const t = new Date(); setCalendarYear(t.getFullYear()); setCalendarMonth(t.getMonth()); }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Today
              </button>
              <button onClick={() => shiftMonth(1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" aria-label="Next month">&rarr;</button>
              <span className="text-sm font-medium text-gray-700">{MONTH_NAMES[calendarMonth]} {calendarYear}</span>
              {monthLoading && <span className="text-xs text-gray-400">Loading...</span>}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400">
              {DAYS.map((d) => (
                <div key={d} className="py-1">{d.slice(0, 3)}</div>
              ))}
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
                const todayStr = toLocalISODate(new Date());
                return cells.map((day, i) => {
                  if (day === null) return <div key={`blank-${i}`} />;
                  const dateStr = toLocalISODate(new Date(calendarYear, calendarMonth, day));
                  const classes = monthClasses.get(dateStr) ?? [];
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const visiblePills = classes.slice(0, 2);
                  const extra = classes.length - visiblePills.length;
                  return (
                    <div
                      key={dateStr}
                      role="button"
                      tabIndex={0}
                      onClick={() => (classes.length > 0 ? setPopupDate(dateStr) : jumpToDate(dateStr))}
                      onKeyDown={(e) => { if (e.key === "Enter") (classes.length > 0 ? setPopupDate(dateStr) : jumpToDate(dateStr)); }}
                      className={`flex min-h-[64px] cursor-pointer flex-col items-stretch gap-0.5 rounded-lg border p-1 text-left transition hover:bg-gray-50 ${
                        isSelected ? "border-teal-400 bg-teal-50" : isToday ? "border-teal-200" : "border-transparent"
                      }`}
                    >
                      <span className={`px-0.5 text-sm font-medium ${isToday ? "text-teal-600" : "text-gray-700"}`}>{day}</span>
                      {visiblePills.map((c) => (
                        <button
                          key={c.id}
                          onClick={(e) => { e.stopPropagation(); openClassPopup(dateStr, c.id); }}
                          className={`truncate rounded px-1 py-0.5 text-left text-[10px] font-medium ${
                            c.cancelled
                              ? "bg-red-100 text-red-700 hover:bg-red-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
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
        )}

        {popupDate && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
            onClick={() => setPopupDate(null)}
          >
            <div
              className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{formatDateLong(popupDate)}</span>
                <button onClick={() => setPopupDate(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">&times;</button>
              </div>
              <div className="space-y-1.5">
                {(monthClasses.get(popupDate) ?? []).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { openClassPopup(popupDate, c.id); setPopupDate(null); }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-800">{c.name}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {formatTime(c.start_time)}{c.coachNames.length > 0 ? ` · ${c.coachNames.join(", ")}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-teal-600 whitespace-nowrap">Expand &rsaquo;</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {popupClassId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
            onClick={() => setPopupClassId(null)}
          >
            <div
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-800">{formatDateLong(selectedDate)}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={expandPopupToList}
                    className="flex items-center gap-1 text-xs text-teal-600 hover:underline"
                    title="Open in List view"
                  >
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
                return (
                  <ClassAttendanceCard
                    c={cls}
                    dateStr={selectedDate}
                    allowSubstitution={false}
                    expandedGroups={expandedGroups}
                    toggleGroupExpanded={toggleGroupExpanded}
                    busyKey={busyKey}
                    allClubCoaches={allClubCoaches}
                    handleSetStatus={handleSetStatus}
                    handleSetStatusReason={handleSetStatusReason}
                    handleSetCoachAttended={handleSetCoachAttended}
                    handleClearCoachRecord={handleClearCoachRecord}
                    handleSetCoachAbsenceReason={handleSetCoachAbsenceReason}
                    handleSetCoachNote={handleSetCoachNote}
                    handleAddOverrideCoach={handleAddOverrideCoach}
                    handleRemoveOverrideCoach={handleRemoveOverrideCoach}
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
              })()}
            </div>
          </div>
        )}

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

          {allCoachOptions.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-400">Coach:</span>
              <button
                onClick={() => setCoachFilter(null)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${coachFilter === null ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                All
              </button>
              {allCoachOptions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCoachFilter(c.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${coachFilter === c.id ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : filteredClasses.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">No classes scheduled for {formatDateLong(selectedDate)}.</p>
        ) : (
          <div className="space-y-3">
            {filteredClasses.map((c) => (
              <ClassAttendanceCard
                key={c.id}
                c={c}
                dateStr={selectedDate}
                expandedGroups={expandedGroups}
                toggleGroupExpanded={toggleGroupExpanded}
                busyKey={busyKey}
                allClubCoaches={allClubCoaches}
                handleSetStatus={handleSetStatus}
                handleSetStatusReason={handleSetStatusReason}
                handleSetCoachAttended={handleSetCoachAttended}
                handleClearCoachRecord={handleClearCoachRecord}
                handleSetCoachAbsenceReason={handleSetCoachAbsenceReason}
                handleSetCoachNote={handleSetCoachNote}
                handleAddOverrideCoach={handleAddOverrideCoach}
                handleRemoveOverrideCoach={handleRemoveOverrideCoach}
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
            ))}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
