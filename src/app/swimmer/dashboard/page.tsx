"use client";

import Link from "next/link";

// Mock data — replace with Supabase queries
const swimmer = {
  name: "Emma Wilson",
  age: 7,
  category: "LFA Programme",
  overallProgress: 25,
};

const skillsProgress = [
  { name: "Water Familiarisation", progress: 80 },
  { name: "Body Control & Safety", progress: 55 },
  { name: "Stroke Foundations", progress: 0 },
  { name: "Emotional & Sensory Regulation", progress: 0 },
];

const recentMilestones = [
  { title: "Blows bubbles for 3 seconds", date: "Recently", category: "Water Familiarisation" },
  { title: "Responds to 'Stop' cue", date: "Recently", category: "Body Control & Safety" },
];

const recentUpdates = [
  {
    date: "February 18, 2026",
    note: "Emma showed great progress with bubble blowing today. She's becoming more confident with face submersion.",
    mood: "happy",
  },
  {
    date: "February 11, 2026",
    note: "Worked on floating. Emma needed extra reassurance today.",
    mood: "neutral",
  },
];

export default function SwimmerDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with gradient */}
      <div className="bg-gradient-to-b from-teal-50 to-gray-50 px-6 pt-6 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/login" className="text-gray-400 hover:text-gray-600">&larr;</Link>
          <Link href="/swimmer/profile/edit" className="text-sm text-gray-500 hover:text-teal-600">
            &#9998; Edit Profile
          </Link>
        </div>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-700">
            {swimmer.name[0]}
          </div>
          <h1 className="text-xl font-bold text-gray-800">{swimmer.name}</h1>
          <p className="text-sm text-gray-500">{swimmer.age} years old</p>
          <p className="text-xs text-gray-400">{swimmer.category}</p>
        </div>

        {/* Overall Progress */}
        <div className="mt-6 rounded-xl bg-teal-500 p-4 text-center text-white">
          <p className="text-sm opacity-80">Overall Progress</p>
          <p className="text-3xl font-bold">{swimmer.overallProgress}%</p>
        </div>
      </div>

      <div className="px-6 space-y-6 pb-8">
        {/* Skills Progress */}
        <div>
          <h2 className="mb-3 font-semibold text-gray-800">Skills Progress</h2>
          <div className="space-y-3">
            {skillsProgress.map((skill) => (
              <div key={skill.name} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{skill.name}</span>
                  <span className="text-xs text-gray-500">{skill.progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-teal-400" style={{ width: `${skill.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Milestones */}
        <div>
          <h2 className="mb-3 font-semibold text-gray-800">&#127942; Recent Milestones</h2>
          <div className="space-y-2">
            {recentMilestones.map((m) => (
              <div key={m.title} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100">
                  <span className="text-teal-600 text-sm">&#10003;</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{m.title}</p>
                  <p className="text-xs text-gray-500">{m.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Updates */}
        <div>
          <h2 className="mb-3 font-semibold text-gray-800">&#128221; Recent Updates</h2>
          <div className="space-y-3">
            {recentUpdates.map((u) => (
              <div key={u.date} className="rounded-xl bg-white p-4 shadow-sm">
                <p className="mb-1 text-xs font-medium text-gray-500">{u.date}</p>
                <p className="text-sm text-gray-700">{u.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Encouragement */}
        <div className="rounded-xl bg-teal-50 p-4 text-center">
          <p className="text-sm text-gray-700">
            {swimmer.name} is making wonderful progress! Every small step forward is a celebration. Keep encouraging their love of water! &#128153;
          </p>
        </div>
      </div>
    </div>
  );
}
