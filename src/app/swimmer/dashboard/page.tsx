"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import SwimmerHeader from "@/app/swimmer/components/SwimmerHeader";

interface SwimmerData {
  id: string;
  name: string;
  age: number | null;
  category: string | null;
  progress: number | null;
}

interface SkillCategory {
  category: string;
  total: number;
  mastered: number;
  progress: number;
}

interface Milestone {
  id: string;
  title: string;
  achieved_on: string;
  category: string | null;
}

interface RecentUpdate {
  id: string;
  date: string;
  coach_notes: string | null;
  parent_feedback: string | null;
  mood: string | null;
  type: "reflection" | "pre_session";
}

export default function SwimmerDashboardPage() {
  const [swimmer, setSwimmer] = useState<SwimmerData | null>(null);
  const [skillCategories, setSkillCategories] = useState<SkillCategory[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      // 1. Get logged in user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      // 2. Determine whose dashboard to show
      // Check if this user is a caregiver with linked swimmers
      let swimmerId = user.id;

      const { data: caregiverLinks } = await supabase
        .from("caregiver_swimmers")
        .select("swimmer_id")
        .eq("caregiver_id", user.id)
        .limit(1);

      if (caregiverLinks && caregiverLinks.length > 0) {
        // This user is a caregiver — show their first linked swimmer's dashboard
        swimmerId = caregiverLinks[0].swimmer_id;
      }

      // 3. Fetch swimmer profile and basic data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", swimmerId)
        .single();

      if (profileError) throw new Error("Failed to load swimmer profile.");

      const { data: swimmerData, error: swimmerError } = await supabase
        .from("swimmers")
        .select("age, category, progress")
        .eq("id", swimmerId)
        .single();

      if (swimmerError) throw new Error("Failed to load swimmer data.");

      setSwimmer({
        id: swimmerId,
        name: profileData.full_name ?? "Swimmer",
        age: swimmerData?.age ?? null,
        category: swimmerData?.category ?? null,
        progress: swimmerData?.progress ?? null,
      });

      // 4. Fetch skill progress grouped by category
      const { data: skillsData } = await supabase
        .from("skill_progress")
        .select("category, status")
        .eq("swimmer_id", swimmerId);

      if (skillsData) {
        const categoryMap: Record<string, { total: number; mastered: number }> = {};
        for (const skill of skillsData) {
          if (!categoryMap[skill.category]) {
            categoryMap[skill.category] = { total: 0, mastered: 0 };
          }
          categoryMap[skill.category].total++;
          if (skill.status === "mastered") {
            categoryMap[skill.category].mastered++;
          }
        }
        const categories: SkillCategory[] = Object.entries(categoryMap).map(
          ([category, { total, mastered }]) => ({
            category,
            total,
            mastered,
            progress: total > 0 ? Math.round((mastered / total) * 100) : 0,
          })
        );
        setSkillCategories(categories);
      }

      // 5. Fetch recent milestones (last 5)
      const { data: milestonesData } = await supabase
        .from("milestones")
        .select("id, title, achieved_on, category")
        .eq("swimmer_id", swimmerId)
        .order("achieved_on", { ascending: false })
        .limit(5);

      setMilestones(milestonesData ?? []);

      // 6. Fetch recent session reflections
      const { data: reflectionsData } = await supabase
        .from("session_reflections")
        .select("id, coach_notes, parent_feedback, mood, created_at")
        .eq("swimmer_id", swimmerId)
        .order("created_at", { ascending: false })
        .limit(5);

      // 7. Fetch recent pre-session logs
      const { data: preSessionData } = await supabase
        .from("pre_session_logs")
        .select("id, general_notes, mood_before, created_at")
        .eq("swimmer_id", swimmerId)
        .order("created_at", { ascending: false })
        .limit(5);

      // 8. Merge and sort updates by date
      const updates: RecentUpdate[] = [
        ...(reflectionsData ?? []).map((r) => ({
          id: r.id,
          date: r.created_at,
          coach_notes: r.coach_notes,
          parent_feedback: r.parent_feedback,
          mood: r.mood,
          type: "reflection" as const,
        })),
        ...(preSessionData ?? []).map((p) => ({
          id: p.id,
          date: p.created_at,
          coach_notes: p.general_notes,
          parent_feedback: null,
          mood: p.mood_before,
          type: "pre_session" as const,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      setRecentUpdates(updates);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function moodEmoji(mood: string | null) {
    const map: Record<string, string> = {
      happy: "😊",
      neutral: "😐",
      sad: "😢",
      anxious: "😰",
      excited: "🤩",
      tired: "😴",
      upset: "😠",
    };
    return mood ? map[mood] ?? "😐" : null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error || !swimmer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-500">{error ?? "Could not load dashboard."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SwimmerHeader />
      {/* Header with gradient */}
      <div className="bg-gradient-to-b from-teal-50 to-gray-50 px-6 pt-6 pb-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-700">
            {swimmer.name[0]}
          </div>
          <h1 className="text-xl font-bold text-gray-800">{swimmer.name}</h1>
          {swimmer.age && <p className="text-sm text-gray-500">{swimmer.age} years old</p>}
          {swimmer.category && <p className="text-xs text-gray-400">{swimmer.category}</p>}
        </div>

        {/* Overall Progress */}
        <div className="mt-6 rounded-xl bg-teal-500 p-4 text-center text-white">
          <p className="text-sm opacity-80">Overall Progress</p>
          <p className="text-3xl font-bold">{swimmer.progress ?? 0}%</p>
        </div>
      </div>

      <div className="px-6 space-y-6 pb-8">
        {/* Skills Progress */}
        <div>
          <h2 className="mb-3 font-semibold text-gray-800">Skills Progress</h2>
          {skillCategories.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No skill data available yet.</p>
          ) : (
            <div className="space-y-3">
              {skillCategories.map((skill) => (
                <div key={skill.category} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{skill.category}</span>
                    <span className="text-xs text-gray-500">{skill.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-teal-400"
                      style={{ width: `${skill.progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {skill.mastered} of {skill.total} skills mastered
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Milestones */}
        <div>
          <h2 className="mb-3 font-semibold text-gray-800">&#127942; Recent Milestones</h2>
          {milestones.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No milestones yet.</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100">
                    <span className="text-teal-600 text-sm">&#10003;</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.title}</p>
                    <p className="text-xs text-gray-500">
                      {m.category && `${m.category} • `}{formatDate(m.achieved_on)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Updates */}
        <div>
          <h2 className="mb-3 font-semibold text-gray-800">&#128221; Recent Updates</h2>
          {recentUpdates.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No updates yet.</p>
          ) : (
            <div className="space-y-3">
              {recentUpdates.map((u) => (
                <div key={u.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">{formatDate(u.date)}</p>
                    <div className="flex items-center gap-1">
                      {u.mood && (
                        <span className="text-sm">{moodEmoji(u.mood)}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        u.type === "reflection"
                          ? "bg-teal-50 text-teal-600"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {u.type === "reflection" ? "Session" : "Pre-session"}
                      </span>
                    </div>
                  </div>
                  {u.coach_notes && (
                    <p className="text-sm text-gray-700">{u.coach_notes}</p>
                  )}
                  {u.parent_feedback && (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      <p className="text-xs text-gray-500">Parent feedback</p>
                      <p className="text-sm text-gray-700">{u.parent_feedback}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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