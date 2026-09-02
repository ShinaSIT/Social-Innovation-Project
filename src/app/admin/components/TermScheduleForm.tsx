"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  DAYS,
  MONTH_NAMES,
  LessonDate,
  TermSchedule,
  generateMatchingDates,
  groupByMonth,
  ymKey,
} from "@/utils/termSchedule";

interface ClassOption {
  id: string;
  name: string;
  day_of_week: number;
}

// Reusable create/edit form for a term schedule. A term schedule is
// independent of any single class — the admin picks which day pattern to
// generate dates from, then attaches the finished schedule to as many
// classes as share that schedule (e.g. every Saturday class).
export default function TermScheduleForm({
  classes,
  initialTerm,
  onSaved,
  onCancel,
}: {
  classes: ClassOption[];
  initialTerm?: TermSchedule;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEditing = !!initialTerm;

  const [termName, setTermName] = useState(initialTerm?.term_name ?? "");
  const [termNameCustomized, setTermNameCustomized] = useState(isEditing);
  const [termNumber, setTermNumber] = useState(initialTerm?.term_number != null ? String(initialTerm.term_number) : "");
  const [dayOfWeek, setDayOfWeek] = useState(() => {
    if (initialTerm && initialTerm.classIds.length > 0) {
      const first = classes.find((c) => c.id === initialTerm.classIds[0]);
      if (first) return first.day_of_week;
    }
    return 6; // default Saturday
  });
  const [startDate, setStartDate] = useState(initialTerm?.start_date ?? "");
  const [endDate, setEndDate] = useState(initialTerm?.end_date ?? "");
  const [lessonDates, setLessonDates] = useState<LessonDate[]>(initialTerm?.dates.map((d) => ({ ...d })) ?? []);
  const [monthNotes, setMonthNotes] = useState<Record<string, string>>(() => {
    const notes: Record<string, string> = {};
    for (const n of initialTerm?.monthNotes ?? []) notes[ymKey(n.year, n.month)] = n.note;
    return notes;
  });
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(initialTerm?.classIds ?? []);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const regenerateDates = () => {
    if (!startDate || !endDate) return;
    const dates = generateMatchingDates(startDate, endDate, dayOfWeek);
    setLessonDates(dates.map((d) => ({ lesson_date: d, has_lesson: true, remarks: "" })));
  };

  // Auto-generate once both dates are set, as long as nothing's been generated yet.
  useEffect(() => {
    if (!startDate || !endDate) return;
    if (lessonDates.length > 0) return;
    regenerateDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, dayOfWeek]);

  // Suggest "Term {number}: {StartMon}-{EndMon} {YY} ({N} sessions)".
  useEffect(() => {
    if (termNameCustomized) return;
    if (!startDate || !endDate) return;

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const startMon = MONTH_NAMES[start.getMonth()].slice(0, 3);
    const endMon = MONTH_NAMES[end.getMonth()].slice(0, 3);
    const startYY = String(start.getFullYear()).slice(-2);
    const endYY = String(end.getFullYear()).slice(-2);

    const monthRange =
      start.getFullYear() === end.getFullYear()
        ? startMon === endMon
          ? `${startMon} ${startYY}`
          : `${startMon}-${endMon} ${startYY}`
        : `${startMon} ${startYY}-${endMon} ${endYY}`;

    const sessionCount = lessonDates.filter((d) => d.has_lesson).length;
    const sessionSuffix = sessionCount > 0 ? ` (${sessionCount} session${sessionCount === 1 ? "" : "s"})` : "";
    const prefix = termNumber ? `Term ${termNumber}: ` : "";

    setTermName(`${prefix}${monthRange}${sessionSuffix}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termNumber, startDate, endDate, lessonDates, termNameCustomized]);

  const updateDate = (index: number, field: "has_lesson" | "remarks", value: boolean | string) =>
    setLessonDates((prev) =>
      prev.map((d, i) =>
        i === index
          ? {
              ...d,
              [field]: value,
              remarks: field === "has_lesson" && value === true ? "" : field === "remarks" ? (value as string) : d.remarks,
            }
          : d
      )
    );

  const removeDate = (index: number) => setLessonDates((prev) => prev.filter((_, i) => i !== index));

  const addExtraDate = () =>
    setLessonDates((prev) =>
      [...prev, { lesson_date: startDate || endDate || "", has_lesson: true, remarks: "" }].sort((a, b) =>
        a.lesson_date.localeCompare(b.lesson_date)
      )
    );

  const toggleClass = (id: string) =>
    setSelectedClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    if (!termName.trim() || !startDate || !endDate || lessonDates.length === 0) {
      setFormError("Please fill in the term name, start/end dates, and generate at least one lesson date.");
      return;
    }
    if (selectedClassIds.length === 0) {
      setFormError("Select at least one class this term schedule applies to.");
      return;
    }
    const missingReasons = lessonDates.some((d) => !d.has_lesson && !d.remarks.trim());
    if (missingReasons) {
      setFormError("Every date marked “No lesson” needs a reason in Remarks.");
      return;
    }

    setSaving(true);
    setFormError("");
    const supabase = createClient();

    try {
      let termId = initialTerm?.id ?? null;

      if (termId) {
        const { error: updateError } = await supabase
          .from("term_schedules")
          .update({
            term_name: termName.trim(),
            term_number: termNumber ? parseInt(termNumber) : null,
            start_date: startDate,
            end_date: endDate,
          })
          .eq("id", termId);
        if (updateError) throw new Error(updateError.message);

        await supabase.from("term_schedule_dates").delete().eq("term_schedule_id", termId);
        await supabase.from("term_schedule_month_notes").delete().eq("term_schedule_id", termId);
        await supabase.from("term_schedule_classes").delete().eq("term_schedule_id", termId);
      } else {
        const { data: newTerm, error: insertError } = await supabase
          .from("term_schedules")
          .insert({
            term_name: termName.trim(),
            term_number: termNumber ? parseInt(termNumber) : null,
            start_date: startDate,
            end_date: endDate,
          })
          .select("id")
          .single();

        if (insertError || !newTerm) throw new Error(insertError?.message ?? "Failed to create term schedule.");
        termId = newTerm.id;
      }

      await supabase.from("term_schedule_dates").insert(
        lessonDates.map((d) => ({
          term_schedule_id: termId,
          lesson_date: d.lesson_date,
          has_lesson: d.has_lesson,
          remarks: d.remarks.trim() || null,
        }))
      );

      await supabase.from("term_schedule_classes").insert(
        selectedClassIds.map((classId) => ({ term_schedule_id: termId, class_id: classId }))
      );

      const noteRows = Object.entries(monthNotes)
        .filter(([, note]) => note.trim())
        .map(([key, note]) => {
          const [year, month] = key.split("-").map(Number);
          return { term_schedule_id: termId, year, month, note: note.trim() };
        });
      if (noteRows.length > 0) {
        await supabase.from("term_schedule_month_notes").insert(noteRows);
      }

      onSaved();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const groupedFormDates = groupByMonth(lessonDates);

  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm space-y-4">
      {isEditing && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          Editing this term schedule — saving will replace its dates, notes, and class links.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-gray-600">
            Term Name * {!termNameCustomized && startDate && endDate && (
              <span className="font-normal text-gray-400">(auto-filled — edit to override)</span>
            )}
          </label>
          <input
            value={termName}
            onChange={(e) => {
              setTermName(e.target.value);
              setTermNameCustomized(e.target.value.trim().length > 0);
            }}
            placeholder="e.g. Term 1: Jan-Mar 26"
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Term Number</label>
          <input
            type="number"
            value={termNumber}
            onChange={(e) => setTermNumber(e.target.value)}
            placeholder="1"
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Day Pattern</label>
          <select
            value={dayOfWeek}
            onChange={(e) => { setDayOfWeek(parseInt(e.target.value)); setLessonDates([]); }}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
          >
            {DAYS.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Start Date *</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setLessonDates([]); }}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">End Date *</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setLessonDates([]); }}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
          />
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Every {DAYS[dayOfWeek]} between these two dates is added automatically below.
      </p>

      <div>
        <label className="mb-2 block text-sm text-gray-600">Applies to which classes? *</label>
        {classes.length === 0 ? (
          <p className="text-xs text-gray-400">No classes yet — create a class first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleClass(c.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  selectedClassIds.includes(c.id)
                    ? "bg-teal-500 text-white"
                    : c.day_of_week === dayOfWeek
                    ? "bg-teal-50 text-teal-700 hover:bg-teal-100"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
                title={c.day_of_week === dayOfWeek ? "Same day pattern" : "Different day pattern"}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {lessonDates.length > 0 && (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {lessonDates.length} date{lessonDates.length === 1 ? "" : "s"} generated
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={addExtraDate} className="text-xs text-teal-600 hover:text-teal-700">
                + Add extra date
              </button>
              <button type="button" onClick={regenerateDates} className="text-xs text-gray-400 hover:text-gray-600">
                &#8635; Regenerate (resets edits)
              </button>
            </div>
          </div>

          {groupedFormDates.map(([key, monthDates]) => {
            const [year, month] = key.split("-").map(Number);
            return (
              <div key={key} className="rounded-lg border border-gray-100 p-3">
                <p className="mb-2 text-sm font-semibold text-gray-700">
                  {MONTH_NAMES[month - 1]} {year}
                </p>

                <div className="space-y-2">
                  {monthDates.map((d) => {
                    const globalIndex = lessonDates.indexOf(d);
                    const day = parseInt(d.lesson_date.split("-")[2], 10);
                    return (
                      <div key={d.lesson_date + globalIndex} className="flex items-center gap-2">
                        <span className="w-8 shrink-0 text-sm text-gray-600">{day}</span>
                        <div className="flex shrink-0 overflow-hidden rounded-full border border-gray-200">
                          <button
                            type="button"
                            onClick={() => updateDate(globalIndex, "has_lesson", true)}
                            className={`px-2.5 py-1 text-xs font-medium transition ${
                              d.has_lesson ? "bg-teal-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            Lesson
                          </button>
                          <button
                            type="button"
                            onClick={() => updateDate(globalIndex, "has_lesson", false)}
                            className={`px-2.5 py-1 text-xs font-medium transition ${
                              !d.has_lesson ? "bg-red-400 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            No lesson
                          </button>
                        </div>
                        <input
                          value={d.remarks}
                          disabled={d.has_lesson}
                          onChange={(e) => updateDate(globalIndex, "remarks", e.target.value)}
                          placeholder={d.has_lesson ? "—" : "Reason (e.g. closed for CNY) *"}
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none ${
                            d.has_lesson
                              ? "border-gray-100 bg-gray-50 text-gray-300"
                              : "border-red-200 focus:border-red-400"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => removeDate(globalIndex)}
                          className="shrink-0 text-gray-300 hover:text-red-500"
                          title="Remove this date entirely"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs text-gray-500">
                    Fee note for {MONTH_NAMES[month - 1]} (optional)
                  </label>
                  <input
                    value={monthNotes[key] ?? ""}
                    onChange={(e) => setMonthNotes((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="e.g. Fee for Feb & Mar will be charged as 3 sessions (No prorate)"
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-teal-400 focus:outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formError && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{formError}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60 transition"
        >
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Save Term Schedule"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
