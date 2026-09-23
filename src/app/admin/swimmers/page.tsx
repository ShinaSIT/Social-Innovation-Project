"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminHeader from "@/app/admin/components/AdminHeader";
import ClassesStudentsTabs from "@/app/admin/components/ClassesStudentsTabs";
import SwimmerRequestFields from "@/app/admin/components/SwimmerRequestFields";
import {
  Classification,
  ClassTypePreference,
  EMPTY_SWIMMER_REQUEST,
} from "@/utils/swimmerRequests";

interface Enrollment {
  classId: string;
  className: string;
  groupName: string;
}

interface SwimmerRow {
  id: string;
  name: string;
  age: number | null;
  level: number | null;
  classification: Classification;
  requested_days: string[];
  requested_time_start: string | null;
  requested_time_end: string | null;
  class_type_preference: ClassTypePreference;
  class_type_notes: string | null;
  request_logged_at: string | null;
  enrollments: Enrollment[];
}

interface NoClubSwimmer {
  id: string;
  name: string;
  age: number | null;
}

export default function AdminSwimmersPage() {
  const [swimmers, setSwimmers] = useState<SwimmerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [clubId, setClubId] = useState<string | null>(null);
  const [noClubSwimmers, setNoClubSwimmers] = useState<NoClubSwimmer[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  const loadData = async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      const { data: adminProfile, error: adminError } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();
      if (adminError) throw new Error("Failed to load admin profile.");

      const clubId = adminProfile?.club_id;
      setClubId(clubId ?? null);
      const fallbackId = ["00000000-0000-0000-0000-000000000000"];

      const { data: swimmerRows, error: swimmersError } = await supabase
        .from("swimmers")
        .select("id, age, level, classification, requested_days, requested_time_start, requested_time_end, class_type_preference, class_type_notes, request_logged_at")
        .eq("club_id", clubId);
      if (swimmersError) throw new Error("Failed to load students.");

      const swimmerIds = (swimmerRows ?? []).map((s) => s.id);

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", swimmerIds.length ? swimmerIds : fallbackId);
      const nameMap = new Map((profileRows ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));

      // Which class group(s) each swimmer is currently enrolled in.
      const { data: gsRows } = await supabase
        .from("class_group_swimmers")
        .select("group_id, swimmer_id")
        .in("swimmer_id", swimmerIds.length ? swimmerIds : fallbackId);

      const groupIds = Array.from(new Set((gsRows ?? []).map((r) => r.group_id)));
      const { data: groupRows } = await supabase
        .from("class_groups")
        .select("id, class_id, group_name")
        .in("id", groupIds.length ? groupIds : fallbackId);

      const classIds = Array.from(new Set((groupRows ?? []).map((g) => g.class_id)));
      const { data: classRows } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", classIds.length ? classIds : fallbackId);

      const groupInfoMap = new Map((groupRows ?? []).map((g) => [g.id, g]));
      const classInfoMap = new Map((classRows ?? []).map((c) => [c.id, c]));

      const enrollmentsBySwimmer = new Map<string, Enrollment[]>();
      for (const row of gsRows ?? []) {
        const group = groupInfoMap.get(row.group_id);
        if (!group) continue;
        const cls = classInfoMap.get(group.class_id);
        if (!cls) continue;
        const list = enrollmentsBySwimmer.get(row.swimmer_id) ?? [];
        list.push({ classId: cls.id, className: cls.name, groupName: group.group_name });
        enrollmentsBySwimmer.set(row.swimmer_id, list);
      }

      const rows: SwimmerRow[] = (swimmerRows ?? []).map((s) => ({
        id: s.id,
        name: nameMap.get(s.id) ?? "Unknown",
        age: s.age,
        level: s.level,
        classification: (s.classification as Classification) ?? "not_yet_assessed",
        requested_days: (s.requested_days as string[] | null) ?? EMPTY_SWIMMER_REQUEST.requested_days,
        requested_time_start: s.requested_time_start ?? null,
        requested_time_end: s.requested_time_end ?? null,
        class_type_preference: (s.class_type_preference as ClassTypePreference) ?? "no_preference",
        class_type_notes: s.class_type_notes ?? null,
        request_logged_at: s.request_logged_at ?? null,
        enrollments: enrollmentsBySwimmer.get(s.id) ?? [],
      })).sort((a, b) => a.name.localeCompare(b.name));

      setSwimmers(rows);

      // Self-registered swimmers start with no club (handle_new_user() doesn't
      // set one), so they never match the club filter above. List them so an
      // admin can bring them into the club. Filter on role too: a promoted coach
      // can still have a leftover swimmers row.
      const { data: noClubRows } = await supabase
        .from("swimmers")
        .select("id, age")
        .is("club_id", null);
      const noClubIds = (noClubRows ?? []).map((s) => s.id);
      const { data: noClubProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", noClubIds.length ? noClubIds : fallbackId);
      const noClubProfileMap = new Map((noClubProfiles ?? []).map((p) => [p.id, p]));

      setNoClubSwimmers(
        (noClubRows ?? [])
          .filter((s) => noClubProfileMap.get(s.id)?.role === "swimmer")
          .map((s) => ({
            id: s.id,
            name: noClubProfileMap.get(s.id)?.full_name ?? "Unknown",
            age: s.age,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleUpdateSwimmerRequest = async (
    swimmerId: string,
    patch: Partial<{
      requested_days: string[];
      requested_time_start: string | null;
      requested_time_end: string | null;
      class_type_preference: ClassTypePreference;
      class_type_notes: string | null;
      request_logged_at: string;
    }>
  ) => {
    const supabase = createClient();
    const { data: updated, error: updateError } = await supabase
      .from("swimmers")
      .update(patch)
      .eq("id", swimmerId)
      .select("id");
    if (updateError) {
      window.alert("Couldn't update the parent's timing/class-type request: " + updateError.message);
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

  const handleAddToClub = async (swimmer: NoClubSwimmer) => {
    if (!clubId) return;
    if (!window.confirm(`Add ${swimmer.name} to your club?`)) return;
    setAddingId(swimmer.id);
    const supabase = createClient();

    const { data: updated, error: swimmerError } = await supabase
      .from("swimmers")
      .update({ club_id: clubId })
      .eq("id", swimmer.id)
      .is("club_id", null)
      .select("id");
    if (swimmerError || !updated?.length) {
      window.alert(
        swimmerError
          ? "Couldn't add this student to your club: " + swimmerError.message
          : "The update ran but changed nothing — the student may already have been added to a club."
      );
      setAddingId(null);
      await loadData();
      return;
    }

    // Keep profiles.club_id in step: shares_my_club() reads it before
    // swimmers.club_id, so a mismatch hides the swimmer from coaches. This has
    // to run after the swimmers update, which is what lets the same-club admin
    // policy allow it.
    const { data: profileUpdated, error: profileError } = await supabase
      .from("profiles")
      .update({ club_id: clubId })
      .eq("id", swimmer.id)
      .select("id");
    if (profileError || !profileUpdated?.length) {
      window.alert(
        "The student was added to your club, but their profile's club couldn't be updated" +
          (profileError ? ": " + profileError.message : " (a database permissions rule blocked it).")
      );
    }

    setAddingId(null);
    await loadData();
  };

  const filteredSwimmers = useMemo(() => {
    return swimmers.filter((s) => {
      if (unassignedOnly && s.enrollments.length > 0) return false;
      if (search.trim() && !s.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [swimmers, unassignedOnly, search]);

  const unassignedCount = swimmers.filter((s) => s.enrollments.length === 0).length;

  const filteredNoClubSwimmers = noClubSwimmers.filter(
    (s) => !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen page-shell bg-gray-50">
      <AdminHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
        <ClassesStudentsTabs />
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">All Students</h1>
          <p className="text-sm text-gray-500">
            {swimmers.length} student{swimmers.length === 1 ? "" : "s"} in your club
            {unassignedCount > 0 && ` · ${unassignedCount} not in a class yet`}
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(e) => setUnassignedOnly(e.target.checked)}
            />
            Not in a class yet only
          </label>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {!loading && filteredNoClubSwimmers.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4">
            <h2 className="font-semibold text-gray-800">Not in any club yet</h2>
            <p className="mb-3 text-xs text-gray-500">
              These students registered themselves and haven&apos;t joined a club. Add them to your club to
              enrol them in classes and assign coaches.
            </p>
            <div className="space-y-2">
              {filteredNoClubSwimmers.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-gray-800">{s.name}</span>
                    <span className="text-xs text-gray-500">{s.age ? `${s.age} yrs` : "Age not set"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddToClub(s)}
                    disabled={addingId !== null}
                    className="rounded-full border border-teal-300 px-3 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50 disabled:opacity-50"
                  >
                    {addingId === s.id ? "Adding..." : "Add to my club"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading students...</p>
        ) : filteredSwimmers.length === 0 ? (
          <p className="text-sm text-gray-400">No students match.</p>
        ) : (
          <div className="space-y-2">
            {filteredSwimmers.map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-gray-800">{s.name}</span>
                    <span className="text-xs text-gray-500">
                      {s.age ? `${s.age} yrs` : "Age not set"} · {s.level ? `Level ${s.level}` : "Not yet assessed"}
                    </span>
                  </div>
                  {s.enrollments.length === 0 ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      Not in a class yet
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {s.enrollments.map((e, i) => (
                        <Link
                          key={`${e.classId}-${i}`}
                          href={`/admin/classes/${e.classId}`}
                          className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                        >
                          {e.className} ({e.groupName})
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-1">
                  <SwimmerRequestFields
                    classification={s.classification}
                    onSetClassification={(c) => handleSetClassification(s.id, c)}
                    requestedDays={s.requested_days}
                    requestedTimeStart={s.requested_time_start}
                    requestedTimeEnd={s.requested_time_end}
                    classTypePreference={s.class_type_preference}
                    classTypeNotes={s.class_type_notes}
                    requestLoggedAt={s.request_logged_at}
                    onSaveRequest={(patch) => handleUpdateSwimmerRequest(s.id, patch)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
