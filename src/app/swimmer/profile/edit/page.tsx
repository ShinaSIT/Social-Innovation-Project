"use client";

import { useState } from "react";
import Link from "next/link";

export default function EditSwimmerProfilePage() {
  const [age, setAge] = useState("7");
  const [conditions, setConditions] = useState<string[]>(["Autism"]);
  const [sensoryNeeds, setSensoryNeeds] = useState("");
  const [sensoryDetails, setSensoryDetails] = useState("");
  const [interests, setInterests] = useState("");
  const [consent, setConsent] = useState(true);

  const conditionOptions = [
    "Autism",
    "Intellectual Disability",
    "Physically Disabled",
    "Down Syndrome",
    "Others",
    "None",
  ];

  const toggleCondition = (c: string) => {
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save to Supabase
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-b from-teal-50 to-gray-50 px-6 pt-6 pb-8 text-center">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/swimmer/dashboard" className="text-gray-400 hover:text-gray-600">&larr;</Link>
          <span />
        </div>
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-gray-200">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-800">Swimmer Profile</h1>
        <p className="text-sm text-gray-500">Emma Wilson</p>
      </div>

      <form onSubmit={handleSave} className="px-6 pb-8 space-y-6">
        {/* Basic Information */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-800">&#128100; Basic Information</h2>
          <label className="mb-1 block text-sm text-gray-600">Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
          />
        </div>

        {/* Swimmer Conditions */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-800">&#128336; Swimmer Conditions</h2>
          <p className="mb-3 text-xs text-gray-500">Select all that apply. This helps our coaches provide the best support.</p>
          <div className="space-y-2">
            {conditionOptions.map((c) => (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conditions.includes(c)}
                  onChange={() => toggleCondition(c)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-500 focus:ring-teal-400"
                />
                <span className="text-sm text-gray-700">{c}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sensory Needs & Issues */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-800">&#127800; Sensory Needs & Issues</h2>
          <label className="mb-1 block text-xs text-gray-500">Describe any sensory sensitivities or preferences</label>
          <textarea
            value={sensoryNeeds}
            onChange={(e) => setSensoryNeeds(e.target.value)}
            placeholder="E.g., Sensitive to loud noises, prefers warm water, dislikes splashing..."
            className="mb-3 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            rows={3}
          />
          <label className="mb-1 block text-xs text-gray-500">Share any information about water temperature, pool noise, texture, or other sensory considerations</label>
          <textarea
            value={sensoryDetails}
            onChange={(e) => setSensoryDetails(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            rows={3}
          />
        </div>

        {/* Interests & Motivations */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-800">&#127775; Interests & Motivations</h2>
          <label className="mb-1 block text-xs text-gray-500">What does your swimmer enjoy?</label>
          <textarea
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="E.g., Loves dolphins, enjoys playing with toys, motivated by stickers..."
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
            rows={3}
          />
          <p className="mt-1 text-xs text-gray-400">This helps coaches connect with your child and make lessons more engaging.</p>
        </div>

        {/* Consent */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-500 focus:ring-teal-400"
          />
          <span className="text-xs text-gray-600">
            This information helps coaches create a supportive, personalised learning experience for Emma Wilson.
          </span>
        </label>

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
            className="flex-1 rounded-lg bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 transition"
          >
            Save Profile
          </button>
        </div>
      </form>
    </div>
  );
}
