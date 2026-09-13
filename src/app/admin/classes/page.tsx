"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminHeader from "@/app/admin/components/AdminHeader";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ClassRow {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  capacity: number | null;
  location: string | null;
  archived: boolean;
  coachNames: string[];
  swimmerCount: number;
  termCount: number;
  groupCount: number;
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add class form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("6");
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [capacity, setCapacity] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadData = async () => {
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

      const clubId = adminProfile?.club_id;

      // Classes
      const { data: classRows, error: classError } = await supabase
        .from("classes")
        .select("id, name, day_of_week, start_time, duration_minutes, capacity, location, archived")
        .eq("club_id", clubId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (classError) throw new Error("Failed to load classes: " + classError.message);

      const classIds = (classRows ?? []).map((c) => c.id);
      const fallbackId = ["00000000-0000-0000-0000-000000000000"];

      const [{ data: groupRows }, { data: tsRows }] = await Promise.all([
        supabase.from("class_groups").select("id, class_id").in("class_id", classIds.length ? classIds : fallbackId),
        supabase.from("term_schedule_classes").select("term_schedule_id, class_id").in("class_id", classIds.length ? classIds : fallbackId),
      ]);

      const groupIds = (groupRows ?? []).map((g) => g.id);

      const [{ data: gcRows }, { data: gsRows }] = await Promise.all([
        supabase.from("class_group_coaches").select("group_id, coach_id").in("group_id", groupIds.length ? groupIds : fallbackId),
        supabase.from("class_group_swimmers").select("group_id, swimmer_id").in("group_id", groupIds.length ? groupIds : fallbackId),
      ]);

      const coachIds = Array.from(new Set((gcRows ?? []).map((l) => l.coach_id)));
      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", coachIds.length ? coachIds : fallbackId);
      const coachNameMap = new Map((coachProfiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));

      const merged: ClassRow[] = (classRows ?? []).map((c) => {
        const classGroupIds = (groupRows ?? []).filter((g) => g.class_id === c.id).map((g) => g.id);
        const classCoachIds = Array.from(
          new Set((gcRows ?? []).filter((l) => classGroupIds.includes(l.group_id)).map((l) => l.coach_id))
        );
        const classSwimmerIds = Array.from(
          new Set((gsRows ?? []).filter((l) => classGroupIds.includes(l.group_id)).map((l) => l.swimmer_id))
        );
        return {
          id: c.id,
          name: c.name,
          day_of_week: c.day_of_week,
          start_time: c.start_time,
          duration_minutes: c.duration_minutes,
          capacity: c.capacity,
          location: c.location,
          archived: c.archived,
          coachNames: classCoachIds.map((id) => coachNameMap.get(id) ?? "Unknown"),
          swimmerCount: classSwimmerIds.length,
          termCount: (tsRows ?? []).filter((link) => link.class_id === c.id).length,
          groupCount: classGroupIds.length,
        };
      });

      setClasses(merged);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setName("");
    setDayOfWeek("6");
    setStartTime("09:00");
    setDurationMinutes("45");
    setCapacity("");
    setLocation("");
    setFormError("");
  };

  const handleCreateClass = async () => {
    if (!name.trim()) {
      setFormError("Please give the class a name.");
      return;
    }
    setSaving(true);
    setFormError("");
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user!.id)
        .single();

      const { error: insertError } = await supabase
        .from("classes")
        .insert({
          name: name.trim(),
          day_of_week: parseInt(dayOfWeek),
          start_time: startTime,
          duration_minutes: parseInt(durationMinutes) || 45,
          capacity: capacity ? parseInt(capacity) : null,
          location: location.trim() || null,
          club_id: adminProfile?.club_id ?? null,
          created_by: user!.id,
        })
        .select("id")
        .single();

      if (insertError) throw new Error(insertError.message);

      resetForm();
      setShowAddForm(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen page-shell bg-gray-50">
        <AdminHeader />
        <div className="p-6 text-sm text-gray-500">Loading classes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell bg-gray-50">
      <AdminHeader />
      <div id="main-content" tabIndex={-1} className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Classes</h1>
            <p className="text-sm text-gray-500">{classes.length} classes</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition"
          >
            {showAddForm ? "Cancel" : "+ Add Class"}
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
        )}

        {showAddForm && (
          <div className="mb-6 rounded-xl bg-white p-4 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-800">New Class</h2>

            <div>
              <label className="mb-1 block text-sm text-gray-600">Class Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Saturday Learn to Swim"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Day</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
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
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Duration (min)</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Capacity (optional)</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Max swimmers"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Location (optional)</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Main Pool"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
                />
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Add coaches and swimmers after creating the class — you'll set them up as one or more Groups on
              the class page.
            </p>

            {formError && (
              <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{formError}</p>
            )}

            <button
              onClick={handleCreateClass}
              disabled={saving}
              className="rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60 transition"
            >
              {saving ? "Creating..." : "Create Class"}
            </button>
          </div>
        )}

        {classes.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">No classes yet. Add one to get started.</p>
        ) : (
          <div className="space-y-3">
            {classes.map((c) => (
              <Link
                key={c.id}
                href={`/admin/classes/${c.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      {DAYS[c.day_of_week]} • {formatTime(c.start_time)} • {c.duration_minutes} min
                      {c.location ? ` • ${c.location}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {c.coachNames.length > 0 ? c.coachNames.join(", ") : "No coach assigned"}
                      {" • "}
                      {c.swimmerCount} swimmer{c.swimmerCount === 1 ? "" : "s"}
                      {" • "}
                      {c.groupCount} group{c.groupCount === 1 ? "" : "s"}
                      {" • "}
                      {c.termCount} term schedule{c.termCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">&rsaquo;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
