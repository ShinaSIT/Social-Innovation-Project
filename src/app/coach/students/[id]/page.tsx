"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Tab = "progress" | "reflections" | "sensory" | "milestones" | "personal";
type SkillStatus = "not_started" | "emerging" | "mastered";

interface Student {
  id: string;
  full_name: string;
  age: number | null;
  level: number | null;
  category: string | null;
}

interface SkillProgress {
  id: string;
  category: string;
  skill_name: string;
  status: SkillStatus;
}

interface Reflection {
  id: string;
  coach_notes: string | null;
  parent_feedback: string | null;
  mood: string | null;
  created_at: string;
}

interface SensoryProfile {
  noise_sensitivity: number | null;
  touch_tolerance: number | null;
  transition_difficulty: number | null;
  communication_preference: string | null;
  known_triggers: string[];
  additional_notes: string | null;
  sensory_needs: string | null;
}

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  achieved_on: string;
  category: string | null;
}

interface PersonalDetails {
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  postal_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
  emergency_contact_relationship: string | null;
  medical_conditions: string | null;
  allergies: string | null;
  medications: string | null;
  additional_medical_notes: string | null;
}

interface TierUpgrade {
  currentTier: string;
  currentStage: number;
  nextTier: string;
  nextStage: number;
  newSkills: { category: string; skill_name: string }[];
}

// Tier progression map
const TIER_PROGRESSION: Record<string, { tier: string; stage: number } | null> = {
  "Total Beginner-1": { tier: "Total Beginner", stage: 2 },
  "Total Beginner-2": { tier: "Beginner", stage: 1 },
  "Beginner-1": { tier: "Beginner", stage: 2 },
  "Beginner-2": { tier: "Beginner", stage: 3 },
  "Beginner-3": { tier: "Intermediate", stage: 1 },
  "Intermediate-1": { tier: "Intermediate", stage: 2 },
  "Intermediate-2": { tier: "Intermediate", stage: 3 },
  "Intermediate-3": { tier: "Advance", stage: 1 },
  "Advance-1": { tier: "Advance", stage: 2 },
  "Advance-2": { tier: "Advance", stage: 3 },
  "Advance-3": null,
};

function groupSkillsByCategory(skills: SkillProgress[]) {
  const map: Record<string, SkillProgress[]> = {};
  for (const skill of skills) {
    if (!map[skill.category]) map[skill.category] = [];
    map[skill.category].push(skill);
  }
  return Object.entries(map).map(([category, skills]) => {
    const mastered = skills.filter((s) => s.status === "mastered").length;
    const progress = skills.length > 0 ? Math.round((mastered / skills.length) * 100) : 0;
    return { category, skills, progress };
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function formatDob(dob: string | null) {
  if (!dob) return "—";
  return new Date(dob).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function formatGender(gender: string | null) {
  if (!gender) return "—";
  const map: Record<string, string> = {
    male: "Male", female: "Female",
    non_binary: "Non-binary", prefer_not_to_say: "Prefer not to say",
  };
  return map[gender] ?? gender;
}

function statusColor(status: SkillStatus) {
  if (status === "mastered") return "bg-teal-100 text-teal-700";
  if (status === "emerging") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-500";
}

function ProgressTab({
  skills,
  onUpdateSkill,
  updating,
}: {
  skills: SkillProgress[];
  onUpdateSkill: (skillId: string, newStatus: SkillStatus) => Promise<void>;
  updating: string | null;
}) {
  const categories = groupSkillsByCategory(skills);

  if (categories.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No skill data available.</p>;
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <div key={cat.category} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">{cat.category}</h3>
            <span className="text-sm font-medium text-gray-600">{cat.progress}%</span>
          </div>
          <div className="mb-4 h-2 w-full rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-teal-400" style={{ width: `${cat.progress}%` }} />
          </div>
          <div className="space-y-3">
            {cat.skills.map((skill) => (
              <div key={skill.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 flex-1">{skill.skill_name}</span>
                <select
                  value={skill.status}
                  disabled={updating === skill.id}
                  onChange={(e) => onUpdateSkill(skill.id, e.target.value as SkillStatus)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-400 ${statusColor(skill.status)} ${updating === skill.id ? "opacity-50" : ""}`}
                >
                  <option value="not_started">Not Started</option>
                  <option value="emerging">Emerging</option>
                  <option value="mastered">Mastered</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReflectionsTab({ reflections, studentId }: { reflections: Reflection[]; studentId: string }) {
  return (
    <div>
      <Link
        href={`/coach/students/${studentId}/reflection/new`}
        className="mb-4 block w-full rounded-lg bg-teal-500 py-2.5 text-center text-sm font-medium text-white hover:bg-teal-600 transition"
      >
        + Add New Reflection
      </Link>
      {reflections.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No reflections yet.</p>
      ) : (
        <div className="space-y-6">
          {reflections.map((r) => (
            <div key={r.id}>
              <p className="mb-2 text-sm font-medium text-gray-500">{formatDate(r.created_at)}</p>
              <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
                {r.mood && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Mood</h4>
                    <p className="text-sm text-gray-700 capitalize">{r.mood}</p>
                  </div>
                )}
                {r.coach_notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Coach Notes</h4>
                    <p className="text-sm text-gray-700">{r.coach_notes}</p>
                  </div>
                )}
                {r.parent_feedback && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Parent Feedback</h4>
                    <p className="text-sm text-gray-700">{r.parent_feedback}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SensoryTab({ profile }: { profile: SensoryProfile | null }) {
  if (!profile) {
    return <p className="text-sm text-gray-500 text-center py-8">No sensory profile available.</p>;
  }
  const bars = [
    { label: "Noise Sensitivity", level: profile.noise_sensitivity },
    { label: "Touch Tolerance", level: profile.touch_tolerance },
    { label: "Transition Difficulty", level: profile.transition_difficulty },
  ];
  return (
    <div className="space-y-4">
      {bars.map((item) => (
        <div key={item.label} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-medium text-gray-800">{item.label}</h3>
            <span className="text-sm text-gray-600">{item.level ?? "N/A"}/10</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-amber-400" style={{ width: `${((item.level ?? 0) / 10) * 100}%` }} />
          </div>
        </div>
      ))}
      {profile.communication_preference && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-1 font-medium text-gray-800">Communication Preference</h3>
          <p className="text-sm text-gray-600">{profile.communication_preference}</p>
        </div>
      )}
      {profile.known_triggers?.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-medium text-gray-800">Known Triggers</h3>
          <ul className="space-y-1">
            {profile.known_triggers.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-teal-500">&#10003;</span> {t}
              </li>
            ))}
          </ul>
        </div>
      )}
      {profile.additional_notes && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-medium text-gray-800">Additional Notes</h3>
          <p className="text-sm text-gray-600">{profile.additional_notes}</p>
        </div>
      )}
    </div>
  );
}

function MilestonesTab({ milestones }: { milestones: Milestone[] }) {
  return (
    <div>
      <div className="mb-4 rounded-xl bg-teal-50 p-4">
        <p className="text-sm font-medium text-teal-800">&#127942; {milestones.length} Milestones Achieved</p>
        <p className="text-xs text-gray-500">Celebrating progress along the journey</p>
      </div>
      {milestones.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No milestones yet.</p>
      ) : (
        <div className="relative space-y-6 border-l-2 border-teal-200 pl-6">
          {milestones.map((m) => (
            <div key={m.id} className="relative">
              <div className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-teal-500" />
              <h3 className="font-medium text-gray-800">{m.title}</h3>
              <p className="text-xs text-gray-500">{formatDate(m.achieved_on)}</p>
              {m.description && <p className="mt-1 text-sm text-gray-600">{m.description}</p>}
              {m.category && <span className="mt-1 inline-block text-xs text-teal-600">{m.category}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonalTab({ details }: { details: PersonalDetails | null }) {
  if (!details) {
    return <p className="text-sm text-gray-500 text-center py-8">No personal details available.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-800">&#128100; Personal Details</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">Date of Birth</p>
            <p className="text-sm font-medium text-gray-800">{formatDob(details.date_of_birth)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Gender</p>
            <p className="text-sm font-medium text-gray-800">{formatGender(details.gender)}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500">Address</p>
          <p className="text-sm font-medium text-gray-800">
            {details.address ?? "—"}{details.postal_code ? ` S(${details.postal_code})` : ""}
          </p>
        </div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-800">&#128222; Emergency Contact</h3>
        <div>
          <p className="text-xs text-gray-500">Name</p>
          <p className="text-sm font-medium text-gray-800">{details.emergency_contact_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Number</p>
          <p className="text-sm font-medium text-gray-800">{details.emergency_contact_number ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Relationship</p>
          <p className="text-sm font-medium text-gray-800">{details.emergency_contact_relationship ?? "—"}</p>
        </div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-800">&#127973; Medical Information</h3>
        <div>
          <p className="text-xs text-gray-500">Medical Conditions</p>
          <p className="text-sm text-gray-700">{details.medical_conditions ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Allergies</p>
          <p className="text-sm text-gray-700">{details.allergies ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Current Medications</p>
          <p className="text-sm text-gray-700">{details.medications ?? "—"}</p>
        </div>
        {details.additional_medical_notes && (
          <div>
            <p className="text-xs text-gray-500">Additional Notes</p>
            <p className="text-sm text-gray-700">{details.additional_medical_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentProfilePage() {
  const params = useParams();
  const studentId = params.id as string;

  const [activeTab, setActiveTab] = useState<Tab>("progress");
  const [student, setStudent] = useState<Student | null>(null);
  const [skills, setSkills] = useState<SkillProgress[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [sensoryProfile, setSensoryProfile] = useState<SensoryProfile | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingSkill, setUpdatingSkill] = useState<string | null>(null);
  const [tierUpgrade, setTierUpgrade] = useState<TierUpgrade | null>(null);
  const [applyingUpgrade, setApplyingUpgrade] = useState(false);

  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", studentId)
        .single();

      const { data: swimmerData, error: swimmerError } = await supabase
        .from("swimmers")
        .select("age, level, category")
        .eq("id", studentId)
        .single();

      if (profileError || swimmerError) throw new Error("Failed to load student.");

      setStudent({
        id: profileData.id,
        full_name: profileData.full_name ?? "Unknown",
        age: swimmerData?.age ?? null,
        level: swimmerData?.level ?? null,
        category: swimmerData?.category ?? null,
      });

      const { data: skillsData } = await supabase
        .from("skill_progress")
        .select("id, category, skill_name, status")
        .eq("swimmer_id", studentId);

      setSkills(skillsData ?? []);

      const { data: reflectionsData } = await supabase
        .from("session_reflections")
        .select("id, coach_notes, parent_feedback, mood, created_at")
        .eq("swimmer_id", studentId)
        .order("created_at", { ascending: false });

      setReflections(reflectionsData ?? []);

      const { data: sensoryData } = await supabase
        .from("swimmer_profiles")
        .select("noise_sensitivity, touch_tolerance, transition_difficulty, communication_preference, known_triggers, additional_notes, sensory_needs")
        .eq("swimmer_id", studentId)
        .single();

      setSensoryProfile(sensoryData ?? null);

      const { data: milestonesData } = await supabase
        .from("milestones")
        .select("id, title, description, achieved_on, category")
        .eq("swimmer_id", studentId)
        .order("achieved_on", { ascending: false });

      setMilestones(milestonesData ?? []);

      const { data: personalData } = await supabase
        .from("swimmer_personal_details")
        .select("date_of_birth, gender, address, postal_code, emergency_contact_name, emergency_contact_number, emergency_contact_relationship, medical_conditions, allergies, medications, additional_medical_notes")
        .eq("swimmer_id", studentId)
        .single();

      setPersonalDetails(personalData ?? null);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) fetchAll();
  }, [studentId, fetchAll]);

  const checkTierUpgrade = async (updatedSkills: SkillProgress[], currentStudent: Student) => {
    const supabase = createClient();
    const allMastered = updatedSkills.every((s) => s.status === "mastered");
    if (!allMastered) return;

    const tier = currentStudent.category;
    const stage = currentStudent.level;
    if (!tier || !stage) return;

    const key = `${tier}-${stage}`;
    const next = TIER_PROGRESSION[key];
    if (!next) return;

    // Fetch next tier skills from curriculum
    const { data: nextSkills } = await supabase
      .from("swim_curriculum")
      .select("category, skill_name")
      .eq("tier", next.tier)
      .eq("stage", next.stage)
      .order("order_index");

    if (!nextSkills || nextSkills.length === 0) return;

    setTierUpgrade({
      currentTier: tier,
      currentStage: stage,
      nextTier: next.tier,
      nextStage: next.stage,
      newSkills: nextSkills,
    });
  };

  const handleUpdateSkill = async (skillId: string, newStatus: SkillStatus) => {
    setUpdatingSkill(skillId);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("skill_progress")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", skillId);

      if (error) throw new Error("Failed to update skill.");

      const updatedSkills = skills.map((s) =>
        s.id === skillId ? { ...s, status: newStatus } : s
      );
      setSkills(updatedSkills);

      if (student) await checkTierUpgrade(updatedSkills, student);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingSkill(null);
    }
  };

  const handleApplyUpgrade = async () => {
    if (!tierUpgrade || !student) return;
    setApplyingUpgrade(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Update swimmer's tier and stage
      const { error: swimmerError } = await supabase
        .from("swimmers")
        .update({
          category: tierUpgrade.nextTier,
          level: tierUpgrade.nextStage,
        })
        .eq("id", studentId);

      if (swimmerError) throw new Error("Failed to update swimmer tier.");

      // 2. Delete old skills
      await supabase
        .from("skill_progress")
        .delete()
        .eq("swimmer_id", studentId);

      // 3. Insert new tier's skills
      const newSkillRows = tierUpgrade.newSkills.map((s) => ({
        swimmer_id: studentId,
        category: s.category,
        skill_name: s.skill_name,
        status: "not_started" as SkillStatus,
        updated_by: user?.id,
      }));

      const { error: insertError } = await supabase
        .from("skill_progress")
        .insert(newSkillRows);

      if (insertError) throw new Error("Failed to insert new skills.");

      // 4. Add a milestone for the tier upgrade
      await supabase
        .from("milestones")
        .insert({
          swimmer_id: studentId,
          club_id: (await supabase.from("swimmers").select("club_id").eq("id", studentId).single()).data?.club_id,
          recorded_by: user?.id,
          title: `Graduated to ${tierUpgrade.nextTier} Stage ${tierUpgrade.nextStage}`,
          description: `Successfully mastered all skills in ${tierUpgrade.currentTier} Stage ${tierUpgrade.currentStage} and advanced to the next level.`,
          category: "Tier Progression",
          achieved_on: new Date().toISOString().split("T")[0],
        });

      // 5. Send notification to swimmer
      const { data: swimmerProfile } = await supabase
        .from("swimmers")
        .select("club_id")
        .eq("id", studentId)
        .single();

      await supabase
        .from("notifications")
        .insert({
          club_id: swimmerProfile?.club_id,
          created_by: user?.id,
          title: "&#127942; You've moved up a level!",
          message: `Congratulations! You have mastered all skills in ${tierUpgrade.currentTier} Stage ${tierUpgrade.currentStage} and have been promoted to ${tierUpgrade.nextTier} Stage ${tierUpgrade.nextStage}. Keep up the great work!`,
          type: "announcement",
          target_user_id: studentId,
          target_role: null,
        });

      setTierUpgrade(null);
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApplyingUpgrade(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "progress", label: "Progress" },
    { key: "reflections", label: "Reflections" },
    { key: "sensory", label: "Sensory" },
    { key: "milestones", label: "Milestones" },
    { key: "personal", label: "Personal" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading student profile...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error ?? "Student not found."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Tier Upgrade Modal */}
      {tierUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="rounded-t-xl bg-teal-50 p-4 text-center">
              <p className="text-3xl mb-2">&#127942;</p>
              <h2 className="text-lg font-bold text-teal-800">Tier Upgrade Ready!</h2>
              <p className="text-sm text-teal-600">
                {student.full_name} has mastered all skills in {tierUpgrade.currentTier} Stage {tierUpgrade.currentStage}
              </p>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="rounded-lg bg-gray-100 px-4 py-2 text-center">
                  <p className="text-xs text-gray-500">Current</p>
                  <p className="text-sm font-semibold text-gray-800">{tierUpgrade.currentTier}</p>
                  <p className="text-xs text-gray-500">Stage {tierUpgrade.currentStage}</p>
                </div>
                <span className="text-2xl text-teal-500">&#8594;</span>
                <div className="rounded-lg bg-teal-100 px-4 py-2 text-center">
                  <p className="text-xs text-teal-600">Next</p>
                  <p className="text-sm font-semibold text-teal-800">{tierUpgrade.nextTier}</p>
                  <p className="text-xs text-teal-600">Stage {tierUpgrade.nextStage}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">New skills that will be added:</p>
                <div className="max-h-40 overflow-y-auto rounded-lg bg-gray-50 p-3 space-y-1">
                  {tierUpgrade.newSkills.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="text-teal-500">&#43;</span> {s.skill_name}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Approving will upgrade the swimmer's tier, add new skills, record a milestone, and notify the swimmer.
              </p>
            </div>

            <div className="flex gap-3 border-t border-gray-100 p-4">
              <button
                onClick={() => setTierUpgrade(null)}
                className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Not Yet
              </button>
              <button
                onClick={handleApplyUpgrade}
                disabled={applyingUpgrade}
                className="flex-1 rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
              >
                {applyingUpgrade ? "Upgrading..." : "Approve Upgrade"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <Link href="/coach/students" className="mb-4 inline-block text-gray-400 hover:text-gray-600">&larr;</Link>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-xl font-bold text-teal-700">
          {student.full_name[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">{student.full_name}</h1>
          {student.age && (
            <p className="text-sm text-gray-500">
              Age {student.age}{student.level ? ` • Stage ${student.level}` : ""}
            </p>
          )}
          {student.category && (
            <span className="inline-block rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">
              {student.category}
            </span>
          )}
        </div>
      </div>

      {/* Action links */}
      <div className="mb-6 flex gap-4 text-sm">
        <button className="flex items-center gap-1 text-gray-500 hover:text-teal-600">&#128200; Mood Trends</button>
        <button className="flex items-center gap-1 text-gray-500 hover:text-teal-600">&#128221; Lesson Plan</button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex rounded-lg bg-gray-100 p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white text-teal-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "progress" && (
        <ProgressTab
          skills={skills}
          onUpdateSkill={handleUpdateSkill}
          updating={updatingSkill}
        />
      )}
      {activeTab === "reflections" && <ReflectionsTab reflections={reflections} studentId={studentId} />}
      {activeTab === "sensory" && <SensoryTab profile={sensoryProfile} />}
      {activeTab === "milestones" && <MilestonesTab milestones={milestones} />}
      {activeTab === "personal" && <PersonalTab details={personalDetails} />}
    </div>
  );
}