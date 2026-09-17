"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import AdminHeader from "@/app/admin/components/AdminHeader";
import ClassesStudentsTabs from "@/app/admin/components/ClassesStudentsTabs";
import TermScheduleForm from "@/app/admin/components/TermScheduleForm";
import TermScheduleTable from "@/app/admin/components/TermScheduleTable";
import { TermSchedule, DAYS } from "@/utils/termSchedule";

interface ClassOption {
  id: string;
  name: string;
  day_of_week: number;
}

export default function TermSchedulesPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [termSchedules, setTermSchedules] = useState<TermSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TermSchedule | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [hasSetInitialExpanded, setHasSetInitialExpanded] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

      const { data: classRows, error: classError } = await supabase
        .from("classes")
        .select("id, name, day_of_week")
        .eq("club_id", adminProfile?.club_id ?? null)
        .order("day_of_week", { ascending: true });

      if (classError) throw new Error("Failed to load classes.");
      setClasses(classRows ?? []);

      const { data: terms, error: termsError } = await supabase
        .from("term_schedules")
        .select("id, term_name, term_number, start_date, end_date")
        .order("start_date", { ascending: true });

      if (termsError) throw new Error("Failed to load term schedules.");

      const termIds = (terms ?? []).map((t) => t.id);
      const fallbackId = ["00000000-0000-0000-0000-000000000000"];

      const [{ data: dates }, { data: notes }, { data: links }] = await Promise.all([
        supabase
          .from("term_schedule_dates")
          .select("id, term_schedule_id, lesson_date, has_lesson, remarks")
          .in("term_schedule_id", termIds.length ? termIds : fallbackId)
          .order("lesson_date", { ascending: true }),
        supabase
          .from("term_schedule_month_notes")
          .select("id, term_schedule_id, year, month, note")
          .in("term_schedule_id", termIds.length ? termIds : fallbackId),
        supabase
          .from("term_schedule_classes")
          .select("term_schedule_id, class_id")
          .in("term_schedule_id", termIds.length ? termIds : fallbackId),
      ]);

      const merged: TermSchedule[] = (terms ?? []).map((t) => ({
        id: t.id,
        term_name: t.term_name,
        term_number: t.term_number,
        start_date: t.start_date,
        end_date: t.end_date,
        dates: (dates ?? [])
          .filter((d) => d.term_schedule_id === t.id)
          .map((d) => ({ id: d.id, lesson_date: d.lesson_date, has_lesson: d.has_lesson, remarks: d.remarks ?? "" })),
        monthNotes: (notes ?? [])
          .filter((n) => n.term_schedule_id === t.id)
          .map((n) => ({ year: n.year, month: n.month, note: n.note })),
        classIds: (links ?? []).filter((l) => l.term_schedule_id === t.id).map((l) => l.class_id),
      }));

      setTermSchedules(merged);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const classNameMap = new Map(classes.map((c) => [c.id, c.name]));

  const handleSaved = () => {
    setShowForm(false);
    setEditingTerm(null);
    loadData();
  };

  // Days of week actually in use, based on the linked classes (for the filter pills).
  const daysInUse = Array.from(new Set(classes.map((c) => c.day_of_week))).sort((a, b) => a - b);

  const getTermDays = (term: TermSchedule) =>
    Array.from(new Set(classes.filter((c) => term.classIds.includes(c.id)).map((c) => c.day_of_week)));

  const filteredTermSchedules =
    dayFilter === null ? termSchedules : termSchedules.filter((t) => getTermDays(t).includes(dayFilter));

  // Group term schedules by the year of their start date, oldest year first.
  const groupedByYear: [number, TermSchedule[]][] = (() => {
    const map = new Map<number, TermSchedule[]>();
    for (const term of filteredTermSchedules) {
      const year = new Date(term.start_date).getFullYear();
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(term);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  })();

  // Default: expand the year containing today, else the nearest upcoming year, else the latest year.
  useEffect(() => {
    if (hasSetInitialExpanded || groupedByYear.length === 0) return;
    const currentYear = new Date().getFullYear();
    const years = groupedByYear.map(([y]) => y);
    const defaultYear =
      years.find((y) => y === currentYear) ??
      years.find((y) => y > currentYear) ??
      years[years.length - 1];
    setExpandedYears(new Set([defaultYear]));
    setHasSetInitialExpanded(true);
  }, [groupedByYear, hasSetInitialExpanded]);

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen page-shell bg-gray-50">
        <AdminHeader />
        <div className="p-6 text-sm text-gray-500">Loading term schedules...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell bg-gray-50">
      <AdminHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
        <ClassesStudentsTabs />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Term Schedules</h1>
            <p className="text-sm text-gray-500">
              Define a term once (dates, holidays, fee notes) and apply it to every class that shares it.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => { setEditingTerm(null); setShowForm(true); }}
              className="rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition whitespace-nowrap"
            >
              + Add Term Schedule
            </button>
          )}
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        {showForm && (
          <TermScheduleForm
            classes={classes}
            initialTerm={editingTerm ?? undefined}
            onSaved={handleSaved}
            onCancel={() => { setShowForm(false); setEditingTerm(null); }}
          />
        )}

        {termSchedules.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">No term schedules yet.</p>
        ) : (
          <>
            {daysInUse.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-400">Filter by day:</span>
                <button
                  onClick={() => setDayFilter(null)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    dayFilter === null ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All
                </button>
                {daysInUse.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDayFilter(d)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      dayFilter === d ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {DAYS[d]}
                  </button>
                ))}
              </div>
            )}

            {groupedByYear.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">No term schedules for this day.</p>
            ) : (
              <div className="space-y-3">
                {groupedByYear.map(([year, terms]) => {
                  const isExpanded = expandedYears.has(year);
                  return (
                    <div key={year} className="rounded-xl bg-white shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleYear(year)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                        aria-expanded={isExpanded}
                      >
                        <span className="font-semibold text-gray-800">
                          {year} <span className="ml-1 text-xs font-normal text-gray-400">({terms.length})</span>
                        </span>
                        <span className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                          &#9660;
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="space-y-4 border-t border-gray-100 p-4">
                          {terms.map((term) => (
                            <TermScheduleTable
                              key={term.id}
                              term={term}
                              linkedClassNames={term.classIds.map((id) => classNameMap.get(id) ?? "Unknown class")}
                              onEdit={() => { setEditingTerm(term); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
