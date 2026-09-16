"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import AdminHeader from "@/app/admin/components/AdminHeader";
import TermScheduleTable from "@/app/admin/components/TermScheduleTable";
import { DAYS, TermSchedule, formatTime } from "@/utils/termSchedule";

interface ClassInfo {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  capacity: number | null;
  location: string | null;
  club_id: string | null;
}

interface Person {
  id: string;
  name: string;
}

type Classification = "not_yet_assessed" | "normal" | "mild" | "severe";

interface EnrolledSwimmer extends Person {
  level: number | null;
  enrolled_at: string;
  classification: Classification;
}

const CLASSIFICATION_LABELS: Record<Classification, string> = {
  not_yet_assessed: "Not yet assessed",
  normal: "Normal",
  mild: "Mild",
  severe: "Severe",
};

const CLASSIFICATION_STYLES: Record<Classification, string> = {
  not_yet_assessed: "bg-gray-100 text-gray-500",
  normal: "bg-blue-50 text-blue-700",
  mild: "bg-amber-50 text-amber-700",
  severe: "bg-red-50 text-red-700",
};

interface Group {
  id: string;
  group_name: string;
  coaches: Person[];
  swimmers: EnrolledSwimmer[];
}

export default function ClassDetailPage() {
  const params = useParams();
  const classId = params.id as string;

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [termSchedules, setTermSchedules] = useState<TermSchedule[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allClubCoaches, setAllClubCoaches] = useState<Person[]>([]);
  const [allClubSwimmers, setAllClubSwimmers] = useState<EnrolledSwimmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit-class-details mode
  const [editingDetails, setEditingDetails] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDay, setEditDay] = useState("6");
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editDuration, setEditDuration] = useState("45");
  const [editCapacity, setEditCapacity] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const [groupBusy, setGroupBusy] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: cls, error: clsError } = await supabase
        .from("classes")
        .select("id, name, day_of_week, start_time, duration_minutes, capacity, location, club_id")
        .eq("id", classId)
        .single();

      if (clsError || !cls) throw new Error("Class not found.");
      setClassInfo(cls);
      setEditName(cls.name);
      setEditDay(String(cls.day_of_week));
      setEditStartTime(cls.start_time.slice(0, 5));
      setEditDuration(String(cls.duration_minutes));
      setEditCapacity(cls.capacity ? String(cls.capacity) : "");
      setEditLocation(cls.location ?? "");

      const clubId = cls.club_id;
      const fallbackId = ["00000000-0000-0000-0000-000000000000"];

      // Everyone in the club (for the "add to group" pickers).
      const [{ data: clubCoachRows }, { data: clubSwimmerRows }] = await Promise.all([
        supabase.from("coaches").select("id").eq("club_id", clubId),
        supabase.from("swimmers").select("id, level, classification").eq("club_id", clubId),
      ]);

      const clubCoachIds = (clubCoachRows ?? []).map((c) => c.id);
      const clubSwimmerIds = (clubSwimmerRows ?? []).map((s) => s.id);
      const allPersonIds = Array.from(new Set([...clubCoachIds, ...clubSwimmerIds]));

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", allPersonIds.length ? allPersonIds : fallbackId);

      const nameMap = new Map((profileRows ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
      const levelMap = new Map((clubSwimmerRows ?? []).map((s) => [s.id, s.level]));
      const classificationMap = new Map(
        (clubSwimmerRows ?? []).map((s) => [s.id, (s.classification as Classification) ?? "not_yet_assessed"])
      );

      setAllClubCoaches(clubCoachIds.map((id) => ({ id, name: nameMap.get(id) ?? "Unknown" })));
      setAllClubSwimmers(
        clubSwimmerIds.map((id) => ({
          id,
          name: nameMap.get(id) ?? "Unknown",
          level: levelMap.get(id) ?? null,
          classification: classificationMap.get(id) ?? "not_yet_assessed",
          enrolled_at: "",
        }))
      );

      // Groups for this class, plus their coaches/swimmers.
      const { data: groupRows, error: groupsError } = await supabase
        .from("class_groups")
        .select("id, group_name")
        .eq("class_id", classId)
        .order("created_at", { ascending: true });

      if (groupsError) throw new Error("Failed to load groups.");

      const groupIds = (groupRows ?? []).map((g) => g.id);

      const [{ data: gcRows }, { data: gsRows }] = await Promise.all([
        supabase.from("class_group_coaches").select("group_id, coach_id").in("group_id", groupIds.length ? groupIds : fallbackId),
        supabase.from("class_group_swimmers").select("group_id, swimmer_id, enrolled_at").in("group_id", groupIds.length ? groupIds : fallbackId),
      ]);

      const mergedGroups: Group[] = (groupRows ?? []).map((g) => ({
        id: g.id,
        group_name: g.group_name,
        coaches: (gcRows ?? [])
          .filter((l) => l.group_id === g.id)
          .map((l) => ({ id: l.coach_id, name: nameMap.get(l.coach_id) ?? "Unknown" })),
        swimmers: (gsRows ?? [])
          .filter((l) => l.group_id === g.id)
          .map((l) => ({
            id: l.swimmer_id,
            name: nameMap.get(l.swimmer_id) ?? "Unknown",
            level: levelMap.get(l.swimmer_id) ?? null,
            classification: classificationMap.get(l.swimmer_id) ?? "not_yet_assessed",
            enrolled_at: l.enrolled_at,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));

      setGroups(mergedGroups);

      // Term schedules linked to this class via the junction table.
      const { data: links, error: linksError } = await supabase
        .from("term_schedule_classes")
        .select("term_schedule_id")
        .eq("class_id", classId);

      if (linksError) throw new Error("Failed to load term schedules.");

      const termIds = (links ?? []).map((l) => l.term_schedule_id);

      const [{ data: terms }, { data: dates }, { data: notes }] = await Promise.all([
        supabase
          .from("term_schedules")
          .select("id, term_name, term_number, start_date, end_date")
          .in("id", termIds.length ? termIds : fallbackId)
          .order("start_date", { ascending: true }),
        supabase
          .from("term_schedule_dates")
          .select("id, term_schedule_id, lesson_date, has_lesson, remarks")
          .in("term_schedule_id", termIds.length ? termIds : fallbackId)
          .order("lesson_date", { ascending: true }),
        supabase
          .from("term_schedule_month_notes")
          .select("id, term_schedule_id, year, month, note")
          .in("term_schedule_id", termIds.length ? termIds : fallbackId),
      ]);

      const mergedTerms: TermSchedule[] = (terms ?? []).map((t) => ({
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
        classIds: [],
      }));

      setTermSchedules(mergedTerms);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveDetails = async () => {
    if (!editName.trim()) {
      setDetailsError("Please give the class a name.");
      return;
    }
    setSavingDetails(true);
    setDetailsError("");
    const supabase = createClient();

    try {
      const { error: updateError } = await supabase
        .from("classes")
        .update({
          name: editName.trim(),
          day_of_week: parseInt(editDay),
          start_time: editStartTime,
          duration_minutes: parseInt(editDuration) || 45,
          capacity: editCapacity ? parseInt(editCapacity) : null,
          location: editLocation.trim() || null,
        })
        .eq("id", classId);

      if (updateError) throw new Error(updateError.message);

      setEditingDetails(false);
      await loadData();
    } catch (err: any) {
      setDetailsError(err.message);
    } finally {
      setSavingDetails(false);
    }
  };

  const handleAddGroup = async () => {
    setAddingGroup(true);
    const supabase = createClient();
    await supabase.from("class_groups").insert({
      class_id: classId,
      group_name: `Group ${groups.length + 1}`,
    });
    await loadData();
    setAddingGroup(false);
  };

  const handleRenameGroup = async (groupId: string, newName: string) => {
    const supabase = createClient();
    await supabase.from("class_groups").update({ group_name: newName }).eq("id", groupId);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Delete this group? This removes its coach and swimmer assignments.")) return;
    setGroupBusy(groupId);
    const supabase = createClient();
    await supabase.from("class_groups").delete().eq("id", groupId);
    await loadData();
    setGroupBusy(null);
  };

  const handleAddGroupCoach = async (groupId: string, coachId: string) => {
    setGroupBusy(`${groupId}-${coachId}`);
    const supabase = createClient();
    await supabase.from("class_group_coaches").insert({ group_id: groupId, coach_id: coachId });
    await loadData();
    setGroupBusy(null);
  };

  const handleRemoveGroupCoach = async (groupId: string, coachId: string) => {
    setGroupBusy(`${groupId}-${coachId}`);
    const supabase = createClient();
    await supabase.from("class_group_coaches").delete().eq("group_id", groupId).eq("coach_id", coachId);
    await loadData();
    setGroupBusy(null);
  };

  const handleAddGroupSwimmer = async (groupId: string, swimmerId: string) => {
    setGroupBusy(`${groupId}-${swimmerId}`);
    const supabase = createClient();
    await supabase.from("class_group_swimmers").insert({ group_id: groupId, swimmer_id: swimmerId });
    await loadData();
    setGroupBusy(null);
  };

  const handleSetClassification = async (swimmerId: string, classification: Classification) => {
    const supabase = createClient();
    const { data: updated, error: updateError } = await supabase
      .from("swimmers")
      .update({ classification })
      .eq("id", swimmerId)
      .select("id");
    if (updateError) {
      window.alert("Couldn't update classification: " + updateError.message);
      return;
    }
    if (!updated || updated.length === 0) {
      window.alert(
        "The update ran but changed nothing — you likely don't have permission to edit this swimmer's classification (a database permissions rule is silently blocking it)."
      );
      return;
    }
    await loadData();
  };

  const handleSetEnrolledAt = async (groupId: string, swimmerId: string, dateStr: string) => {
    const supabase = createClient();
    const { data: updated, error: updateError } = await supabase
      .from("class_group_swimmers")
      .update({ enrolled_at: dateStr })
      .eq("group_id", groupId)
      .eq("swimmer_id", swimmerId)
      .select("group_id");
    if (updateError) {
      window.alert("Couldn't update joined date: " + updateError.message);
      return;
    }
    if (!updated || updated.length === 0) {
      window.alert(
        "The update ran but changed nothing — you likely don't have permission to edit this (a database permissions rule is silently blocking it)."
      );
      return;
    }
    await loadData();
  };

  const handleRemoveGroupSwimmer = async (groupId: string, swimmerId: string) => {
    setGroupBusy(`${groupId}-${swimmerId}`);
    const supabase = createClient();
    await supabase.from("class_group_swimmers").delete().eq("group_id", groupId).eq("swimmer_id", swimmerId);
    await loadData();
    setGroupBusy(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen page-shell bg-gray-50">
        <AdminHeader />
        <div className="p-6 text-sm text-gray-500">Loading class...</div>
      </div>
    );
  }

  if (error || !classInfo) {
    return (
      <div className="min-h-screen page-shell bg-gray-50">
        <AdminHeader />
        <div className="p-6 text-sm text-red-500">{error ?? "Class not found."}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell bg-gray-50">
      <AdminHeader />
      <div id="main-content" tabIndex={-1} className="p-6 max-w-7xl">
        <div className="max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
          <Link href="/admin/classes" className="text-gray-400 hover:text-gray-600">&larr;</Link>
          <div className="flex-1">
            {!editingDetails && (
              <>
                <h1 className="text-xl font-bold text-gray-800">{classInfo.name}</h1>
                <p className="text-sm text-gray-500">
                  {DAYS[classInfo.day_of_week]} • {formatTime(classInfo.start_time)} • {classInfo.duration_minutes} min
                  {classInfo.capacity ? ` • Capacity ${classInfo.capacity}` : ""}
                  {classInfo.location ? ` • ${classInfo.location}` : ""}
                </p>
              </>
            )}
          </div>
          {!editingDetails && (
            <button
              onClick={() => setEditingDetails(true)}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              Edit
            </button>
          )}
        </div>

        {editingDetails && (
          <div className="mb-6 rounded-xl bg-white p-4 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-800">Edit Class Details</h2>

            <div>
              <label className="mb-1 block text-sm text-gray-600">Class Name *</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Day</label>
                <select
                  value={editDay}
                  onChange={(e) => setEditDay(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
                >
                  {DAYS.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Start Time</label>
                <input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Duration (min)</label>
                <input
                  type="number"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Capacity (optional)</label>
                <input
                  type="number"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                  placeholder="Max swimmers"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Location (optional)</label>
                <input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. Main Pool"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
                />
              </div>
            </div>

            {detailsError && (
              <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{detailsError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveDetails}
                disabled={savingDetails}
                className="rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60 transition"
              >
                {savingDetails ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setEditingDetails(false); setDetailsError(""); }}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Groups */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Groups</h2>
            <p className="text-xs text-gray-400">
              Split this time slot into separate coach + swimmer groups — handy when more than one coach is
              running different kids at the same class.
            </p>
          </div>
          <button
            onClick={handleAddGroup}
            disabled={addingGroup}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60 transition whitespace-nowrap"
          >
            {addingGroup ? "Adding..." : "+ Add Group"}
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="mb-6 text-center text-sm text-gray-500 py-8 rounded-xl bg-white shadow-sm">
            No groups yet. Add a group to assign coaches and swimmers to this class.
          </p>
        ) : (
          <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 items-start">
            {groups.map((g) => {
              const availableCoaches = allClubCoaches.filter((c) => !g.coaches.some((gc) => gc.id === c.id));
              const availableSwimmers = allClubSwimmers.filter((s) => !g.swimmers.some((gs) => gs.id === s.id));
              return (
                <div key={g.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <input
                      defaultValue={g.group_name}
                      placeholder="e.g. Beginner, Int/Adv, Competitive"
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== g.group_name) {
                          handleRenameGroup(g.id, e.target.value.trim());
                        }
                      }}
                      className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-sm font-semibold text-gray-800 focus:border-teal-400 focus:bg-white focus:outline-none"
                    />
                    <button
                      onClick={() => handleDeleteGroup(g.id)}
                      disabled={groupBusy === g.id}
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-500 disabled:opacity-60 whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="mb-3 text-[11px] text-gray-400">Click the name to rename this group</p>

                  <p className="mb-1.5 text-xs font-medium text-gray-500">Coaches</p>
                  {g.coaches.length === 0 ? (
                    <p className="mb-2 text-xs text-gray-400">No coach assigned.</p>
                  ) : (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {g.coaches.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleRemoveGroupCoach(g.id, c.id)}
                          disabled={groupBusy === `${g.id}-${c.id}`}
                          className="flex items-center gap-1.5 rounded-full bg-teal-500 px-3 py-1 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-60 transition"
                        >
                          {c.name} <span aria-hidden="true">&times;</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {availableCoaches.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {availableCoaches.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleAddGroupCoach(g.id, c.id)}
                          disabled={groupBusy === `${g.id}-${c.id}`}
                          className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-60 transition"
                        >
                          + {c.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="mb-1.5 text-xs font-medium text-gray-500">Swimmers</p>
                  {g.swimmers.length === 0 ? (
                    <p className="mb-2 text-xs text-gray-400">No swimmers enrolled.</p>
                  ) : (
                    <div className="mb-2 space-y-1.5">
                      {g.swimmers.map((s) => (
                        <div key={s.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-medium text-gray-700">{s.name}</span>
                              <span className="text-xs text-gray-500">
                                {s.level ? `Level ${s.level}` : "Not yet assessed"}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                Joined this class:
                                <input
                                  key={s.enrolled_at.slice(0, 10)}
                                  type="date"
                                  defaultValue={s.enrolled_at.slice(0, 10)}
                                  onBlur={(e) => {
                                    if (!e.target.value || e.target.value === s.enrolled_at.slice(0, 10)) return;
                                    handleSetEnrolledAt(g.id, s.id, e.target.value);
                                  }}
                                  className="rounded border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-600"
                                />
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveGroupSwimmer(g.id, s.id)}
                              disabled={groupBusy === `${g.id}-${s.id}`}
                              className="whitespace-nowrap text-xs text-gray-400 hover:text-red-500 disabled:opacity-60"
                            >
                              &times; Remove
                            </button>
                          </div>
                          <select
                            value={s.classification}
                            onChange={(e) => handleSetClassification(s.id, e.target.value as Classification)}
                            className={`mt-1.5 rounded-full border-0 px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-400 ${CLASSIFICATION_STYLES[s.classification]}`}
                          >
                            {(Object.keys(CLASSIFICATION_LABELS) as Classification[]).map((k) => (
                              <option key={k} value={k}>{CLASSIFICATION_LABELS[k]}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                  {availableSwimmers.length > 0 && (
                    <>
                      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                        <span>Tinted by classification:</span>
                        {(Object.keys(CLASSIFICATION_LABELS) as Classification[]).map((k) => (
                          <span key={k} className={`rounded-full px-1.5 py-0.5 ${CLASSIFICATION_STYLES[k]}`}>{CLASSIFICATION_LABELS[k]}</span>
                        ))}
                      </div>
                      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                        {availableSwimmers.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleAddGroupSwimmer(g.id, s.id)}
                            disabled={groupBusy === `${g.id}-${s.id}`}
                            className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 transition hover:opacity-80 ${CLASSIFICATION_STYLES[s.classification]}`}
                          >
                            + {s.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Term Schedules */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Term Schedules</h2>
          <Link
            href="/admin/term-schedules"
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition"
          >
            Manage Term Schedules
          </Link>
        </div>

        {termSchedules.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">
            No term schedule applied to this class yet. Head to Term Schedules to create or attach one.
          </p>
        ) : (
          <div className="space-y-4">
            {termSchedules.map((term) => (
              <TermScheduleTable key={term.id} term={term} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
