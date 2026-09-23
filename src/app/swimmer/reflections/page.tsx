"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import SwimmerHeader from "@/app/swimmer/components/SwimmerHeader";
import SessionReflectionModal from "@/app/swimmer/components/SessionReflectionModal";
import { resolveSwimmerId } from "@/utils/currentSwimmer";
import { formatTime } from "@/utils/termSchedule";
import { formatDateLong } from "@/utils/attendance";
import {
  REFLECTION_QUESTIONS,
  reflectionOption,
  fetchPendingReflections,
  fetchSwimmerReflections,
  type PendingReflection,
  type SwimmerReflectionEntry,
  type ReflectionAnswers,
} from "@/utils/swimmerReflection";

type View = "todo" | "done";

// What the reflection popup is open for: a new reflection, or changing one.
interface Reflecting {
  groupId: string;
  lessonDate: string;
  className: string;
  initial: ReflectionAnswers | null;
}

function classLine(className: string, groupName: string, startTime: string | null) {
  return `${className}${groupName ? ` (${groupName})` : ""}${startTime ? ` · ${formatTime(startTime)}` : ""}`;
}

export default function SwimmerReflectionsPage() {
  const [view, setView] = useState<View>("todo");
  const [swimmerId, setSwimmerId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReflection[]>([]);
  const [done, setDone] = useState<SwimmerReflectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState<Reflecting | null>(null);

  const load = useCallback(async (id: string) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      // null = no cut-off: every past class since the swimmer enrolled.
      const [pendingRows, doneRows] = await Promise.all([
        fetchPendingReflections(supabase, id, null),
        fetchSwimmerReflections(supabase, id),
      ]);
      setPending(pendingRows);
      setDone(doneRows);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    resolveSwimmerId(supabase)
      .then((id) => {
        setSwimmerId(id);
        load(id);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [load]);

  const tabs: { key: View; label: string; count: number }[] = [
    { key: "todo", label: "To do", count: pending.length },
    { key: "done", label: "Done", count: done.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <SwimmerHeader />
      <div id="main-content" tabIndex={-1} className="mx-auto max-w-2xl p-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800">My Reflections</h1>
          <p className="text-sm text-gray-500">Tell your coach how your sessions went.</p>
        </div>

        <div role="tablist" aria-label="Reflections" className="mb-4 flex rounded-lg bg-gray-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={view === t.key}
              onClick={() => setView(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${
                view === t.key ? "bg-white text-teal-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {!loading && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                    view === t.key ? "bg-teal-100 text-teal-700" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : view === "todo" ? (
          pending.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center shadow-sm">
              <p className="text-3xl" aria-hidden="true">🎉</p>
              <p className="mt-2 text-sm font-medium text-gray-700">You&apos;re all caught up!</p>
              <p className="text-xs text-gray-500">New sessions will show up here after they happen.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map((p) => (
                <div
                  key={`${p.groupId}-${p.lessonDate}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{formatDateLong(p.lessonDate)}</p>
                    <p className="text-xs text-gray-500">{classLine(p.className, p.groupName, p.startTime)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setReflecting({ groupId: p.groupId, lessonDate: p.lessonDate, className: p.className, initial: null })
                    }
                    className="rounded-full bg-teal-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600"
                  >
                    Add my reflection
                  </button>
                </div>
              ))}
            </div>
          )
        ) : done.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">You haven&apos;t reflected on any sessions yet.</p>
        ) : (
          <div className="space-y-3">
            {done.map((r) => (
              <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{formatDateLong(r.lessonDate)}</p>
                    <p className="text-xs text-gray-500">{classLine(r.className, r.groupName, r.startTime)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setReflecting({
                        groupId: r.groupId,
                        lessonDate: r.lessonDate,
                        className: r.className,
                        initial: { feeling: r.feeling, difficulty: r.difficulty, self_rating: r.self_rating },
                      })
                    }
                    className="text-xs text-teal-600 underline hover:text-teal-700"
                  >
                    Change
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {REFLECTION_QUESTIONS.map((q) => {
                    const o = reflectionOption(q.key, r[q.key]);
                    return (
                      <div key={q.key} className="rounded-lg bg-gray-50 px-2 py-2 text-center" title={q.question}>
                        <p className="text-[11px] font-semibold uppercase text-gray-400">{q.shortLabel}</p>
                        <p className="text-2xl leading-tight" aria-hidden="true">{o?.emoji ?? "–"}</p>
                        <p className="text-xs text-gray-600">{o?.label ?? "—"}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reflecting && swimmerId && (
        <SessionReflectionModal
          swimmerId={swimmerId}
          groupId={reflecting.groupId}
          lessonDate={reflecting.lessonDate}
          className={reflecting.className}
          initial={reflecting.initial}
          onClose={() => setReflecting(null)}
          onSaved={() => {
            setReflecting(null);
            load(swimmerId);
          }}
        />
      )}
    </div>
  );
}
