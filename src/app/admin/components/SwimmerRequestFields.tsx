"use client";

import { useState } from "react";
import { DAYS } from "@/utils/termSchedule";
import {
  Classification,
  ClassTypePreference,
  CLASSIFICATION_LABELS,
  CLASSIFICATION_STYLES,
  CLASS_TYPE_LABELS,
} from "@/utils/swimmerRequests";

export interface RequestPatch {
  requested_days: string[];
  requested_time_start: string | null;
  requested_time_end: string | null;
  class_type_preference: ClassTypePreference;
  class_type_notes: string | null;
  request_logged_at: string;
}

function formatTimeShort(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// Classification select (always editable, saves immediately) + the parent's
// requested days/time/class-type fields for one swimmer. The request portion
// opens in a view mode with an Edit button; edits are held in local draft
// state and only sent to the caller (one combined update) when Save is
// clicked, so a half-finished edit is never silently persisted field-by-field.
export default function SwimmerRequestFields({
  classification,
  onSetClassification,
  requestedDays,
  requestedTimeStart,
  requestedTimeEnd,
  classTypePreference,
  classTypeNotes,
  requestLoggedAt,
  onSaveRequest,
}: {
  classification: Classification;
  onSetClassification: (c: Classification) => void;
  requestedDays: string[];
  requestedTimeStart: string | null;
  requestedTimeEnd: string | null;
  classTypePreference: ClassTypePreference;
  classTypeNotes: string | null;
  requestLoggedAt: string | null;
  onSaveRequest: (patch: RequestPatch) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftDays, setDraftDays] = useState<string[]>(requestedDays);
  const [draftStart, setDraftStart] = useState(requestedTimeStart ? requestedTimeStart.slice(0, 5) : "");
  const [draftEnd, setDraftEnd] = useState(requestedTimeEnd ? requestedTimeEnd.slice(0, 5) : "");
  const [draftType, setDraftType] = useState<ClassTypePreference>(classTypePreference);
  const [draftNotes, setDraftNotes] = useState(classTypeNotes ?? "");

  const startEditing = () => {
    setDraftDays(requestedDays);
    setDraftStart(requestedTimeStart ? requestedTimeStart.slice(0, 5) : "");
    setDraftEnd(requestedTimeEnd ? requestedTimeEnd.slice(0, 5) : "");
    setDraftType(classTypePreference);
    setDraftNotes(classTypeNotes ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveRequest({
        requested_days: draftDays,
        requested_time_start: draftStart || null,
        requested_time_end: draftEnd || null,
        class_type_preference: draftType,
        class_type_notes: draftNotes.trim() || null,
        request_logged_at: new Date().toISOString(),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Distinguish "never asked yet" from "asked, and the answer was no
  // preference" — both would otherwise look identical (every field at its
  // default), so this is driven by whether Save has ever been clicked, not
  // by whether any field happens to be non-default.
  const hasRequest = !!requestLoggedAt;

  return (
    <>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-[11px] text-gray-400">Support needs:</span>
        <select
          value={classification}
          onChange={(e) => onSetClassification(e.target.value as Classification)}
          className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-400 ${CLASSIFICATION_STYLES[classification]}`}
        >
          {(Object.keys(CLASSIFICATION_LABELS) as Classification[]).map((k) => (
            <option key={k} value={k}>{CLASSIFICATION_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {!editing ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          {hasRequest ? (
            <span>
              {requestedDays.length > 0 ? requestedDays.map((d) => d.slice(0, 3)).join(", ") : "Any day"}
              {" · "}
              {requestedTimeStart && requestedTimeEnd
                ? `${formatTimeShort(requestedTimeStart)}–${formatTimeShort(requestedTimeEnd)}`
                : "No time set"}
              {" · "}
              {CLASS_TYPE_LABELS[classTypePreference]}
              {classTypeNotes ? ` · "${classTypeNotes}"` : ""}
            </span>
          ) : (
            <span className="text-gray-400">No timing request logged yet</span>
          )}
          <button
            type="button"
            onClick={startEditing}
            className="rounded-full border border-gray-200 px-2 py-0.5 font-medium text-gray-500 hover:bg-gray-50"
          >
            Edit
          </button>
        </div>
      ) : (
        <div className="mt-1.5 rounded-lg border border-teal-100 bg-teal-50/40 p-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-gray-400">Requested days:</span>
            {DAYS.map((day) => {
              const active = draftDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setDraftDays((prev) =>
                      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                    )
                  }
                  className={`rounded-full px-2 py-0.5 font-medium transition ${
                    active ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
            <span>Time:</span>
            <input
              type="time"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="rounded border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-600"
            />
            <span>to</span>
            <input
              type="time"
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="rounded border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-600"
            />
            <span className="ml-1">Class type:</span>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as ClassTypePreference)}
              className="rounded-full border-0 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 focus:outline-none focus:ring-1 focus:ring-teal-400"
            >
              {(Object.keys(CLASS_TYPE_LABELS) as ClassTypePreference[]).map((k) => (
                <option key={k} value={k}>{CLASS_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {draftType !== "no_preference" && (
            <input
              type="text"
              placeholder="Notes on this request (optional)"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              className="mt-1.5 w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-600"
            />
          )}

          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-teal-500 px-3 py-1 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
