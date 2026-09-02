"use client";

import Link from "next/link";
import { formatTime } from "@/utils/termSchedule";
import {
  DayClass,
  SESSION_STATUS_OPTIONS,
  COACH_ABSENCE_REASONS,
  formatDateLong,
} from "@/utils/attendance";

interface ClassAttendanceCardProps {
  c: DayClass;
  dateStr: string;
  allowSubstitution?: boolean;
  expandedGroups: Set<string>;
  toggleGroupExpanded: (groupId: string) => void;
  busyKey: string | null;
  allClubCoaches: { id: string; name: string }[];
  handleSetStatus: (groupId: string, status: string) => void;
  handleSetStatusReason: (groupId: string, status: string, reason: string) => void;
  handleSetCoachAttended: (groupId: string, coachId: string, attended: boolean) => void;
  handleClearCoachRecord: (groupId: string, coachId: string, attachmentPath: string | null) => void;
  handleSetCoachAbsenceReason: (groupId: string, coachId: string, reason: "cat1" | "mc" | "other") => void;
  handleSetCoachNote: (groupId: string, coachId: string, note: string) => void;
  handleAddOverrideCoach: (groupId: string, coachId: string) => void;
  handleRemoveOverrideCoach: (groupId: string, coachId: string) => void;
  handleUploadCoachMC: (groupId: string, coachId: string, file: File) => void;
  handleRemoveCoachMC: (groupId: string, coachId: string, path: string) => void;
  handleViewMC: (path: string) => void;
  handleMarkAllPresent: (groupId: string, swimmerIds: string[]) => void;
  handleSetSwimmerPresent: (groupId: string, swimmerId: string, present: boolean) => void;
  handleClearSwimmerRecord: (groupId: string, swimmerId: string, attachmentPath: string | null) => void;
  handleSetSwimmerAbsenceReason: (groupId: string, swimmerId: string, reason: "mc" | "other") => void;
  handleSetSwimmerNote: (groupId: string, swimmerId: string, note: string) => void;
  handleUploadSwimmerMC: (groupId: string, swimmerId: string, file: File) => void;
  handleRemoveSwimmerMC: (groupId: string, swimmerId: string, path: string) => void;
}

// The full attendance-marking card for one class on one date: session status,
// per-coach attendance/substitution, and per-swimmer present/absent + MC.
// Shared between the General Calendar's List view and the Calendar view's
// "expand a time slot" popup, so both stay in sync automatically.
export default function ClassAttendanceCard({
  c,
  dateStr,
  allowSubstitution = true,
  expandedGroups,
  toggleGroupExpanded,
  busyKey,
  allClubCoaches,
  handleSetStatus,
  handleSetStatusReason,
  handleSetCoachAttended,
  handleClearCoachRecord,
  handleSetCoachAbsenceReason,
  handleSetCoachNote,
  handleAddOverrideCoach,
  handleRemoveOverrideCoach,
  handleUploadCoachMC,
  handleRemoveCoachMC,
  handleViewMC,
  handleMarkAllPresent,
  handleSetSwimmerPresent,
  handleClearSwimmerRecord,
  handleSetSwimmerAbsenceReason,
  handleSetSwimmerNote,
  handleUploadSwimmerMC,
  handleRemoveSwimmerMC,
}: ClassAttendanceCardProps) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3">
        <Link href={`/admin/classes/${c.id}`} className="font-semibold text-gray-800 hover:underline">
          {c.name}
        </Link>
        <p className="text-xs text-gray-500">
          {formatTime(c.start_time)} &middot; {c.duration_minutes} min
          {c.location ? ` · ${c.location}` : ""}
        </p>
      </div>

      <div className="space-y-2">
        {c.groups.map((g) => {
          const isExpanded = expandedGroups.has(g.id);
          const hasSub = g.coaches.some((p) => p.isSubstitute);
          const anyCoachAbsent = g.coaches.some((p) => p.hasRecord && !p.attended);
          const markedCount = g.swimmers.filter((s) => s.hasRecord).length;
          const presentCount = g.swimmers.filter((s) => s.hasRecord && s.present).length;
          const availableSubs = allClubCoaches.filter((p) => !g.coaches.some((ec) => ec.id === p.id));
          const statusBadge =
            g.status === "cancelled"
              ? { label: "Cancelled", cls: "bg-red-50 text-red-600" }
              : g.status === "land_training"
              ? { label: "Land training", cls: "bg-amber-50 text-amber-700" }
              : g.status === "ran_partial_cat1"
              ? { label: "Partial - Cat 1", cls: "bg-amber-50 text-amber-700" }
              : null;

          return (
            <div key={g.id} className="rounded-lg border border-gray-100">
              <button
                onClick={() => toggleGroupExpanded(g.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-700">{g.group_name}</span>
                  {g.coaches.length > 0 ? (
                    g.coaches.map((p) => (
                      <span
                        key={p.id}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          !p.attended ? "bg-gray-100 text-gray-400 line-through" : "bg-teal-50 text-teal-700"
                        }`}
                      >
                        {p.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">No coach assigned</span>
                  )}
                  {hasSub && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Substitute</span>}
                  {anyCoachAbsent && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Coach absent</span>}
                  {statusBadge && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>}
                </div>
                <span className="flex items-center gap-2 text-xs text-gray-400">
                  {markedCount === 0
                    ? `${g.swimmers.length} not marked yet`
                    : markedCount < g.swimmers.length
                    ? `${presentCount} present · ${g.swimmers.length - markedCount} not marked`
                    : `${presentCount}/${g.swimmers.length} present`}
                  <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>&#9660;</span>
                </span>
              </button>

              {isExpanded && (
                <div className="space-y-4 border-t border-gray-100 p-3">
                  {/* Session status — did the class itself happen */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Session</label>
                    <div className="flex flex-wrap gap-1.5">
                      {SESSION_STATUS_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => handleSetStatus(g.id, o.value)}
                          disabled={busyKey === `status-${g.id}`}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-60 ${
                            g.status === o.value ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {(g.status === "cancelled" || g.status === "ran_partial_cat1") && (
                      <input
                        key={`${g.id}-${g.status}`}
                        defaultValue={g.statusReason}
                        placeholder={g.status === "cancelled" ? "Reason, e.g. Lightning alert Cat 1" : "Details (optional), e.g. cut short after 20 min"}
                        onBlur={(e) => handleSetStatusReason(g.id, g.status, e.target.value)}
                        className="mt-2 w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Coach attendance + substitution */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-500">Coaches</label>
                    {g.coaches.length === 0 ? (
                      <p className="text-xs text-gray-400">No coach assigned.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {g.coaches.map((p) => (
                          <div key={p.id} className="rounded-lg bg-gray-50 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="inline-flex overflow-hidden rounded-full border border-gray-200">
                                  <button
                                    onClick={() =>
                                      p.hasRecord && p.attended
                                        ? handleClearCoachRecord(g.id, p.id, p.attachment_path)
                                        : handleSetCoachAttended(g.id, p.id, true)
                                    }
                                    disabled={busyKey === `coach-${g.id}-${p.id}`}
                                    title={p.hasRecord && p.attended ? "Click again to un-mark" : undefined}
                                    className={`px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-60 ${
                                      p.hasRecord && p.attended ? "bg-green-100 text-green-700" : "bg-white text-gray-400 hover:bg-gray-50"
                                    }`}
                                  >
                                    Attended
                                  </button>
                                  <button
                                    onClick={() =>
                                      p.hasRecord && !p.attended
                                        ? handleClearCoachRecord(g.id, p.id, p.attachment_path)
                                        : handleSetCoachAttended(g.id, p.id, false)
                                    }
                                    disabled={busyKey === `coach-${g.id}-${p.id}`}
                                    title={p.hasRecord && !p.attended ? "Click again to un-mark" : undefined}
                                    className={`border-l border-gray-200 px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-60 ${
                                      p.hasRecord && !p.attended ? "bg-red-100 text-red-600" : "bg-white text-gray-400 hover:bg-gray-50"
                                    }`}
                                  >
                                    Not there
                                  </button>
                                </div>
                                {!p.hasRecord && <span className="text-[11px] text-gray-400">Not marked yet</span>}
                                <span className="text-sm font-medium text-gray-700">{p.name}</span>
                                {p.isSubstitute && <span className="text-xs text-amber-600">Substitute</span>}
                              </div>
                              {allowSubstitution && (
                                <button
                                  onClick={() => (p.isSubstitute ? handleRemoveOverrideCoach(g.id, p.id) : handleAddOverrideCoach(g.id, p.id))}
                                  disabled={busyKey === `addsub-${g.id}-${p.id}`}
                                  className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-60"
                                  title={p.isSubstitute ? "Remove this substitute" : "Remove from today's coverage (arrange a sub below)"}
                                >
                                  &times; Remove from today
                                </button>
                              )}
                            </div>
                            {!p.attended && (
                              <div className="mt-2 flex flex-wrap items-center gap-2 pl-1">
                                <div className="flex gap-1.5">
                                  {COACH_ABSENCE_REASONS.map((r) => (
                                    <button
                                      key={r.value}
                                      onClick={() => handleSetCoachAbsenceReason(g.id, p.id, r.value)}
                                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                                        p.absence_reason === r.value ? "bg-teal-500 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
                                      }`}
                                    >
                                      {r.label}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  key={`${p.id}-${p.absence_reason}`}
                                  defaultValue={p.absence_note}
                                  placeholder="Note (optional)"
                                  onBlur={(e) => handleSetCoachNote(g.id, p.id, e.target.value)}
                                  className="flex-1 min-w-[140px] rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-teal-400 focus:outline-none"
                                />
                                {p.absence_reason === "mc" && (
                                  <>
                                    {p.attachment_path ? (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleViewMC(p.attachment_path!)}
                                          className="text-xs text-teal-600 hover:underline"
                                        >
                                          View MC
                                        </button>
                                        <button
                                          onClick={() => handleRemoveCoachMC(g.id, p.id, p.attachment_path!)}
                                          disabled={busyKey === `mc-coach-${g.id}-${p.id}`}
                                          className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-60"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="cursor-pointer text-xs text-teal-600 hover:underline">
                                        {busyKey === `mc-coach-${g.id}-${p.id}` ? "Uploading..." : "+ Attach MC"}
                                        <input
                                          type="file"
                                          accept="image/*,.pdf"
                                          className="hidden"
                                          disabled={busyKey === `mc-coach-${g.id}-${p.id}`}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleUploadCoachMC(g.id, p.id, file);
                                            e.target.value = "";
                                          }}
                                        />
                                      </label>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {g.coaches.some((p) => p.isSubstitute) && (
                      <p className="mt-1.5 text-[11px] text-gray-400">
                        Regular coach{g.regularCoachNames.length === 1 ? "" : "es"}: {g.regularCoachNames.join(", ") || "none"} — unchanged going forward, this swap is for {formatDateLong(dateStr)} only.
                      </p>
                    )}
                    {allowSubstitution && availableSubs.length > 0 && (
                      <>
                        <p className="mb-1 mt-2 text-xs text-gray-400">Arrange a substitute for this date:</p>
                        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                          {availableSubs.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handleAddOverrideCoach(g.id, p.id)}
                              disabled={busyKey === `addsub-${g.id}-${p.id}`}
                              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-60 transition"
                            >
                              + {p.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {!allowSubstitution && g.coaches.some((p) => p.isSubstitute) && (
                      <p className="mt-1 text-[11px] text-gray-400">Expand to List view to change today's substitute.</p>
                    )}
                  </div>

                  {/* Swimmers */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-500">Swimmers</label>
                      {g.swimmers.length > 0 && (
                        <button
                          onClick={() => handleMarkAllPresent(g.id, g.swimmers.map((s) => s.id))}
                          disabled={busyKey === `markall-${g.id}`}
                          className="text-xs text-teal-600 hover:underline disabled:opacity-60"
                        >
                          Mark all present
                        </button>
                      )}
                    </div>
                    {g.swimmers.length === 0 ? (
                      <p className="text-xs text-gray-400">No swimmers in this group.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {g.swimmers.map((s) => (
                          <div key={s.id} className="rounded-lg bg-gray-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="inline-flex overflow-hidden rounded-full border border-gray-200">
                                  <button
                                    onClick={() =>
                                      s.hasRecord && s.present
                                        ? handleClearSwimmerRecord(g.id, s.id, s.attachment_path)
                                        : handleSetSwimmerPresent(g.id, s.id, true)
                                    }
                                    disabled={busyKey === `sw-${g.id}-${s.id}`}
                                    title={s.hasRecord && s.present ? "Click again to un-mark" : undefined}
                                    className={`px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-60 ${
                                      s.hasRecord && s.present ? "bg-green-100 text-green-700" : "bg-white text-gray-400 hover:bg-gray-50"
                                    }`}
                                  >
                                    Present
                                  </button>
                                  <button
                                    onClick={() =>
                                      s.hasRecord && !s.present
                                        ? handleClearSwimmerRecord(g.id, s.id, s.attachment_path)
                                        : handleSetSwimmerPresent(g.id, s.id, false)
                                    }
                                    disabled={busyKey === `sw-${g.id}-${s.id}`}
                                    title={s.hasRecord && !s.present ? "Click again to un-mark" : undefined}
                                    className={`border-l border-gray-200 px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-60 ${
                                      s.hasRecord && !s.present ? "bg-red-100 text-red-600" : "bg-white text-gray-400 hover:bg-gray-50"
                                    }`}
                                  >
                                    Absent
                                  </button>
                                </div>
                                {!s.hasRecord && <span className="text-[11px] text-gray-400">Not marked yet</span>}
                                <span className="text-sm font-medium text-gray-700">{s.name}</span>
                                <span className="text-xs text-gray-400">{s.level ? `Level ${s.level}` : "Not yet assessed"}</span>
                              </div>
                            </div>
                            {!s.present && (
                              <div className="mt-2 flex flex-wrap items-center gap-2 pl-1">
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleSetSwimmerAbsenceReason(g.id, s.id, "mc")}
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                                      s.absence_reason === "mc" ? "bg-teal-500 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
                                    }`}
                                  >
                                    MC
                                  </button>
                                  <button
                                    onClick={() => handleSetSwimmerAbsenceReason(g.id, s.id, "other")}
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                                      s.absence_reason === "other" ? "bg-teal-500 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
                                    }`}
                                  >
                                    Other reason
                                  </button>
                                </div>
                                <input
                                  key={`${s.id}-${s.absence_reason}`}
                                  defaultValue={s.absence_note}
                                  placeholder={s.absence_reason === "mc" ? "MC details (optional)" : "Reason"}
                                  onBlur={(e) => handleSetSwimmerNote(g.id, s.id, e.target.value)}
                                  className="flex-1 min-w-[140px] rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-teal-400 focus:outline-none"
                                />
                                {s.absence_reason === "mc" && (
                                  <>
                                    {s.attachment_path ? (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleViewMC(s.attachment_path!)}
                                          className="text-xs text-teal-600 hover:underline"
                                        >
                                          View MC
                                        </button>
                                        <button
                                          onClick={() => handleRemoveSwimmerMC(g.id, s.id, s.attachment_path!)}
                                          disabled={busyKey === `mc-sw-${g.id}-${s.id}`}
                                          className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-60"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="cursor-pointer text-xs text-teal-600 hover:underline">
                                        {busyKey === `mc-sw-${g.id}-${s.id}` ? "Uploading..." : "+ Attach MC"}
                                        <input
                                          type="file"
                                          accept="image/*,.pdf"
                                          className="hidden"
                                          disabled={busyKey === `mc-sw-${g.id}-${s.id}`}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleUploadSwimmerMC(g.id, s.id, file);
                                            e.target.value = "";
                                          }}
                                        />
                                      </label>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
