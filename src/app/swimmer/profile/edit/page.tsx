use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import SwimmerHeader from "@/app/swimmer/components/SwimmerHeader";

interface PersonalDetails {
  date_of_birth: string;
  gender: string;
  address: string;
  postal_code: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  emergency_contact_relationship: string;
  medical_conditions: string;
  allergies: string;
  medications: string;
  additional_medical_notes: string;
}

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

function sanitize(value: string, maxLength = 500): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .slice(0, maxLength);
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
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails>({
    date_of_birth: "",
    gender: "",
    address: "",
    postal_code: "",
    emergency_contact_name: "",
    emergency_contact_number: "",
    emergency_contact_relationship: "",
    medical_conditions: "",
    allergies: "",
    medications: "",
    additional_medical_notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [coachRequest, setCoachRequest] = useState<{
    id: string;
    status: string;
    message: string | null;
    qualifications: string | null;
    experience: string | null;
    certifications: string | null;
  } | null>(null);
  const [requestForm, setRequestForm] = useState({
    message: "",
    qualifications: "",
    experience: "",
    certifications: "",
  });
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const router = useRouter();

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

      // Fetch existing coach request
      const { data: requestData } = await supabase
        .from("coach_requests")
        .select("id, status, message, qualifications, experience, certifications")
        .eq("swimmer_id", targetSwimmerId)
        .single();

      if (requestData) {
        setCoachRequest(requestData);
        setRequestForm({
          message: requestData.message ?? "",
          qualifications: requestData.qualifications ?? "",
          experience: requestData.experience ?? "",
          certifications: requestData.certifications ?? "",
        });
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", targetSwimmerId)
        .single();

      setSwimmerName(profileData?.full_name ?? "Swimmer");

      const { data: swimmerData } = await supabase
        .from("swimmers")
        .select("age")
        .eq("id", targetSwimmerId)
        .single();

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

      // Fetch personal details
      const { data: personalData } = await supabase
        .from("swimmer_personal_details")
        .select("*")
        .eq("swimmer_id", targetSwimmerId)
        .single();

      if (personalData) {
        setPersonalDetails({
          date_of_birth: personalData.date_of_birth ?? "",
          gender: personalData.gender ?? "",
          address: personalData.address ?? "",
          postal_code: personalData.postal_code ?? "",
          emergency_contact_name: personalData.emergency_contact_name ?? "",
          emergency_contact_number: personalData.emergency_contact_number ?? "",
          emergency_contact_relationship: personalData.emergency_contact_relationship ?? "",
          medical_conditions: personalData.medical_conditions ?? "",
          allergies: personalData.allergies ?? "",
          medications: personalData.medications ?? "",
          additional_medical_notes: personalData.additional_medical_notes ?? "",
        });
      }

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

  const handleChange = (field: keyof FormData, value: string, maxLength = 500) => {
    setForm((prev) => ({
      ...prev,
      [field]: sanitize(value, maxLength),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swimmerId) return;

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
      if (form.age) {
        const { error: swimmerError } = await supabase
          .from("swimmers")
          .update({ age: parseInt(form.age) })
          .eq("id", swimmerId);
        if (swimmerError) throw new Error("Failed to update age.");
      }

      const triggersArray = form.known_triggers
        ? form.known_triggers.split(",").map((t) => sanitize(t.trim(), 100)).filter((t) => t.length > 0)
        : [];

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
        }, { onConflict: "swimmer_id" });

      if (profileError) throw new Error("Failed to save profile: " + profileError.message);

      // Save personal details
      const { error: personalError } = await supabase
        .from("swimmer_personal_details")
        .upsert({
          swimmer_id: swimmerId,
          date_of_birth: personalDetails.date_of_birth || null,
          gender: personalDetails.gender || null,
          address: sanitize(personalDetails.address, 300) || null,
          postal_code: sanitize(personalDetails.postal_code, 20) || null,
          emergency_contact_name: sanitize(personalDetails.emergency_contact_name, 100) || null,
          emergency_contact_number: sanitize(personalDetails.emergency_contact_number, 20) || null,
          emergency_contact_relationship: sanitize(personalDetails.emergency_contact_relationship, 100) || null,
          medical_conditions: sanitize(personalDetails.medical_conditions, 500) || null,
          allergies: sanitize(personalDetails.allergies, 500) || null,
          medications: sanitize(personalDetails.medications, 500) || null,
          additional_medical_notes: sanitize(personalDetails.additional_medical_notes, 500) || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "swimmer_id" });

      if (personalError) throw new Error("Failed to save personal details: " + personalError.message);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);

    if (!requestForm.qualifications.trim()) { setRequestError("Please enter your qualifications."); return; }
    if (!requestForm.experience.trim()) { setRequestError("Please enter your experience."); return; }
    if (!requestForm.certifications.trim()) { setRequestError("Please enter your certifications."); return; }

    setRequestSaving(true);
    const supabase = createClient();

    try {
      if (coachRequest) {
        const { error } = await supabase
          .from("coach_requests")
          .update({
            message: requestForm.message || null,
            qualifications: requestForm.qualifications.trim(),
            experience: requestForm.experience.trim(),
            certifications: requestForm.certifications.trim(),
            status: "pending",
          })
          .eq("id", coachRequest.id);
        if (error) throw new Error("Failed to update request.");
      } else {
        const { error } = await supabase
          .from("coach_requests")
          .insert({
            swimmer_id: swimmerId,
            message: requestForm.message || null,
            qualifications: requestForm.qualifications.trim(),
            experience: requestForm.experience.trim(),
            certifications: requestForm.certifications.trim(),
            status: "pending",
          });
        if (error) throw new Error("Failed to submit request.");
      }

      setRequestSuccess("Your coach application has been submitted successfully.");
      await fetchProfile();
    } catch (err: any) {
      setRequestError(err.message);
    } finally {
      setRequestSaving(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!coachRequest) return;
    setRequestSaving(true);
    setRequestError(null);

    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("coach_requests")
        .delete()
        .eq("id", coachRequest.id);
      if (error) throw new Error("Failed to cancel request.");

      setCoachRequest(null);
      setRequestForm({ message: "", qualifications: "", experience: "", certifications: "" });
      setShowCancelConfirm(false);
      setRequestSuccess("Your coach application has been cancelled.");
    } catch (err: any) {
      setRequestError(err.message);
    } finally {
      setRequestSaving(false);
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
      <SwimmerHeader />
      <div id="main-content" tabIndex={-1} className="bg-gradient-to-b from-teal-50 to-gray-50 px-6 pt-6 pb-8 text-center">
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

        {/* Personal Details */}
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">&#128196; Personal Details</h2>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Date of Birth</label>
            <input
              type="date"
              value={personalDetails.date_of_birth}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, date_of_birth: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Gender</label>
            <select
              value={personalDetails.gender}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, gender: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
            >
              <option value="">-- Select gender --</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Address</label>
            <textarea
              value={personalDetails.address}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="e.g. 123 Orchard Road, #01-01"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Postal Code</label>
            <input
              type="text"
              value={personalDetails.postal_code}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, postal_code: e.target.value }))}
              placeholder="e.g. 238801"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">&#128222; Emergency Contact</h2>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Contact Name</label>
            <input
              type="text"
              value={personalDetails.emergency_contact_name}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
              placeholder="e.g. Jane Doe"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Contact Number</label>
            <input
              type="tel"
              value={personalDetails.emergency_contact_number}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, emergency_contact_number: e.target.value }))}
              placeholder="e.g. +65 9123 4567"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Relationship</label>
            <input
              type="text"
              value={personalDetails.emergency_contact_relationship}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, emergency_contact_relationship: e.target.value }))}
              placeholder="e.g. Parent, Guardian, Sibling"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Medical Information */}
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">&#127973; Medical Information</h2>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Medical Conditions</label>
            <textarea
              value={personalDetails.medical_conditions}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, medical_conditions: sanitize(e.target.value, 500) }))}
              placeholder="e.g. Asthma, Epilepsy..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
            <p className="mt-0.5 text-right text-xs text-gray-400">{personalDetails.medical_conditions.length}/500</p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Allergies</label>
            <textarea
              value={personalDetails.allergies}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, allergies: sanitize(e.target.value, 500) }))}
              placeholder="e.g. Penicillin, Latex, Peanuts..."
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
            <p className="mt-0.5 text-right text-xs text-gray-400">{personalDetails.allergies.length}/500</p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Current Medications</label>
            <textarea
              value={personalDetails.medications}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, medications: sanitize(e.target.value, 500) }))}
              placeholder="e.g. Ritalin 10mg daily..."
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
            <p className="mt-0.5 text-right text-xs text-gray-400">{personalDetails.medications.length}/500</p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Additional Medical Notes</label>
            <textarea
              value={personalDetails.additional_medical_notes}
              onChange={(e) => setPersonalDetails((prev) => ({ ...prev, additional_medical_notes: sanitize(e.target.value, 500) }))}
              placeholder="Any other medical information coaches should know..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
            <p className="mt-0.5 text-right text-xs text-gray-400">{personalDetails.additional_medical_notes.length}/500</p>
          </div>
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
            <label className="mb-1 block text-xs text-gray-500">Noise Sensitivity (0–10)</label>
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
            <label className="mb-1 block text-xs text-gray-500">Touch Tolerance (0–10)</label>
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
            <label className="mb-1 block text-xs text-gray-500">Transition Difficulty (0–10)</label>
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

        {/* Coach Application Section */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-800">&#127941; Are you a Coach?</h2>
          <p className="mb-4 text-xs text-gray-500">
            Fill in your details below and submit an application to your club admin.
          </p>

          {coachRequest && (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${
              coachRequest.status === "pending" ? "bg-amber-50 text-amber-700" :
              coachRequest.status === "approved" ? "bg-teal-50 text-teal-700" :
              "bg-red-50 text-red-600"
            }`}>
              {coachRequest.status === "pending" && "Your application is pending review by the admin."}
              {coachRequest.status === "approved" && "Your application has been approved!"}
              {coachRequest.status === "rejected" && "Your application was not approved. You may update and resubmit."}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Qualifications <span className="text-red-400">*</span>
              </label>
              <textarea
                value={requestForm.qualifications}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, qualifications: sanitize(e.target.value, 500) }))}
                placeholder="e.g. Bachelor of Sports Science, Swimming Level 2 Instructor..."
                rows={3}
                disabled={coachRequest?.status === "pending"}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              <p className="mt-0.5 text-right text-xs text-gray-400">{requestForm.qualifications.length}/500</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Experience <span className="text-red-400">*</span>
              </label>
              <textarea
                value={requestForm.experience}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, experience: sanitize(e.target.value, 500) }))}
                placeholder="e.g. 3 years coaching children with special needs at a community pool..."
                rows={3}
                disabled={coachRequest?.status === "pending"}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              <p className="mt-0.5 text-right text-xs text-gray-400">{requestForm.experience.length}/500</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Certifications <span className="text-red-400">*</span>
              </label>
              <textarea
                value={requestForm.certifications}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, certifications: sanitize(e.target.value, 500) }))}
                placeholder="e.g. Singapore Swimming Association Level 1, First Aid Certified..."
                rows={3}
                disabled={coachRequest?.status === "pending"}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              <p className="mt-0.5 text-right text-xs text-gray-400">{requestForm.certifications.length}/500</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Additional Message <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={requestForm.message}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, message: sanitize(e.target.value, 500) }))}
                placeholder="Anything else you'd like the admin to know..."
                rows={2}
                disabled={coachRequest?.status === "pending"}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {requestError && <p className="text-sm text-red-500">{requestError}</p>}
            {requestSuccess && <p className="text-sm text-teal-600">{requestSuccess}</p>}

            <div className="flex gap-3">
              {coachRequest && (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={requestSaving}
                  className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition disabled:opacity-60"
                >
                  Cancel Application
                </button>
              )}
              {coachRequest?.status !== "pending" && (
                <button
                  type="button"
                  onClick={handleRequestSubmit}
                  disabled={requestSaving}
                  className="flex-1 rounded-lg bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
                >
                  {requestSaving ? "Submitting..." : coachRequest ? "Resubmit Application" : "Submit Application"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cancel Confirm Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
              <h2 className="mb-2 font-semibold text-gray-800">Cancel Application</h2>
              <p className="mb-6 text-sm text-gray-500">
                Are you sure you want to cancel your coach application? You can reapply at any time.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Keep Application
                </button>
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  disabled={requestSaving}
                  className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition disabled:opacity-60"
                >
                  {requestSaving ? "Cancelling..." : "Yes, Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

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

        <button
          type="button"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="mt-4 w-full rounded-lg border border-red-200 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition"
        >
          Log Out
        </button>
      </form>
    </div>
  );
}