"use client";

import { useState } from "react";
import CoachHeader from "@/app/coach/components/CoachHeader";

interface ToolkitCard {
  title: string;
  category: string;
  description: string;
  tag: string;
}

const toolkitCards: ToolkitCard[] = [
  { title: "Water Entry Sequence", category: "Social Narrative", description: "Step-by-step visual guide for entering the pool safely.", tag: "Movement" },
  { title: "Stop & Listen Cue", category: "Safety Cue", description: "Emergency stop signal with clear visual indicator.", tag: "Cue Cards" },
  { title: "Breathing Technique Card", category: "Skill Cue", description: "Visual reminder for proper breathing technique progression.", tag: "Cue Cards" },
  { title: "Lesson Schedule Visual", category: "Schedule", description: "Today's lesson plan with time indicators.", tag: "Schedule" },
  { title: "Emotion Check-in Chart", category: "Regulation Tool", description: "Pre-lesson emotion identification chart.", tag: "Routine" },
  { title: "Back Float Positioning", category: "Skill Cue", description: "Visual guide showing correct back float position.", tag: "Cue Cards" },
  { title: "Pool Rules Visual", category: "Safety", description: "Simple illustrated pool safety rules.", tag: "Safety" },
  { title: "Transition Timer", category: "Routine Template", description: "Visual template for activity transitions.", tag: "Routine" },
];

export default function VisualToolkitPage() {
  const [search, setSearch] = useState("");

  const filtered = toolkitCards.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <CoachHeader />
      <div className="p-6">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-xl font-bold text-gray-800">Visual Toolkit Library</h1>
      </div>
      <p className="mb-6 text-sm text-gray-500">Access visual cue cards and resources</p>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search toolkit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
        />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {filtered.map((card) => (
          <div key={card.title} className="rounded-xl bg-white shadow-sm overflow-hidden">
            {/* Thumbnail placeholder */}
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-teal-100 to-teal-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/60 text-xl">
                &#128196;
              </div>
            </div>

            <div className="p-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">{card.title}</h3>
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-600">
                  {card.tag}
                </span>
              </div>
              <p className="mb-1 text-xs text-gray-500">{card.category}</p>
              <p className="mb-3 text-xs text-gray-600">{card.description}</p>

              <div className="flex gap-2">
                <button className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  &#128065; Preview
                </button>
                <button className="flex-1 rounded-lg bg-teal-500 py-1.5 text-xs font-medium text-white hover:bg-teal-600 transition">
                  &#11015; Download
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
