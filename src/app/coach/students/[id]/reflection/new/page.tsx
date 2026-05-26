"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import CoachHeader from "@/app/coach/components/CoachHeader";

const MOOD_OPTIONS = [
  "happy",
  "neutral",
  "sad",
  "anxious",
  "excited",
  "tired",
  "upset",
];

// Sanitize text input - strip HTML tags and limit length
function sanitize(value: string, maxLength = 1000): string {
  return value
    .replace(/<[^>]*>/g, "")           // strip HTML tags
    .replace(/[<>"'`]/g, "")           // strip dangerous characters
    .slice(0, maxLength);
}

export default function NewReflectionPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [studentName, setStudentName] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mood, setMood] = useState<string>("");
  const [coachNotes, setCoachNotes] = useState<string>("");
  const [parentFeedback, setParentFeedback] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      setLoading(true);
      setError(null);

      try {
        // Fetch student name
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", studentId)
          .single();

        if (profileError) throw new Error("Failed to load student profile.");
        setStudentName(profileData.full_name ?? "Unknown");

        // Fetch most recent completed session
        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("id")
          .eq("swimmer_id", studentId)
          .eq("status", "completed")
          .order("session_date", { ascending: false })
          .limit(1)
          .single();

        if (sessionError || !sessionData) {
          throw new Error("No completed session found for this student.");
        }

        setSessionId(sessionData.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An error occurred.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (studentId) fetchData();
  }, [studentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;

    if (!mood) {
      setSaveError("Please select a mood.");
      return;
    }
    if (!coachNotes.trim()) {
      setSaveError("Please enter coach notes.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const supabase = createClient();

    try {
      // Get the logged in coach's ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      const { error: insertError } = await supabase
        .from("session_reflections")
        .insert({
          session_id: sessionId,
          swimmer_id: studentId,
          coach_id: user.id,        // 👈 this was missing
          coach_notes: coachNotes.trim(),
          parent_feedback: parentFeedback.trim() || null,
          mood,
          created_at: new Date().toISOString(),
        });

      if (insertError) throw new Error("Failed to save reflection: " + insertError.message);

      router.push(`/coach/students/${studentId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CoachHeader />
        <div className="flex flex-col items-center justify-center px-6 py-16">
          <p className="mb-4 text-sm text-red-500">{error}</p>
          <Link
            href={`/coach/students/${studentId}`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Back to Student
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CoachHeader />

      <div className="px-6 pt-6 pb-8">
        {/* Back link */}
        <Link
          href={`/coach/students/${studentId}`}
          className="mb-4 inline-block text-gray-400 hover:text-gray-600"
        >
          &larr; Back to {studentName}
        </Link>

        <h1 className="mb-6 text-xl font-bold text-gray-800">
          New Reflection for {studentName}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mood */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <label className="mb-2 block text-sm font-semibold text-gray-800">
              Mood
            </label>
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
            >
              <option value="">Select mood...</option>
              {MOOD_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Coach Notes */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <label className="mb-2 block text-sm font-semibold text-gray-800">
              Coach Notes
            </label>
            <textarea
              value={coachNotes}
              onChange={(e) => setCoachNotes(sanitize(e.target.value, 1000))}
              placeholder="How did the session go? What progress was made?"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
              rows={4}
            />
            <p className="mt-0.5 text-right text-xs text-gray-400">
              {coachNotes.length}/1000
            </p>
          </div>

          {/* Parent Feedback */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <label className="mb-2 block text-sm font-semibold text-gray-800">
              Parent Feedback{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={parentFeedback}
              onChange={(e) =>
                setParentFeedback(sanitize(e.target.value, 1000))
              }
              placeholder="Any feedback or observations from the parent..."
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
              rows={4}
            />
            <p className="mt-0.5 text-right text-xs text-gray-400">
              {parentFeedback.length}/1000
            </p>
          </div>

          {/* Error message */}
          {saveError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {saveError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href={`/coach/students/${studentId}`}
              className="flex-1 rounded-lg border border-gray-200 py-3 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-teal-500 py-3 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Reflection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
