"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

const CONDITIONS = ["Autism", "Intellectual Disability", "Physically Disabled", "Down Syndrome", "Others", "None"];

export default function AddStudentPage() {
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [level, setLevel] = useState("");
  const [category, setCategory] = useState("LFA");
  const [conditions, setConditions] = useState<string[]>([]);
  const [sensoryNeeds, setSensoryNeeds] = useState("");
  const [interests, setInterests] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleCondition = (c: string) =>
    setConditions((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const handleSubmit = async () => {
    if (!fullName.trim() || !consent) {
      setError("Please fill in the swimmer name and confirm consent.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get coach's club_id (may be null for independent). A club coach's club
    // can live on coaches.club_id rather than profiles.club_id, so resolve it
    // the same way the student list does (see ../page.tsx).
    const [{ data: coachProfile }, { data: coachRow }] = await Promise.all([
      supabase.from("profiles").select("club_id").eq("id", user!.id).single(),
      supabase.from("coaches").select("club_id").eq("id", user!.id).single(),
    ]);

    const clubId = coachProfile?.club_id ?? coachRow?.club_id ?? null;

    // 1. Create auth user for swimmer — in practice this would be an invite
    // For independent coaches, we create a profile entry directly
    // The swimmer will claim their account later via email invite
    // Here we create a placeholder profile with a generated UUID
    const swimmerId = crypto.randomUUID();

    // 2. Insert into profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: swimmerId,
        role: "swimmer",
        full_name: fullName,
        club_id: clubId,
      });

    if (profileError) {
      setError("Could not create swimmer profile: " + profileError.message);
      setSaving(false);
      return;
    }

    // 3. Insert into swimmers
    await supabase.from("swimmers").insert({
      id: swimmerId,
      age: age ? parseInt(age) : null,
      level: level ? parseInt(level) : null,
      category,
      club_id: clubId,
    });

    // 4. Insert swimmer_profile (sensory/conditions)
    if (conditions.length > 0 || sensoryNeeds) {
      await supabase.from("swimmer_profiles").insert({
        swimmer_id: swimmerId,
        conditions,
        sensory_needs: sensoryNeeds || null,
        interests: interests || null,
        consent_given: consent,
      });
    }

    // 5. Assign to this coach
    await supabase.from("coach_students").insert({
      coach_id: user!.id,
      swimmer_id: swimmerId,
    });

    window.location.href = "/coach/students";
  };

  return (
    <div className="min-h-screen page-shell-narrow bg-gray-50 p-6 pb-12">
      <div className="mb-6 flex items-center gap-2">
        <Link href="/coach/students" className="text-gray-400 hover:text-gray-600">&larr;</Link>
        <h1 className="text-xl font-bold text-gray-800">Add Student</h1>
      </div>

      <div className="space-y-4">
        {/* Basic info */}
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">👤 Basic Information</h2>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Full Name *</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Student's full name"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-600">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={1} max={99}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
              >
                <option value="">Not yet assessed</option>
                {[1, 2, 3, 4].map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Programme Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-400 focus:outline-none"
            >
              {["LFA", "GPA", "Development", "Competitive"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Conditions */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-800">🕐 Swimmer Conditions</h2>
          <p className="mb-3 text-xs text-gray-500">Select all that apply.</p>
          <div className="space-y-2">
            {CONDITIONS.map((c) => (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conditions.includes(c)}
                  onChange={() => toggleCondition(c)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-500"
                />
                <span className="text-sm text-gray-700">{c}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sensory needs */}
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-800">🌸 Sensory & Interests</h2>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Sensory needs or sensitivities</label>
            <textarea
              value={sensoryNeeds}
              onChange={(e) => setSensoryNeeds(e.target.value)}
              placeholder="e.g. Sensitive to loud noises, prefers warm water..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Interests & motivations</label>
            <textarea
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. Loves dolphins, motivated by stickers..."
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Consent */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-500"
          />
          <span className="text-xs text-gray-600">
            I confirm that consent has been obtained from the swimmer&apos;s caregiver to store this information for coaching purposes. *
          </span>
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <Link
            href="/coach/students"
            className="flex-1 rounded-lg border border-gray-200 py-3 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 rounded-lg bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60 transition"
          >
            {saving ? "Adding…" : "Add Student"}
          </button>
        </div>
      </div>
    </div>
  );
}
