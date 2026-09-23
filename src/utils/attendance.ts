// Shared types/constants for the General Calendar's attendance feature —
// used by both the calendar page (List + Calendar views) and the
// ClassAttendanceCard component so the two stay in sync automatically.

import type { ReflectionAnswers } from "@/utils/swimmerReflection";

export interface CoachDay {
  id: string;
  name: string;
  isSubstitute: boolean;
  attended: boolean;
  hasRecord: boolean;
  absence_reason: "cat1" | "mc" | "other" | null;
  absence_note: string;
  attachment_path: string | null;
}

export interface SwimmerRow {
  id: string;
  name: string;
  level: number | null;
  present: boolean;
  hasRecord: boolean;
  absence_reason: "mc" | "other" | null;
  absence_note: string;
  attachment_path: string | null;
  // The swimmer's own emoji reflection on this lesson, if they've done one.
  reflection: ReflectionAnswers | null;
}

export interface GroupDay {
  id: string;
  group_name: string;
  coaches: CoachDay[];
  regularCoachNames: string[];
  status: string;
  statusReason: string;
  swimmers: SwimmerRow[];
}

export interface MonthClassInfo {
  id: string;
  name: string;
  start_time: string;
  coachNames: string[];
  cancelled: boolean;
}

export interface DayClass {
  id: string;
  name: string;
  start_time: string;
  duration_minutes: number;
  location: string | null;
  groups: GroupDay[];
}

export const SESSION_STATUS_OPTIONS = [
  { value: "ran", label: "Ran normally" },
  { value: "land_training", label: "Ran — land training" },
  { value: "ran_partial_cat1", label: "Ran partial - Cat 1 disruption" },
  { value: "cancelled", label: "Cancelled" },
];

export const COACH_ABSENCE_REASONS: { value: "cat1" | "mc" | "other"; label: string }[] = [
  { value: "cat1", label: "Cat 1" },
  { value: "mc", label: "MC" },
  { value: "other", label: "Other" },
];

export function formatDateLong(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
