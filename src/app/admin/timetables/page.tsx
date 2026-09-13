"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import AdminHeader from "@/app/admin/components/AdminHeader";

const SIGNED_URL_EXPIRY = 60;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface Timetable {
  id: string;
  title: string;
  description: string | null;
  term_label: string | null;
  file_url: string;
  created_at: string;
}

function sanitize(value: string, maxLength = 200): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .slice(0, maxLength);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default function AdminTimetablesPage() {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [clubId, setClubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ title: "", term_label: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Timetable | null>(null);

  useEffect(() => {
    fetchTimetables();
  }, []);

  const fetchTimetables = async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

      setClubId(profile?.club_id ?? null);

      // No club filter here: the select policy already scopes rows to the
      // caller's club.
      const { data, error: fetchError } = await supabase
        .from("timetables")
        .select("id, title, description, term_label, file_url, created_at")
        .order("created_at", { ascending: false });

      if (fetchError) throw new Error("Failed to load timetables.");
      setTimetables(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setSuccess(null);

    if (!form.title.trim()) return setUploadError("Title is required.");
    if (!file) return setUploadError("Please choose a PDF file.");
    // Enforced again by the bucket policy; this is just a fast, friendly
    // failure before we spend an upload.
    if (file.type !== "application/pdf") return setUploadError("Only PDF files are allowed.");
    if (file.size > MAX_FILE_BYTES) return setUploadError("File must be under 10MB.");

    setUploading(true);
    const supabase = createClient();

    // The bucket policies key off the first path segment, so the club id has to
    // lead the path.
    const safeTitle = form.title.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
    const filePath = `${clubId}/${safeTitle}_${Date.now()}.pdf`;

    try {
      const { error: storageError } = await supabase.storage
        .from("timetables")
        .upload(filePath, file, { contentType: "application/pdf", upsert: false });

      if (storageError) throw new Error("Failed to upload file: " + storageError.message);

      const { data: { user } } = await supabase.auth.getUser();

      const { error: dbError } = await supabase.from("timetables").insert({
        club_id: clubId,
        title: sanitize(form.title.trim()),
        term_label: sanitize(form.term_label.trim(), 100) || null,
        description: sanitize(form.description.trim(), 500) || null,
        file_url: filePath,
        uploaded_by: user?.id,
      });

      if (dbError) {
        // Do not leave an orphaned object in the bucket.
        await supabase.storage.from("timetables").remove([filePath]);
        throw new Error("Failed to save timetable: " + dbError.message);
      }

      setForm({ title: "", term_label: "", description: "" });
      setFile(null);
      setSuccess("Timetable uploaded.");
      await fetchTimetables();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (item: Timetable) => {
    setActionLoading(item.id);
    setError(null);
    const supabase = createClient();
    const { data, error: signError } = await supabase.storage
      .from("timetables")
      .createSignedUrl(item.file_url, SIGNED_URL_EXPIRY);
    setActionLoading(null);

    if (signError || !data) {
      setError("Could not open that file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActionLoading(confirmDelete.id);
    const supabase = createClient();

    try {
      // Row first: if the object delete then fails we are left with an
      // unreferenced file, which is harmless. The reverse leaves a broken row.
      const { error: dbError } = await supabase
        .from("timetables")
        .delete()
        .eq("id", confirmDelete.id);
      if (dbError) throw new Error("Failed to delete timetable.");

      await supabase.storage.from("timetables").remove([confirmDelete.file_url]);

      setConfirmDelete(null);
      await fetchTimetables();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen page-shell bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading timetables...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell bg-gray-50">
      <AdminHeader />

      <div id="main-content" tabIndex={-1} className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Timetables</h1>
          <p className="text-sm text-gray-500">
            Upload PDF timetables for your club. Coaches and swimmers can view them.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Upload */}
        <form onSubmit={handleUpload} className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Upload a timetable</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="tt-title" className="mb-1 block text-sm text-gray-600">Title *</label>
              <input
                id="tt-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Saturday Squad Timetable"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="tt-term" className="mb-1 block text-sm text-gray-600">Term (optional)</label>
              <input
                id="tt-term"
                type="text"
                value={form.term_label}
                onChange={(e) => setForm({ ...form, term_label: e.target.value })}
                placeholder="Term 1 2026"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tt-desc" className="mb-1 block text-sm text-gray-600">Description (optional)</label>
            <textarea
              id="tt-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="tt-file" className="mb-1 block text-sm text-gray-600">PDF file *</label>
            <input
              id="tt-file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 file:mr-3 file:rounded-full file:border-0 file:bg-teal-50 file:px-3 file:py-1 file:text-sm file:text-teal-700"
            />
            <p className="mt-1 text-xs text-gray-400">PDF only, up to 10MB.</p>
          </div>

          {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}
          {success && <p className="text-sm text-teal-600">{success}</p>}

          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600 disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {uploading ? "Uploading..." : "Upload timetable"}
          </button>
        </form>

        {/* List */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-800">
            Uploaded timetables{timetables.length > 0 && ` (${timetables.length})`}
          </h2>

          {timetables.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No timetables uploaded yet.</p>
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
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpen(item)}
                      disabled={actionLoading === item.id}
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
                    >
                      {actionLoading === item.id ? "Opening..." : "View"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(item)}
                      className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2 className="mb-2 font-semibold text-gray-800">Delete timetable</h2>
            <p className="mb-4 text-sm text-gray-600">
              Delete &ldquo;{confirmDelete.title}&rdquo;? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={actionLoading === confirmDelete.id}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
              >
                {actionLoading === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
