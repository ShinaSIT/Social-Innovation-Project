"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const SIGNED_URL_EXPIRY = 60;

interface Timetable {
  id: string;
  title: string;
  description: string | null;
  term_label: string | null;
  file_url: string;
  created_at: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

/**
 * Read-only list of the club's uploaded timetables, shared by the coach and
 * swimmer views. Admins manage them at /admin/timetables.
 *
 * There is no club filter in the query: the select policy on public.timetables
 * already scopes rows to the caller's club.
 */
export default function TimetableList() {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("timetables")
        .select("id, title, description, term_label, file_url, created_at")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (fetchError) setError("Failed to load timetables.");
      else setTimetables(data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = async (item: Timetable) => {
    setOpening(item.id);
    setError(null);
    const supabase = createClient();
    // The bucket is private, so the file is reached through a short-lived
    // signed URL rather than a permanent public one.
    const { data, error: signError } = await supabase.storage
      .from("timetables")
      .createSignedUrl(item.file_url, SIGNED_URL_EXPIRY);
    setOpening(null);

    if (signError || !data) {
      setError("Could not open that file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-gray-500">Loading timetables...</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        {timetables.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No timetables have been uploaded yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {timetables.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    {item.term_label ? `${item.term_label} · ` : ""}
                    Uploaded {formatDate(item.created_at)}
                  </p>
                  {item.description && (
                    <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleOpen(item)}
                  disabled={opening === item.id}
                  className="shrink-0 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  {opening === item.id ? "Opening..." : "View PDF"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
