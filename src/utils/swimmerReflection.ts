import type { SupabaseClient } from "@supabase/supabase-js";

// Swimmer's own post-class reflection: three emoji scales, no typing.
// Answers are stored as 1-5 in swimmer_session_reflections.

export interface ReflectionAnswers {
  feeling: number;
  difficulty: number;
  self_rating: number;
}

export type ReflectionKey = keyof ReflectionAnswers;

export interface ReflectionQuestion {
  key: ReflectionKey;
  question: string;
  // Short heading for places that list answers (e.g. the coach's student page).
  shortLabel: string;
  options: { value: number; emoji: string; label: string }[];
}

export const REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  {
    key: "feeling",
    question: "How did you feel during the session?",
    shortLabel: "Feeling",
    options: [
      { value: 1, emoji: "😢", label: "Very sad" },
      { value: 2, emoji: "🙁", label: "Sad" },
      { value: 3, emoji: "😐", label: "Okay" },
      { value: 4, emoji: "🙂", label: "Happy" },
      { value: 5, emoji: "😄", label: "Very happy" },
    ],
  },
  {
    key: "difficulty",
    question: "Was today's session easy or hard?",
    shortLabel: "Difficulty",
    options: [
      { value: 1, emoji: "😌", label: "Very easy" },
      { value: 2, emoji: "🙂", label: "Easy" },
      { value: 3, emoji: "😐", label: "Just right" },
      { value: 4, emoji: "😣", label: "Hard" },
      { value: 5, emoji: "😫", label: "Very hard" },
    ],
  },
  {
    key: "self_rating",
    question: "How well do you think you did?",
    shortLabel: "Self-rating",
    options: [
      { value: 1, emoji: "😞", label: "Not great" },
      { value: 2, emoji: "😕", label: "Could be better" },
      { value: 3, emoji: "😐", label: "Okay" },
      { value: 4, emoji: "😊", label: "Good" },
      { value: 5, emoji: "🤩", label: "Amazing" },
    ],
  },
];

export function reflectionOption(key: ReflectionKey, value: number) {
  return REFLECTION_QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === value) ?? null;
}

export interface PendingReflection {
  groupId: string;
  className: string;
  groupName: string;
  startTime: string;
  lessonDate: string;
}

// How far back the dashboard reminder looks for classes without a reflection.
export const PENDING_REFLECTION_DAYS = 14;

function localISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Classes the swimmer had in the last PENDING_REFLECTION_DAYS days (today's
// only once they've started) that they haven't reflected on -- skipping
// cancelled lessons and ones they were marked absent for. Newest first.
// Does the whole date range in a fixed handful of queries rather than
// per-date, since the calendar's per-day loader would be ~8 queries a day.
export async function fetchPendingReflections(
  supabase: SupabaseClient,
  swimmerId: string
): Promise<PendingReflection[]> {
  const fallbackId = ["00000000-0000-0000-0000-000000000000"];
  const now = new Date();
  const today = localISODate(now);
  const from = new Date(now);
  from.setDate(from.getDate() - PENDING_REFLECTION_DAYS);
  const fromDate = localISODate(from);
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const { data: myGroupRows } = await supabase
    .from("class_group_swimmers")
    .select("group_id, enrolled_at")
    .eq("swimmer_id", swimmerId);
  const groupIds = Array.from(new Set((myGroupRows ?? []).map((r) => r.group_id as string)));
  if (groupIds.length === 0) return [];
  const enrolledAtMap = new Map(
    (myGroupRows ?? []).map((r) => [r.group_id as string, r.enrolled_at ? (r.enrolled_at as string).slice(0, 10) : null])
  );

  const { data: groupRows } = await supabase
    .from("class_groups")
    .select("id, class_id, group_name")
    .in("id", groupIds);
  const classIds = Array.from(new Set((groupRows ?? []).map((g) => g.class_id as string)));

  const [{ data: classRows }, { data: linkRows }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, start_time")
      .in("id", classIds.length ? classIds : fallbackId)
      .eq("archived", false),
    supabase
      .from("term_schedule_classes")
      .select("term_schedule_id, class_id")
      .in("class_id", classIds.length ? classIds : fallbackId),
  ]);
  const termIds = Array.from(new Set((linkRows ?? []).map((l) => l.term_schedule_id as string)));

  const [{ data: dateRows }, { data: logRows }, { data: attendanceRows }, { data: reflectionRows }] = await Promise.all([
    supabase
      .from("term_schedule_dates")
      .select("term_schedule_id, lesson_date")
      .in("term_schedule_id", termIds.length ? termIds : fallbackId)
      .eq("has_lesson", true)
      .gte("lesson_date", fromDate)
      .lte("lesson_date", today),
    supabase
      .from("class_session_logs")
      .select("class_group_id, lesson_date, status")
      .in("class_group_id", groupIds)
      .gte("lesson_date", fromDate)
      .lte("lesson_date", today),
    supabase
      .from("class_session_swimmers")
      .select("class_group_id, lesson_date, present")
      .eq("swimmer_id", swimmerId)
      .gte("lesson_date", fromDate)
      .lte("lesson_date", today),
    supabase
      .from("swimmer_session_reflections")
      .select("class_group_id, lesson_date")
      .eq("swimmer_id", swimmerId)
      .gte("lesson_date", fromDate)
      .lte("lesson_date", today),
  ]);

  const key = (groupId: string, date: string) => `${groupId}|${date}`;
  const cancelled = new Set(
    (logRows ?? []).filter((l) => l.status === "cancelled").map((l) => key(l.class_group_id, l.lesson_date))
  );
  const absent = new Set(
    (attendanceRows ?? []).filter((a) => a.present === false).map((a) => key(a.class_group_id, a.lesson_date))
  );
  const reflected = new Set((reflectionRows ?? []).map((r) => key(r.class_group_id, r.lesson_date)));

  const classMap = new Map((classRows ?? []).map((c) => [c.id as string, c]));
  const datesByClass = new Map<string, Set<string>>();
  for (const link of linkRows ?? []) {
    for (const d of dateRows ?? []) {
      if (d.term_schedule_id !== link.term_schedule_id) continue;
      const set = datesByClass.get(link.class_id) ?? new Set<string>();
      set.add(d.lesson_date);
      datesByClass.set(link.class_id, set);
    }
  }

  const pending: PendingReflection[] = [];
  for (const g of groupRows ?? []) {
    const cls = classMap.get(g.class_id);
    if (!cls) continue;
    const enrolledAt = enrolledAtMap.get(g.id);
    for (const date of datesByClass.get(g.class_id) ?? []) {
      if (enrolledAt && enrolledAt > date) continue;
      if (date === today && (cls.start_time as string).slice(0, 5) > nowTime) continue;
      const k = key(g.id, date);
      if (cancelled.has(k) || absent.has(k) || reflected.has(k)) continue;
      pending.push({
        groupId: g.id,
        className: cls.name,
        groupName: g.group_name,
        startTime: cls.start_time,
        lessonDate: date,
      });
    }
  }

  return pending.sort(
    (a, b) => b.lessonDate.localeCompare(a.lessonDate) || b.startTime.localeCompare(a.startTime)
  );
}
