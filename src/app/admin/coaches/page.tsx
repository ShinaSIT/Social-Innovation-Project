"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import AdminHeader from "@/app/admin/components/AdminHeader";
import ClassesStudentsTabs from "@/app/admin/components/ClassesStudentsTabs";
import { toLocalISODate, MONTH_NAMES, formatTimeRange } from "@/utils/termSchedule";
import { COACH_ABSENCE_REASONS, formatDateLong } from "@/utils/attendance";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { fetchCoverageRange } from "@/utils/coachCoverage";

interface CoachRow {
  id: string;
  name: string;
  isActive: boolean;
  ratePerClass: number | null;
  classesAttended: number;
}

type DayStatus = "attended" | "not_attended" | "pending" | "cancelled";

interface DayDetail {
  groupId: string;
  lessonDate: string;
  className: string;
  groupName: string;
  startTime: string;
  durationMinutes: number;
  status: DayStatus;
  absenceReason: string | null;
  absenceNote: string | null;
}

const ABSENCE_REASON_LABELS: Record<string, string> = Object.fromEntries(
  COACH_ABSENCE_REASONS.map((r) => [r.value, r.label])
);

const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  attended: "Attended",
  not_attended: "Not attended",
  pending: "Not marked yet",
  cancelled: "Cancelled",
};

const DAY_STATUS_STYLES: Record<DayStatus, string> = {
  attended: "border-green-100 bg-green-50",
  not_attended: "border-red-100 bg-red-50",
  pending: "border-amber-100 bg-amber-50",
  cancelled: "border-gray-200 bg-gray-50",
};

const DAY_STATUS_BADGE_STYLES: Record<DayStatus, string> = {
  attended: "bg-green-100 text-green-700",
  not_attended: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-200 text-gray-500",
};

// Coach hours & payment — the "easiest way" version: a coach's pay for a
// month is (classes they were marked attended for) x (their flat per-class
// rate). Substitutes are handled automatically for free, since attendance
// is recorded against whichever coach actually showed up that date, not the
// group's regular roster.
export default function AdminCoachesPage() {
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth()); // 0-11
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<{ id: string; name: string } | null>(null);
  const [dayDetails, setDayDetails] = useState<DayDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeDetails = useCallback(() => setSelectedCoach(null), []);
  useFocusTrap(modalRef, selectedCoach !== null, closeDetails);

  // Group the already date-then-time-sorted flat list into per-date sections
  // for display, so a date header shows once instead of repeating per class.
  const groupedDayDetails = useMemo(() => {
    const groups: { date: string; items: DayDetail[] }[] = [];
    for (const d of dayDetails) {
      const last = groups[groups.length - 1];
      if (last && last.date === d.lessonDate) last.items.push(d);
      else groups.push({ date: d.lessonDate, items: [d] });
    }
    return groups;
  }, [dayDetails]);

  const loadData = useCallback(async (year: number, month: number) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");
      setUserId(user.id);

      const { data: adminProfile, error: adminError } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();
      if (adminError) throw new Error("Failed to load admin profile.");

      const clubId = adminProfile?.club_id;
      const fallbackId = ["00000000-0000-0000-0000-000000000000"];

      const monthStart = toLocalISODate(new Date(year, month, 1));
      const monthEnd = toLocalISODate(new Date(year, month + 1, 0));

      const { data: coachRows, error: coachesError } = await supabase
        .from("coaches")
        .select("id, is_active, rate_per_class")
        .eq("club_id", clubId);
      if (coachesError) throw new Error("Failed to load coaches: " + coachesError.message);

      const coachIds = (coachRows ?? []).map((c) => c.id);

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", coachIds.length ? coachIds : fallbackId);
      const nameMap = new Map((profileRows ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));

      const { data: attendanceRows } = await supabase
        .from("class_coach_attendance")
        .select("coach_id")
        .in("coach_id", coachIds.length ? coachIds : fallbackId)
        .eq("attended", true)
        .gte("lesson_date", monthStart)
        .lte("lesson_date", monthEnd);

      const countMap = new Map<string, number>();
      for (const row of attendanceRows ?? []) {
        countMap.set(row.coach_id, (countMap.get(row.coach_id) ?? 0) + 1);
      }

      const rows: CoachRow[] = (coachRows ?? [])
        .map((c) => ({
          id: c.id,
          name: nameMap.get(c.id) ?? "Unknown",
          isActive: c.is_active,
          ratePerClass: c.rate_per_class,
          classesAttended: countMap.get(c.id) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setCoaches(rows);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(calendarYear, calendarMonth);
  }, [calendarYear, calendarMonth, loadData]);

  const loadDayDetails = useCallback(async (coachId: string, year: number, month: number) => {
    const supabase = createClient();
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const monthStart = toLocalISODate(new Date(year, month, 1));
      const monthEnd = toLocalISODate(new Date(year, month + 1, 0));

      // Everything this coach was actually scheduled to cover this month
      // (regular assignment + substitute dates in/out), so days with no
      // attendance record yet still show up as "Not marked yet" instead of
      // silently disappearing.
      const coverage = await fetchCoverageRange(supabase, coachId, monthStart, monthEnd);

      const { data: attendanceRows, error: attendanceError } = await supabase
        .from("class_coach_attendance")
        .select("class_group_id, lesson_date, attended, absence_reason, absence_note")
        .eq("coach_id", coachId)
        .gte("lesson_date", monthStart)
        .lte("lesson_date", monthEnd);
      if (attendanceError) throw new Error("Failed to load attendance: " + attendanceError.message);

      const attendanceMap = new Map(
        (attendanceRows ?? []).map((r) => [`${r.class_group_id}|${r.lesson_date}`, r])
      );

      const details: DayDetail[] = [];
      const sortedDates = Array.from(coverage.keys()).sort();
      for (const dateStr of sortedDates) {
        for (const info of coverage.get(dateStr) ?? []) {
          const record = attendanceMap.get(`${info.groupId}|${dateStr}`);
          let status: DayStatus;
          if (info.cancelled) status = "cancelled";
          else if (!record) status = "pending";
          else status = record.attended ? "attended" : "not_attended";

          details.push({
            groupId: info.groupId,
            lessonDate: dateStr,
            className: info.name,
            groupName: info.groupName,
            startTime: info.start_time,
            durationMinutes: info.duration_minutes,
            status,
            absenceReason: record?.absence_reason ?? null,
            absenceNote: record?.absence_note ?? null,
          });
        }
      }

      setDayDetails(details);
    } catch (err: any) {
      setDetailsError(err.message);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const openDetails = (coach: CoachRow) => {
    setSelectedCoach({ id: coach.id, name: coach.name });
    loadDayDetails(coach.id, calendarYear, calendarMonth);
  };

  // After any quick-action attendance edit, refresh both the open modal
  // (so the corrected status shows immediately) and the coach table behind
  // it (its classes-attended / pay totals depend on the same rows).
  const refreshAfterAttendanceChange = async (coachId: string) => {
    await Promise.all([
      loadDayDetails(coachId, calendarYear, calendarMonth),
      loadData(calendarYear, calendarMonth),
    ]);
  };

  const handleMarkAttendance = async (groupId: string, lessonDate: string, attended: boolean) => {
    if (!selectedCoach || !userId) return;
    const key = `${groupId}-${lessonDate}`;
    setBusyKey(key);
    const supabase = createClient();
    const { data: updated, error: upsertError } = await supabase
      .from("class_coach_attendance")
      .upsert(
        {
          class_group_id: groupId,
          lesson_date: lessonDate,
          coach_id: selectedCoach.id,
          attended,
          absence_reason: attended ? null : "other",
          marked_by: userId,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "class_group_id,lesson_date,coach_id" }
      )
      .select("coach_id");
    if (upsertError) {
      window.alert("Couldn't update attendance: " + upsertError.message);
      setBusyKey(null);
      return;
    }
    if (!updated || updated.length === 0) {
      window.alert(
        "The update ran but changed nothing — you likely don't have permission to edit this (a database permissions rule is silently blocking it)."
      );
      setBusyKey(null);
      return;
    }
    await refreshAfterAttendanceChange(selectedCoach.id);
    setBusyKey(null);
  };

  const handleSetAbsenceReason = async (
    groupId: string,
    lessonDate: string,
    reason: "cat1" | "mc" | "other"
  ) => {
    if (!selectedCoach || !userId) return;
    const key = `${groupId}-${lessonDate}`;
    setBusyKey(key);
    const supabase = createClient();
    const { data: updated, error: upsertError } = await supabase
      .from("class_coach_attendance")
      .upsert(
        {
          class_group_id: groupId,
          lesson_date: lessonDate,
          coach_id: selectedCoach.id,
          attended: false,
          absence_reason: reason,
          marked_by: userId,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "class_group_id,lesson_date,coach_id" }
      )
      .select("coach_id");
    if (upsertError) {
      window.alert("Couldn't update reason: " + upsertError.message);
      setBusyKey(null);
      return;
    }
    if (!updated || updated.length === 0) {
      window.alert(
        "The update ran but changed nothing — you likely don't have permission to edit this (a database permissions rule is silently blocking it)."
      );
      setBusyKey(null);
      return;
    }
    await refreshAfterAttendanceChange(selectedCoach.id);
    setBusyKey(null);
  };

  const handleClearAttendance = async (groupId: string, lessonDate: string) => {
    if (!selectedCoach) return;
    const key = `${groupId}-${lessonDate}`;
    setBusyKey(key);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("class_coach_attendance")
      .delete()
      .eq("class_group_id", groupId)
      .eq("lesson_date", lessonDate)
      .eq("coach_id", selectedCoach.id);
    if (deleteError) {
      window.alert("Couldn't reset attendance: " + deleteError.message);
      setBusyKey(null);
      return;
    }
    await refreshAfterAttendanceChange(selectedCoach.id);
    setBusyKey(null);
  };

  const handleSetRate = async (coachId: string, rateStr: string) => {
    const rate = rateStr.trim() === "" ? null : parseFloat(rateStr);
    if (rate !== null && (isNaN(rate) || rate < 0)) {
      window.alert("Enter a valid, non-negative rate.");
      return;
    }
    const supabase = createClient();
    const { data: updated, error: updateError } = await supabase
      .from("coaches")
      .update({ rate_per_class: rate })
      .eq("id", coachId)
      .select("id");
    if (updateError) {
      window.alert("Couldn't update rate: " + updateError.message);
      return;
    }
    if (!updated || updated.length === 0) {
      window.alert(
        "The update ran but changed nothing — you likely don't have permission to edit this (a database permissions rule is silently blocking it)."
      );
      return;
    }
    await loadData(calendarYear, calendarMonth);
  };

  const goToMonth = (delta: number) => {
    const d = new Date(calendarYear, calendarMonth + delta, 1);
    setCalendarYear(d.getFullYear());
    setCalendarMonth(d.getMonth());
  };

  const totalPay = coaches.reduce(
    (sum, c) => sum + c.classesAttended * (c.ratePerClass ?? 0),
    0
  );

  return (
    <div className="min-h-screen page-shell bg-gray-50">
      <AdminHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
        <ClassesStudentsTabs />

        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800">Coaches</h1>
          <p className="text-sm text-gray-500">
            Set each coach&apos;s rate, and see classes attended + total pay for a month.
          </p>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => goToMonth(-1)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            &larr;
          </button>
          <span className="text-sm font-medium text-gray-800">
            {MONTH_NAMES[calendarMonth]} {calendarYear}
          </span>
          <button
            onClick={() => goToMonth(1)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            &rarr;
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading coaches...</p>
        ) : coaches.length === 0 ? (
          <p className="text-sm text-gray-400">No coaches in your club yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-2.5">Coach</th>
                  <th className="px-4 py-2.5">Rate / class</th>
                  <th className="px-4 py-2.5">Classes attended</th>
                  <th className="px-4 py-2.5">Total pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coaches.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      <button
                        type="button"
                        onClick={() => openDetails(c)}
                        className="text-teal-600 hover:underline"
                      >
                        {c.name}
                      </button>
                      {!c.isActive && (
                        <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="mr-1 text-gray-400">$</span>
                      <input
                        key={c.ratePerClass ?? "empty"}
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={c.ratePerClass ?? ""}
                        placeholder="Not set"
                        onBlur={(e) => {
                          if (e.target.value === String(c.ratePerClass ?? "")) return;
                          handleSetRate(c.id, e.target.value);
                        }}
                        className="w-24 rounded border border-gray-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{c.classesAttended}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      {c.ratePerClass == null ? (
                        <span className="text-gray-400">Set a rate</span>
                      ) : (
                        `$${(c.classesAttended * c.ratePerClass).toFixed(2)}`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td className="px-4 py-2.5 font-semibold text-gray-800" colSpan={3}>
                    Total for {MONTH_NAMES[calendarMonth]}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">
                    ${totalPay.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400">
          Counts classes where the coach was marked attended (including substitute dates) for the selected month.
        </p>
      </div>

      {selectedCoach && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeDetails(); }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-details-title"
            tabIndex={-1}
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl focus:outline-none"
          >
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 id="coach-details-title" className="font-semibold text-gray-800">
                {selectedCoach.name} — {MONTH_NAMES[calendarMonth]} {calendarYear}
              </h2>
              <button
                type="button"
                onClick={closeDetails}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              {detailsError && (
                <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{detailsError}</div>
              )}
              {detailsLoading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : dayDetails.length === 0 ? (
                <p className="text-sm text-gray-400">Nothing scheduled for this coach this month.</p>
              ) : (
                <div className="space-y-4">
                  {groupedDayDetails.map((group) => (
                    <div key={group.date}>
                      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {formatDateLong(group.date)}
                      </div>
                      <ul className="space-y-2">
                        {group.items.map((d, i) => {
                          const key = `${d.groupId}-${d.lessonDate}`;
                          const isBusy = busyKey === key;
                          return (
                            <li
                              key={`${d.groupId}-${d.lessonDate}-${i}`}
                              className={`rounded-lg border px-3 py-2 text-sm ${DAY_STATUS_STYLES[d.status]}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-gray-800">
                                  {formatTimeRange(d.startTime, d.durationMinutes)}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DAY_STATUS_BADGE_STYLES[d.status]}`}>
                                  {DAY_STATUS_LABELS[d.status]}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {d.className}{d.groupName ? ` (${d.groupName})` : ""}
                              </div>
                              {d.status === "not_attended" && (
                                <div className="mt-1 text-xs text-gray-600">
                                  Reason: {d.absenceReason ? (ABSENCE_REASON_LABELS[d.absenceReason] ?? d.absenceReason) : "Not given"}
                                  {d.absenceNote ? ` — ${d.absenceNote}` : ""}
                                </div>
                              )}
                              {d.status === "cancelled" ? (
                                <div className="mt-1 text-xs text-gray-400">Class was cancelled — no attendance to mark.</div>
                              ) : (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleMarkAttendance(d.groupId, d.lessonDate, true)}
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                                      d.status === "attended"
                                        ? "bg-green-600 text-white"
                                        : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                    }`}
                                  >
                                    Mark attended
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleMarkAttendance(d.groupId, d.lessonDate, false)}
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                                      d.status === "not_attended"
                                        ? "bg-red-600 text-white"
                                        : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                    }`}
                                  >
                                    Mark not attended
                                  </button>
                                  {d.status === "not_attended" && (
                                    <select
                                      disabled={isBusy}
                                      value={d.absenceReason ?? "other"}
                                      onChange={(e) =>
                                        handleSetAbsenceReason(d.groupId, d.lessonDate, e.target.value as "cat1" | "mc" | "other")
                                      }
                                      className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-600 disabled:opacity-50"
                                    >
                                      {COACH_ABSENCE_REASONS.map((r) => (
                                        <option key={r.value} value={r.value}>
                                          {r.label}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  {d.status !== "pending" && (
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => handleClearAttendance(d.groupId, d.lessonDate)}
                                      className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
