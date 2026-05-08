"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface FormData {
  age: string;
  conditions: string[];
  sensory_needs: string;
  sensory_details: string;
  interests: string;
  noise_sensitivity: string;
  touch_tolerance: string;
  transition_difficulty: string;
  communication_preference: string;
  known_triggers: string;
  additional_notes: string;
  consent_given: boolean;
}

const CONDITION_OPTIONS = [
  "Autism",
  "Intellectual Disability",
  "Physically Disabled",
  "Down Syndrome",
  "Others",
  "None",
];

// Sanitize text input - strip HTML tags and limit length
function sanitize(value: string, maxLength = 500): string {
  return value
    .replace(/<[^>]*>/g, "")           // strip HTML tags
    .replace(/[<>"'`]/g, "")           // strip dangerous characters
    .slice(0, maxLength)
}

function sanitizeNumber(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, 3);
}

function validateForm(form: FormData): string | null {
  const age = parseInt(form.age);
  if (form.age && (isNaN(age) || age < 1 || age > 120)) {
    return "Please enter a valid age between 1 and 120.";
  }

  const noise = parseInt(form.noise_sensitivity);
  if (form.noise_sensitivity && (isNaN(noise) || noise < 0 || noise > 10)) {
    return "Noise sensitivity must be between 0 and 10.";
  }

  const touch = parseInt(form.touch_tolerance);
  if (form.touch_tolerance && (isNaN(touch) || touch < 0 || touch > 10)) {
    return "Touch tolerance must be between 0 and 10.";
  }

  const transition = parseInt(form.transition_difficulty);
  if (form.transition_difficulty && (isNaN(transition) || transition < 0 || transition > 10)) {
    return "Transition difficulty must be between 0 and 10.";
  }

  if (form.sensory_needs.length > 500) return "Sensory needs must be under 500 characters.";
  if (form.sensory_details.length > 500) return "Sensory details must be under 500 characters.";
  if (form.interests.length > 500) return "Interests must be under 500 characters.";
  if (form.communication_preference.length > 200) return "Communication preference must be under 200 characters.";
  if (form.known_triggers.length > 500) return "Known triggers must be under 500 characters.";
  if (form.additional_notes.length > 500) return "Additional notes must be under 500 characters.";

  return null;
}

export default function EditSwimmerProfilePage() {
  const [swimmerId, setSwimmerId] = useState<string | null>(null);
  const [swimmerName, setSwimmerName] = useState<string>("Swimmer");
  const [form, setForm] = useState<FormData>({
    age: "",
    conditions: [],
    sensory_needs: "",
    sensory_details: "",
    interests: "",
    noise_sensitivity: "",
    touch_tolerance: "",
    transition_difficulty: "",
    communication_preference: "",
    known_triggers: "",
    additional_notes: "",
    consent_given: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      // Determine swimmer ID (caregiver or swimmer)
      let targetSwimmerId = user.id;

      const { data: caregiverLinks } = await supabase
        .from("caregiver_swimmers")
        .select("swimmer_id")
        .eq("caregiver_id", user.id)
        .limit(1);

      if (caregiverLinks && caregiverLinks.length > 0) {
        targetSwimmerId = caregiverLinks[0].swimmer_id;
      }

      setSwimmerId(targetSwimmerId);

      // Fetch swimmer name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", targetSwimmerId)
        .single();

      setSwimmerName(profileData?.full_name ?? "Swimmer");

      // Fetch swimmers table data
      const { data: swimmerData } = await supabase
        .from("swimmers")
        .select("age")
        .eq("id", targetSwimmerId)
        .single();

      // Fetch swimmer_profiles table data
      const { data: swimmerProfile } = await supabase
        .from("swimmer_profiles")
        .select("conditions, sensory_needs, sensory_details, interests, noise_sensitivity, touch_tolerance, transition_difficulty, communication_preference, known_triggers, additional_notes, consent_given")
        .eq("swimmer_id", targetSwimmerId)
        .single();

      setForm({
        age: swimmerData?.age?.toString() ?? "",
        conditions: swimmerProfile?.conditions ?? [],
        sensory_needs: swimmerProfile?.sensory_needs ?? "",
        sensory_details: swimmerProfile?.sensory_details ?? "",
        interests: swimmerProfile?.interests ?? "",
        noise_sensitivity: swimmerProfile?.noise_sensitivity?.toString() ?? "",
        touch_tolerance: swimmerProfile?.touch_tolerance?.toString() ?? "",
        transition_difficulty: swimmerProfile?.transition_difficulty?.toString() ?? "",
        communication_preference: swimmerProfile?.communication_preference ?? "",
        known_triggers: (swimmerProfile?.known_triggers ?? []).join(", "),
        additional_notes: swimmerProfile?.additional_notes ?? "",
        consent_given: swimmerProfile?.consent_given ?? false,
      });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCondition = (c: string) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(c)
        ? prev.conditions.filter((x) => x !== c)
        : [...prev.conditions, c],
    }));
  };

  const handleChange = (
    field: keyof FormData,
    value: string,
    maxLength = 500
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: sanitize(value, maxLength),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swimmerId) return;

    // Validate
    const validationError = validateForm(form);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSuccess(false);

    const supabase = createClient();

    try {
      // Update swimmers table
      if (form.age) {
        const { error: swimmerError } = await supabase
          .from("swimmers")
          .update({ age: parseInt(form.age) })
          .eq("id", swimmerId);

        if (swimmerError) throw new Error("Failed to update age.");
      }

      // Parse known_triggers from comma-separated string to array
      const triggersArray = form.known_triggers
        ? form.known_triggers
            .split(",")
            .map((t) => sanitize(t.trim(), 100))
            .filter((t) => t.length > 0)
        : [];

      // Upsert swimmer_profiles table
      const { error: profileError } = await supabase
        .from("swimmer_profiles")
        .upsert({
          swimmer_id: swimmerId,
          conditions: form.conditions,
          sensory_needs: form.sensory_needs || null,
          sensory_details: form.sensory_details || null,
          interests: form.interests || null,
          noise_sensitivity: form.noise_sensitivity ? parseInt(form.noise_sensitivity) : null,
          touch_tolerance: form.touch_tolerance ? parseInt(form.touch_tolerance) : null,
          transition_difficulty: form.transition_difficulty ? parseInt(form.transition_difficulty) : null,
          communication_preference: form.communication_preference || null,
          known_triggers: triggersArray,
          additional_notes: form.additional_notes || null,
          consent_given: form.consent_given,
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw new Error("Failed to save profile: " + profileError.message);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-b from-teal-50 to-gray-50 px-6 pt-6 pb-8 text-center">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/swimmer/dashboard" className="text-gray-400 hover:text-gray-600">&larr;</Link>
          <span />
        </div>
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-700">
          {swimmerName[0]}
        </div>
        <h1 className="text-xl font-bold text-gray-800">Swimmer Profile</h1>
        <p className="text-sm text-gray-500">{swimmerName}</p>
      </div>

      <form onSubmit={handleSave} className="px-6 pb-8 space-y-6">

        {/* Basic Information */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-800">&#128100; Basic Information</h2>
          <label className="mb-1 block text-sm text-gray-600">Age</label>
          <input
            type="number"
            value={form.age}
            onChange={(e) => setForm((prev) => ({ ...prev, age: sanitizeNumber(e.target.value) }))}
            min={1}
            max={120}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
          />
        </div>

        {/* Swimmer Conditions */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-800">&#128336; Swimmer Conditions</h2>
          <p className="mb-3 text-xs text-gray-500">Select all that apply. This helps our coaches provide the best support.</p>
          <div className="space-y-2">
            {CONDITION_OPTIONS.map((c) => (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.conditions.includes(c)}
                  onChange={() => toggleCondition(c)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-500 focus:ring-teal-400"
                />
                <span className="text-sm text-gray-700">{c}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sensory Needs */}
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">&#127800; Sensory Needs & Issues</h2>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Describe any sensory sensitivities or preferences</label>
            <textarea
              value={form.sensory_needs}
              onChange={(e) => handleChange("sensory_needs", e.target.value)}
              placeholder="E.g., Sensitive to loud noises, prefers warm water..."
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
              rows={3}
            />
            <p className="mt-0.5 text-right text-xs text-gray-400">{form.sensory_needs.length}/500</p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Additional sensory details</label>
            <textarea
              value={form.sensory_details}
              onChange={(e) => handleChange("sensory_details", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
              rows={3}
            />
            <p className="mt-0.5 text-right text-xs text-gray-400">{form.sensory_details.length}/500</p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Noise Sensitivity (0–10)
            </label>
            <input
              type="number"
              value={form.noise_sensitivity}
              onChange={(e) => setForm((prev) => ({ ...prev, noise_sensitivity: sanitizeNumber(e.target.value) }))}
              min={0}
              max={10}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Touch Tolerance (0–10)
            </label>
            <input
              type="number"
              value={form.touch_tolerance}
              onChange={(e) => setForm((prev) => ({ ...prev, touch_tolerance: sanitizeNumber(e.target.value) }))}
              min={0}
              max={10}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Transition Difficulty (0–10)
            </label>
            <input
              type="number"
              value={form.transition_difficulty}
              onChange={(e) => setForm((prev) => ({ ...prev, transition_difficulty: sanitizeNumber(e.target.value) }))}
              min={0}
              max={10}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Communication & Triggers */}
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">&#128172; Communication & Triggers</h2>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Communication Preference</label>
            <input
              type="text"
              value={form.communication_preference}
              onChange={(e) => handleChange("communication_preference", e.target.value, 200)}
              placeholder="E.g., Visual cues + verbal"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
            <p className="mt-0.5 text-right text-xs text-gray-400">{form.communication_preference.length}/200</p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Known Triggers (comma-separated)</label>
            <textarea
              value={form.known_triggers}
              onChange={(e) => handleChange("known_triggers", e.target.value)}
              placeholder="E.g., Sudden loud noises, crowded pool, water temperature changes"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
              rows={3}
            />
            <p className="mt-0.5 text-right text-xs text-gray-400">{form.known_triggers.length}/500</p>
          </div>
        </div>

        {/* Interests */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-800">&#127775; Interests & Motivations</h2>
          <label className="mb-1 block text-xs text-gray-500">What does your swimmer enjoy?</label>
          <textarea
            value={form.interests}
            onChange={(e) => handleChange("interests", e.target.value)}
            placeholder="E.g., Loves dolphins, enjoys playing with toys, motivated by stickers..."
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            rows={3}
          />
          <p className="mt-0.5 text-right text-xs text-gray-400">{form.interests.length}/500</p>
          <p className="mt-1 text-xs text-gray-400">This helps coaches connect with your child and make lessons more engaging.</p>
        </div>

        {/* Additional Notes */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-800">&#128221; Additional Notes</h2>
          <textarea
            value={form.additional_notes}
            onChange={(e) => handleChange("additional_notes", e.target.value)}
            placeholder="Any other information coaches should know..."
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            rows={3}
          />
          <p className="mt-0.5 text-right text-xs text-gray-400">{form.additional_notes.length}/500</p>
        </div>

        {/* Consent */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.consent_given}
            onChange={(e) => setForm((prev) => ({ ...prev, consent_given: e.target.checked }))}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-500 focus:ring-teal-400"
          />
          <span className="text-xs text-gray-600">
            I consent to this information being used to create a supportive, personalised learning experience for {swimmerName}.
          </span>
        </label>

        {/* Errors & Success */}
        {saveError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {saveError}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-700">
            Profile saved successfully!
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/swimmer/dashboard"
            className="flex-1 rounded-lg border border-gray-200 py-3 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}