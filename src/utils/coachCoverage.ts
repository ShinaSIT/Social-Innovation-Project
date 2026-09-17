import { createClient } from "@/utils/supabase/client";
import { toLocalISODate } from "@/utils/termSchedule";

export interface RangeClassInfo {
  classId: string;
  groupId: string;
  name: string;
  groupName: string;
  start_time: string;
  duration_minutes: number;
  cancelled: boolean;
}

export function dateRangeArray(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const d = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  while (d <= end) {
    dates.push(toLocalISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Which classes/groups a coach covers on each date in [startDate, endDate] —
// their regular assignment, minus any date they were substituted out, plus
// any date they were brought in as someone else's substitute. Shared by the
// coach's own calendar (Week/Month overviews) and the admin Coaches page
// (day-by-day pay detail), so both agree on what a coach was actually
// scheduled to cover.
export async function fetchCoverageRange(
  supabase: ReturnType<typeof createClient>,
  coachId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, RangeClassInfo[]>> {
  const fallbackId = ["00000000-0000-0000-0000-000000000000"];

  const { data: regRows } = await supabase.from("class_group_coaches").select("group_id").eq("coach_id", coachId);
  const regGroupIds = Array.from(new Set((regRows ?? []).map((r) => r.group_id)));

  const { data: subInRows } = await supabase
    .from("class_session_coaches")
    .select("class_group_id, lesson_date")
    .eq("coach_id", coachId)
    .gte("lesson_date", startDate)
    .lte("lesson_date", endDate);
  const subInGroupIds = Array.from(new Set((subInRows ?? []).map((r) => r.class_group_id)));

  const allGroupIds = Array.from(new Set([...regGroupIds, ...subInGroupIds]));
  if (allGroupIds.length === 0) return new Map();

  const { data: groupRows } = await supabase
    .from("class_groups")
    .select("id, class_id, group_name")
    .in("id", allGroupIds);

  const classIds = Array.from(new Set((groupRows ?? []).map((g) => g.class_id)));
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, start_time, duration_minutes")
    .in("id", classIds.length ? classIds : fallbackId)
    .eq("archived", false);
  const classInfoMap = new Map((classRows ?? []).map((c) => [c.id, c]));

  const { data: linkRows } = await supabase
    .from("term_schedule_classes")
    .select("term_schedule_id, class_id")
    .in("class_id", classIds.length ? classIds : fallbackId);
  const termIds = Array.from(new Set((linkRows ?? []).map((l) => l.term_schedule_id)));

  const { data: activeDates } = await supabase
    .from("term_schedule_dates")
    .select("term_schedule_id, lesson_date")
    .in("term_schedule_id", termIds.length ? termIds : fallbackId)
    .gte("lesson_date", startDate)
    .lte("lesson_date", endDate)
    .eq("has_lesson", true);

  // class_id -> set of dates it runs, via its term schedule(s).
  const classRunDates = new Map<string, Set<string>>();
  (activeDates ?? []).forEach((d) => {
    (linkRows ?? [])
      .filter((l) => l.term_schedule_id === d.term_schedule_id)
      .forEach((l) => {
        if (!classRunDates.has(l.class_id)) classRunDates.set(l.class_id, new Set());
        classRunDates.get(l.class_id)!.add(d.lesson_date);
      });
  });

  const { data: overrideRows } = await supabase
    .from("class_session_coaches")
    .select("class_group_id, lesson_date, coach_id")
    .in("class_group_id", allGroupIds)
    .gte("lesson_date", startDate)
    .lte("lesson_date", endDate);

  const { data: logRows } = await supabase
    .from("class_session_logs")
    .select("class_group_id, lesson_date, status")
    .in("class_group_id", allGroupIds)
    .gte("lesson_date", startDate)
    .lte("lesson_date", endDate);

  const result = new Map<string, RangeClassInfo[]>();
  for (const dateStr of dateRangeArray(startDate, endDate)) {
    for (const g of groupRows ?? []) {
      if (!classRunDates.get(g.class_id)?.has(dateStr)) continue;

      const overridesForDate = (overrideRows ?? []).filter((o) => o.class_group_id === g.id && o.lesson_date === dateStr);
      const isCovered = overridesForDate.length > 0
        ? overridesForDate.some((o) => o.coach_id === coachId)
        : regGroupIds.includes(g.id);
      if (!isCovered) continue;

      const classInfo = classInfoMap.get(g.class_id);
      if (!classInfo) continue;

      const log = (logRows ?? []).find((l) => l.class_group_id === g.id && l.lesson_date === dateStr);
      const list = result.get(dateStr) ?? [];
      list.push({
        classId: classInfo.id,
        groupId: g.id,
        name: classInfo.name,
        groupName: g.group_name,
        start_time: classInfo.start_time,
        duration_minutes: classInfo.duration_minutes,
        cancelled: log?.status === "cancelled",
      });
      result.set(dateStr, list);
    }
  }
  for (const list of result.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  return result;
}
