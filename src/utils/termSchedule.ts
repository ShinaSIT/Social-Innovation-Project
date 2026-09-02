// Shared types + helpers for the Term Schedule feature, used by both the
// standalone Term Schedules admin page and any class page that displays them.

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface LessonDate {
  id?: string;
  lesson_date: string; // YYYY-MM-DD
  has_lesson: boolean;
  remarks: string;
}

export interface MonthNote {
  year: number;
  month: number; // 1-12
  note: string;
}

export interface TermSchedule {
  id: string;
  term_name: string;
  term_number: number | null;
  start_date: string;
  end_date: string;
  dates: LessonDate[];
  monthNotes: MonthNote[];
  classIds: string[]; // classes this term schedule is linked to
}

export function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatDateShort(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ymKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Format a Date as YYYY-MM-DD using its LOCAL date fields — toISOString()
// converts to UTC first, which silently shifts the date back a day for any
// timezone ahead of UTC. Always use this instead for date-only values.
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// All dates matching `dayOfWeek` (0=Sun..6=Sat) between start and end, inclusive.
export function generateMatchingDates(start: string, end: string, dayOfWeek: number): string[] {
  if (!start || !end) return [];
  const result: string[] = [];
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  if (startDate > endDate) return [];

  const d = new Date(startDate);
  const diff = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);

  while (d <= endDate) {
    result.push(toLocalISODate(d));
    d.setDate(d.getDate() + 7);
  }
  return result;
}

export function joinDaysWithAmpersand(days: number[]): string {
  if (days.length === 0) return "";
  if (days.length === 1) return `${days[0]}`;
  return `${days.slice(0, -1).join(", ")} & ${days[days.length - 1]}`;
}

// Group lesson dates by year-month, sorted chronologically.
export function groupByMonth(dates: LessonDate[]) {
  const groups: Record<string, LessonDate[]> = {};
  for (const d of dates) {
    const [y, m] = d.lesson_date.split("-");
    const key = `${y}-${m}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}
