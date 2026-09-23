"use client";

import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { formatDateLong } from "@/utils/attendance";
import { REFLECTION_QUESTIONS, type ReflectionAnswers, type ReflectionKey } from "@/utils/swimmerReflection";

interface Props {
  swimmerId: string;
  groupId: string;
  lessonDate: string;
  className: string;
  initial: ReflectionAnswers | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function SessionReflectionModal({
  swimmerId,
  groupId,
  lessonDate,
  className,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [answers, setAnswers] = useState<Partial<ReflectionAnswers>>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true, onClose);

  const complete = REFLECTION_QUESTIONS.every((q) => answers[q.key] !== undefined);

  const choose = (key: ReflectionKey, value: number) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSave = async () => {
    if (!complete) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("swimmer_session_reflections")
      .upsert(
        {
          swimmer_id: swimmerId,
          class_group_id: groupId,
          lesson_date: lessonDate,
          feeling: answers.feeling,
          difficulty: answers.difficulty,
          self_rating: answers.self_rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "swimmer_id,class_group_id,lesson_date" }
      );

    if (saveError) {
      setError("Couldn't save your reflection: " + saveError.message);
      setSaving(false);
      return;
    }
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reflection-title"
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl focus:outline-none"
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div>
            <h2 id="reflection-title" className="font-semibold text-gray-800">How did it go?</h2>
            <p className="text-xs text-gray-500">{className} · {formatDateLong(lessonDate)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-xl text-gray-400 hover:text-gray-600" aria-label="Close">
            &times;
          </button>
        </div>

        <div className="space-y-6 p-4">
          {REFLECTION_QUESTIONS.map((q) => (
            <div key={q.key}>
              <p id={`q-${q.key}`} className="mb-2 text-sm font-medium text-gray-700">{q.question}</p>
              <div role="radiogroup" aria-labelledby={`q-${q.key}`} className="grid grid-cols-5 gap-1.5">
                {q.options.map((o) => {
                  const selected = answers[q.key] === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={o.label}
                      onClick={() => choose(q.key, o.value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 transition ${
                        selected
                          ? "border-teal-400 bg-teal-50"
                          : "border-transparent bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-3xl leading-none" aria-hidden="true">{o.emoji}</span>
                      <span className={`text-center text-[11px] leading-tight ${selected ? "font-medium text-teal-700" : "text-gray-500"}`}>
                        {o.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={!complete || saving}
            className="w-full rounded-full bg-teal-500 py-3 text-sm font-medium text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : complete ? "Save" : "Pick one for each question"}
          </button>
        </div>
      </div>
    </div>
  );
}
