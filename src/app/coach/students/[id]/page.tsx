"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Tab = "progress" | "reflections" | "sensory" | "milestones";
type SkillStatus = "not_started" | "emerging" | "mastered";

const SKILL_CATEGORIES = [
  {
    name: "Water Familiarisation",
    description: "Building comfort and confidence in water",
    skills: ["Blows bubbles for 3 seconds", "Submerges face independently", "Opens eyes underwater"],
  },
  {
    name: "Body Control & Safety",
    description: "Learning water safety and body awareness",
    skills: ["Back float 10 seconds", "Responds to 'Stop' cue", "Rolls from front to back"],
  },
  {
    name: "Stroke Foundations",
    description: "Developing basic swimming techniques",
    skills: ["Kicks 5m with board", "Front glide 3 seconds", "Arm pull with float"],
  },
  {
    name: "Emotional & Sensory Regulation",
    description: "Managing emotions and sensory responses in water",
    skills: ["Recovers from distress within 2 minutes", "Uses calming strategy when anxious", "Accepts water on face"],
  },
];

interface Student {
  id: string;
  full_name: string;
  age: number | null;
  level: number | null;
  category: string | null;
}

interface SkillRow {
  skill_name: string;
  status: SkillStatus;
  category: string;
}

interface Reflection {
  id: string;
  coach_notes: string | null;
  parent_feedback: string | null;
  mood: string | null;
  created_at: string;
}

interface SensoryProfile {
  conditions: string[];
  sensory_needs: string | null;
  noise_sensitivity: number | null;
  touch_tolerance: number | null;
  transition_difficulty: number | null;
  communication_preference: string | null;
  known_triggers: string[];
  additional_notes: string | null;
}

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  achieved_on: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Progress Tab ─────────────────────────────────────────────
// Coaches update skill status here — this is the only place skill_progress gets written.
function ProgressTab({
  swimmerId,
  skills,
  onSkillUpdate,
}: {
  swimmerId: string;
  skills: SkillRow[];
  onSkillUpdate: (skillName: string, status: SkillStatus) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const handleStatusChange = async (skillName: string, category: string, newStatus: SkillStatus) => {
    setSaving(skillName);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from("skill_progress")
      .upsert({
        swimmer_id: swimmerId,
        category,
        skill_name: skillName,
        status: newStatus,
        updated_by: user!.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "swimmer_id,skill_name" });

    onSkillUpdate(skillName, newStatus);
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      {SKILL_CATEGORIES.map((cat) => {
        const catSkills = cat.skills.map((s) => ({
          name: s,
          status: skills.find((r) => r.skill_name === s)?.status ?? "not_started",
        }));
        const mastered = catSkills.filter((s) => s.status === "mastered").length;
        const pct = Math.round((mastered / catSkills.length) * 100);

        return (
          <div key={cat.name} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                <p className="text-xs text-gray-500">{cat.description}</p>
              </div>
              <span className="text-sm font-medium text-gray-600">{pct}%</span>
            </div>
            <div className="mb-4 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-teal-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="space-y-2">
              {catSkills.map((skill) => (
                <div key={skill.name} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 flex-1">{skill.name}</span>
                  <select
                    value={skill.status}
                    disabled={saving === skill.name}
                    onChange={(e) => handleStatusChange(skill.name, cat.name, e.target.value as SkillStatus)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none ${
                      skill.status === "mastered"
                        ? "bg-teal-100 text-teal-700"
                        : skill.status === "emerging"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <option value="not_started">Not started</option>
                    <option value="emerging">Emerging</option>
                    <option value="mastered">Mastered</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Reflections Tab ──────────────────────────────────────────
// Reflections attach to a completed session (scheduled + marked completed from the coach dashboard).
function ReflectionsTab({ reflections, swimmerId }: { reflections: Reflection[]; swimmerId: string }) {
  return (
    <div>
      <Link
        href={`/coach/students/${swimmerId}/reflection/new`}
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
                {r.parent_feedback ? (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Parent Feedback</h4>
                    <p className="text-sm text-gray-700">{r.parent_feedback}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No parent feedback yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sensory Tab ──────────────────────────────────────────────
function SensoryTab({ profile }: { profile: SensoryProfile | null }) {
  if (!profile) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">No sensory profile filled in yet.</p>
        <p className="mt-1 text-xs text-gray-400">The caregiver can fill this in from the swimmer profile page.</p>
      </div>
    );
  }

  const scales = [
    { label: "Noise Sensitivity", value: profile.noise_sensitivity },
    { label: "Touch Tolerance", value: profile.touch_tolerance },
    { label: "Transition Difficulty", value: profile.transition_difficulty },
  ];

  const overallLevel = (() => {
    const vals = scales.map((s) => s.value ?? 0);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg >= 7) return { label: "HIGH", cls: "bg-red-100 text-red-700" };
    if (avg >= 4) return { label: "MODERATE", cls: "bg-amber-100 text-amber-700" };
    return { label: "LOW", cls: "bg-teal-100 text-teal-700" };
  })();

  return (
    <div className="space-y-4">
      {/* Conditions */}
      {profile.conditions.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-medium text-gray-800">Conditions</h3>
          <div className="flex flex-wrap gap-2">
            {profile.conditions.map((c) => (
              <span key={c} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Sensory level summary */}
      <div className="rounded-xl bg-white p-4 shadow-sm flex items-center justify-between">
        <p className="text-sm text-gray-700">Overall sensory consideration</p>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${overallLevel.cls}`}>{overallLevel.label}</span>
      </div>

      {/* Scale bars */}
      {scales.map((item) => (
        <div key={item.label} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-medium text-gray-800">{item.label}</h3>
            <span className="text-sm text-gray-600">{item.value ?? "—"}/10</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-amber-400 transition-all"
              style={{ width: `${((item.value ?? 0) / 10) * 100}%` }}
            />
          </div>
        </div>
      ))}

      {profile.communication_preference && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-1 font-medium text-gray-800">Communication Preference</h3>
          <p className="text-sm text-gray-600">{profile.communication_preference}</p>
        </div>
      )}

      {profile.known_triggers.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-medium text-gray-800">Known Triggers</h3>
          <ul className="space-y-1">
            {profile.known_triggers.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-teal-500">✓</span> {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.sensory_needs && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-1 font-medium text-gray-800">Sensory Needs</h3>
          <p className="text-sm text-gray-600">{profile.sensory_needs}</p>
        </div>
      )}

      {profile.additional_notes && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-1 font-medium text-gray-800">Additional Notes</h3>
          <p className="text-sm text-gray-600">{profile.additional_notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Milestones Tab ───────────────────────────────────────────
// Coaches record milestones here — this is the only place milestones get written.
function MilestonesTab({
  swimmerId,
  milestones,
  onAdd,
}: {
  swimmerId: string;
  milestones: Milestone[];
  onAdd: (m: Milestone) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(SKILL_CATEGORIES[0].name);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", user!.id)
      .single();

    const { data: milestone } = await supabase
      .from("milestones")
      .insert({
        swimmer_id: swimmerId,
        club_id: profile?.club_id,
        recorded_by: user!.id,
        title,
        description,
        category,
        achieved_on: date,
      })
      .select()
      .single();

    if (milestone) onAdd(milestone as Milestone);
    setTitle(""); setDescription(""); setShowForm(false);
    setSaving(false);
  };

  return (
    <div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="mb-4 w-full rounded-lg bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition"
        >
          + Record Milestone
        </button>
      ) : (
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800">New Milestone</h3>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. First independent back float"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            >
              {SKILL_CATEGORIES.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Date Achieved</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit} disabled={saving || !title.trim()} className="flex-1 rounded-lg bg-teal-500 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60 transition">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {milestones.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">No milestones recorded yet.</p>
      ) : (
        <>
          <div className="mb-4 rounded-xl bg-teal-50 p-4">
            <p className="text-sm font-medium text-teal-800">🏆 {milestones.length} Milestone{milestones.length !== 1 ? "s" : ""} Achieved</p>
            <p className="text-xs text-gray-500">Celebrating progress along the journey</p>
          </div>
          <div className="relative space-y-6 border-l-2 border-teal-200 pl-6">
            {milestones.map((m) => (
              <div key={m.id} className="relative">
                <div className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-teal-500" />
                <h3 className="font-medium text-gray-800">{m.title}</h3>
                <p className="text-xs text-gray-500">
                  {formatDate(m.achieved_on)}
                  {m.category && <span className="ml-2 text-gray-400">· {m.category}</span>}
                </p>
                {m.description && <p className="mt-1 text-sm text-gray-600">{m.description}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function StudentProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const swimmerId = params.id as string;

  const defaultTab = (searchParams.get("tab") as Tab) ?? "progress";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const [student, setStudent] = useState<Student | null>(null);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [sensory, setSensory] = useState<SensoryProfile | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const [
        { data: profile, error: profileError },
        { data: skillRows },
        { data: reflRows },
        { data: sensoryRow },
        { data: milestoneRows },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, swimmers(age, level, category)")
          .eq("id", swimmerId)
          .single(),
        supabase
          .from("skill_progress")
          .select("skill_name, status, category")
          .eq("swimmer_id", swimmerId),
        supabase
          .from("session_reflections")
          .select("id, coach_notes, parent_feedback, mood, created_at")
          .eq("swimmer_id", swimmerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("swimmer_profiles")
          .select("conditions, sensory_needs, noise_sensitivity, touch_tolerance, transition_difficulty, communication_preference, known_triggers, additional_notes")
          .eq("swimmer_id", swimmerId)
          .single(),
        supabase
          .from("milestones")
          .select("id, title, description, category, achieved_on")
          .eq("swimmer_id", swimmerId)
          .order("achieved_on", { ascending: false }),
      ]);

      if (profileError || !profile) throw new Error("Failed to load student.");

      const rawSwimmers = (
        profile as {
          swimmers:
            | { age: number | null; level: number | null; category: string | null }
            | { age: number | null; level: number | null; category: string | null }[]
            | null;
        }
      ).swimmers;
      const sw = Array.isArray(rawSwimmers) ? rawSwimmers[0] : rawSwimmers;
      setStudent({
        id: profile.id,
        full_name: profile.full_name ?? "Unknown",
        age: sw?.age ?? null,
        level: sw?.level ?? null,
        category: sw?.category ?? null,
      });

      setSkills((skillRows ?? []) as SkillRow[]);
      setReflections((reflRows ?? []) as Reflection[]);
      setSensory((sensoryRow ?? null) as SensoryProfile | null);
      setMilestones((milestoneRows ?? []) as Milestone[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [swimmerId]);

  useEffect(() => {
    if (swimmerId) load();
  }, [swimmerId, load]);

  const handleSkillUpdate = (skillName: string, status: SkillStatus) => {
    setSkills((prev) => {
      const existing = prev.find((s) => s.skill_name === skillName);
      if (existing) return prev.map((s) => s.skill_name === skillName ? { ...s, status } : s);
      const cat = SKILL_CATEGORIES.find((c) => c.skills.includes(skillName))?.name ?? "";
      return [...prev, { skill_name: skillName, status, category: cat }];
    });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "progress", label: "Progress" },
    { key: "reflections", label: "Reflections" },
    { key: "sensory", label: "Sensory" },
    { key: "milestones", label: "Milestones" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="space-y-3">
          <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
        </div>
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
      <Link href="/coach/students" className="mb-4 inline-block text-gray-400 hover:text-gray-600">&larr;</Link>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-xl font-bold text-teal-700">
          {student.full_name[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">{student.full_name}</h1>
          <p className="text-sm text-gray-500">
            {[student.age ? `Age ${student.age}` : null, student.level ? `Level ${student.level}` : null]
              .filter(Boolean).join(" · ")}
          </p>
          {student.category && <p className="text-xs text-gray-400">{student.category}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
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
        <ProgressTab swimmerId={swimmerId} skills={skills} onSkillUpdate={handleSkillUpdate} />
      )}
      {activeTab === "reflections" && (
        <ReflectionsTab reflections={reflections} swimmerId={swimmerId} />
      )}
      {activeTab === "sensory" && <SensoryTab profile={sensory} />}
      {activeTab === "milestones" && (
        <MilestonesTab
          swimmerId={swimmerId}
          milestones={milestones}
          onAdd={(m) => setMilestones((prev) => [m, ...prev])}
        />
      )}
    </div>
  );
}
