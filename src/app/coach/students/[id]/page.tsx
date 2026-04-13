"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Tab = "progress" | "reflections" | "sensory" | "milestones";

// Mock student data — replace with Supabase queries
const student = {
  id: "1",
  name: "Emma Wilson",
  age: 7,
  level: 2,
  category: "LFA",
};

const skillCategories = [
  {
    name: "Water Familiarisation",
    description: "Building comfort and confidence in water",
    progress: 100,
    skills: [
      { name: "Blows bubbles for 3 seconds", status: "Mastered" },
      { name: "Submerges face independently", status: "Mastered" },
    ],
  },
  {
    name: "Body Control & Safety",
    description: "Learning water safety and body awareness",
    progress: 100,
    skills: [
      { name: "Back float 10 seconds", status: "Mastered" },
      { name: "Responds to 'Stop' cue", status: "Mastered" },
    ],
  },
  {
    name: "Stroke Foundations",
    description: "Developing basic swimming techniques",
    progress: 60,
    skills: [
      { name: "Kicks 5m with board", status: "Emerging" },
      { name: "Front glide 3 seconds", status: "Mastered" },
    ],
  },
  {
    name: "Emotional & Sensory Regulation",
    description: "Managing emotions and sensory responses in water",
    progress: 45,
    skills: [
      { name: "Recovers from distress within 2 minutes", status: "Mastered" },
      { name: "Uses calming strategy when anxious", status: "Emerging" },
    ],
  },
];

const reflections = [
  {
    date: "February 18, 2026",
    coachNotes: "Emma showed great progress with bubble blowing today. She's becoming more confident with face submersion.",
    parentFeedback: "Emma was excited to tell us about blowing bubbles. She practices in the bath!",
    mood: "happy",
  },
  {
    date: "February 11, 2026",
    coachNotes: "Worked on floating. Emma needed extra reassurance today.",
    parentFeedback: "She seemed a bit tired before the lesson.",
    mood: "neutral",
  },
];

const sensoryProfile = {
  concentrationLevel: "Moderate",
  noiseSensitivity: { level: 7, max: 10, label: "High" },
  touchTolerance: { level: 4, max: 10, label: "Medium" },
  transitionDifficulty: { level: 6, max: 10, label: "Moderate" },
  communicationPreference: "Visual cues + verbal",
  triggers: ["Sudden loud noises", "Crowded pool environment", "Water temperature changes"],
  notes: "Sensitive to water temperature changes. Prefers warm water.",
};

const milestones = [
  { title: "First Independent Back Float", date: "January 18, 2026", description: "Held back float position for 15 seconds without support.", link: "Read Details" },
  { title: "Completed Level 2 Skills", date: "January 15, 2026", description: "Successfully demonstrated all Level 2 core competencies.", link: "Level Achievement" },
  { title: "Face Submersion Mastery", date: "January 26, 2025", description: "Comfortable submerging face independently for 5+ seconds.", link: "Main Competency" },
  { title: "First Solo Pool Entry", date: "January 15, 2025", description: "Entered water independently using steps with confidence.", link: "Read Details" },
];

function ProgressTab() {
  return (
    <div className="space-y-6">
      {skillCategories.map((cat) => (
        <div key={cat.name} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">{cat.name}</h3>
              <p className="text-xs text-gray-500">{cat.description}</p>
            </div>
            <span className="text-sm font-medium text-gray-600">{cat.progress}%</span>
          </div>
          <div className="mb-4 h-2 w-full rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-teal-400" style={{ width: `${cat.progress}%` }} />
          </div>
          <div className="space-y-2">
            {cat.skills.map((skill) => (
              <div key={skill.name} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{skill.name}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    skill.status === "Mastered"
                      ? "bg-teal-100 text-teal-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {skill.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReflectionsTab() {
  return (
    <div>
      <button className="mb-4 w-full rounded-lg bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition">
        + Add New Reflection
      </button>
      <div className="space-y-6">
        {reflections.map((r) => (
          <div key={r.date}>
            <p className="mb-2 text-sm font-medium text-gray-500">{r.date}</p>
            <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Coach Notes</h4>
                <p className="text-sm text-gray-700">{r.coachNotes}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Parent Feedback</h4>
                <p className="text-sm text-gray-700">{r.parentFeedback}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SensoryTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Sensory Consideration Level</p>
            <p className="font-medium text-gray-800">{sensoryProfile.concentrationLevel}</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">MODERATE</span>
        </div>
      </div>

      {[
        { label: "Noise Sensitivity", ...sensoryProfile.noiseSensitivity },
        { label: "Touch Tolerance", ...sensoryProfile.touchTolerance },
        { label: "Transition Difficulty", ...sensoryProfile.transitionDifficulty },
      ].map((item) => (
        <div key={item.label} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">{item.label}</h3>
              <p className="text-xs text-gray-500">{item.label.toLowerCase()}</p>
            </div>
            <span className="text-sm text-gray-600">{item.level}/{item.max}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-amber-400"
              style={{ width: `${(item.level / item.max) * 100}%` }}
            />
          </div>
        </div>
      ))}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-1 font-medium text-gray-800">Communication Preference</h3>
        <p className="text-sm text-gray-600">{sensoryProfile.communicationPreference}</p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-800">Known Triggers</h3>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <ul className="space-y-1">
            {sensoryProfile.triggers.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-teal-500">&#10003;</span> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-800">Additional Notes</h3>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">{sensoryProfile.notes}</p>
        </div>
      </div>
    </div>
  );
}

function MilestonesTab() {
  return (
    <div>
      <div className="mb-4 rounded-xl bg-teal-50 p-4">
        <p className="text-sm font-medium text-teal-800">&#127942; {milestones.length} Milestones Achieved</p>
        <p className="text-xs text-gray-500">Celebrating progress along the journey</p>
      </div>
      <div className="relative space-y-6 border-l-2 border-teal-200 pl-6">
        {milestones.map((m) => (
          <div key={m.title} className="relative">
            <div className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-teal-500" />
            <h3 className="font-medium text-gray-800">{m.title}</h3>
            <p className="text-xs text-gray-500">{m.date}</p>
            <p className="mt-1 text-sm text-gray-600">{m.description}</p>
            <button className="mt-1 text-xs text-teal-600 hover:underline">{m.link}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentProfilePage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState<Tab>("progress");

  const tabs: { key: Tab; label: string }[] = [
    { key: "progress", label: "Progress" },
    { key: "reflections", label: "Reflections" },
    { key: "sensory", label: "Sensory" },
    { key: "milestones", label: "Milestones" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <Link href="/coach/students" className="mb-4 inline-block text-gray-400 hover:text-gray-600">&larr;</Link>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-xl font-bold text-teal-700">
          {student.name[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">{student.name}</h1>
          <p className="text-sm text-gray-500">Age {student.age} &bull; Level {student.level}</p>
          <p className="text-xs text-gray-400">{student.category} &bull; #8</p>
        </div>
      </div>

      {/* Action links */}
      <div className="mb-6 flex gap-4 text-sm">
        <button className="flex items-center gap-1 text-gray-500 hover:text-teal-600">&#128200; Mood Trends</button>
        <button className="flex items-center gap-1 text-gray-500 hover:text-teal-600">&#128221; Lesson Plan</button>
        <Link href={`/swimmer/profile/edit`} className="flex items-center gap-1 text-gray-500 hover:text-teal-600">&#9998; Edit Profile</Link>
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
      {activeTab === "progress" && <ProgressTab />}
      {activeTab === "reflections" && <ReflectionsTab />}
      {activeTab === "sensory" && <SensoryTab />}
      {activeTab === "milestones" && <MilestonesTab />}
    </div>
  );
}
