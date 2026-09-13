"use client";

import { TermSchedule, MONTH_NAMES, groupByMonth, joinDaysWithAmpersand } from "@/utils/termSchedule";

// Read-only display of a term schedule: one row per month, matching the
// "Month | Dates | Remarks" format from the original paper term schedule.
// Reused on both the Term Schedules admin page and individual class pages.
export default function TermScheduleTable({
  term,
  linkedClassNames,
  onEdit,
}: {
  term: TermSchedule;
  linkedClassNames?: string[];
  onEdit?: () => void;
}) {
  const grouped = groupByMonth(term.dates);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">{term.term_name}</h3>
        {onEdit && (
          <button
            onClick={onEdit}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Edit
          </button>
        )}
      </div>

      {linkedClassNames && linkedClassNames.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400">Applies to:</span>
          {linkedClassNames.map((name, i) => (
            <span
              key={i}
              className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] table-fixed text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
            <th className="w-[15%] py-2 pl-2 pr-4">Month</th>
            <th className="w-[40%] py-2 pr-4">Class Dates</th>
            <th className="w-[45%] py-2 pr-2">Cancelled Dates</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([key, monthDates]) => {
            const [year, month] = key.split("-").map(Number);
            const activeDays = monthDates
              .filter((d) => d.has_lesson)
              .map((d) => parseInt(d.lesson_date.split("-")[2], 10));
            const noLessonEntries = monthDates
              .filter((d) => !d.has_lesson)
              .map((d) => ({
                day: parseInt(d.lesson_date.split("-")[2], 10),
                reason: d.remarks || "No lesson",
              }));
            return (
              <tr key={key} className="border-b border-gray-50 align-top last:border-0">
                <td className="py-2 pl-2 pr-4 font-medium text-gray-700">
                  {MONTH_NAMES[month - 1].slice(0, 3)} {String(year).slice(-2)}
                </td>
                <td className="py-2 pr-4 text-gray-700">
                  {activeDays.length > 0 ? joinDaysWithAmpersand(activeDays) : "—"}
                </td>
                <td className="py-2 pr-2 text-gray-500">
                  {noLessonEntries.length > 0 ? (
                    <div>
                      {noLessonEntries.map((e, i) => (
                        <p key={i}>{e.day} - {e.reason}</p>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {term.monthNotes.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
          {term.monthNotes.map((n, i) => (
            <p key={i} className="text-xs font-medium text-amber-600">
              * {n.note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
