"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface ToolkitItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tag: string;
  file_url: string | null;
  is_global: boolean;
  club_id: string | null;
}

interface UploadForm {
  title: string;
  category: string;
  description: string;
  tag: string;
}

const SIGNED_URL_EXPIRY = 60;

const CATEGORY_OPTIONS = [
  "Social Narrative",
  "Safety Cue",
  "Skill Cue",
  "Schedule",
  "Regulation Tool",
  "Routine Template",
  "Safety",
];

const TAG_OPTIONS = [
  "Movement",
  "Cue Cards",
  "Schedule",
  "Routine",
  "Safety",
];

const categoryIcon: Record<string, string> = {
  "Social Narrative": "&#128214;",
  "Safety Cue": "&#128721;",
  "Skill Cue": "&#127946;",
  "Schedule": "&#128197;",
  "Regulation Tool": "&#128522;",
  "Routine Template": "&#9201;",
  "Safety": "&#9888;&#65039;",
};

export default function AdminToolkitPage() {
  const [items, setItems] = useState<ToolkitItem[]>([]);
  const [clubId, setClubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadForm>({
    title: "",
    category: "",
    description: "",
    tag: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<ToolkitItem | null>(null);
  const [editForm, setEditForm] = useState<UploadForm>({
    title: "",
    category: "",
    description: "",
    tag: "",
  });
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
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

      const cId = profile?.club_id;
      setClubId(cId);

      const { data, error: fetchError } = await supabase
        .from("visual_toolkit_items")
        .select("id, title, category, description, tag, file_url, is_global, club_id")
        .or(`is_global.eq.true,club_id.eq.${cId}`)
        .order("category", { ascending: true });

      if (fetchError) throw new Error("Failed to load toolkit items.");
      setItems(data ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSignedUrl = async (fileUrl: string): Promise<string | null> => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("toolkit-files")
      .createSignedUrl(fileUrl, SIGNED_URL_EXPIRY);
    if (error || !data) return null;
    return data.signedUrl;
  };

  const handlePreview = async (item: ToolkitItem) => {
    if (!item.file_url) return;
    setActionLoading(item.id + "-preview");
    const url = await getSignedUrl(item.file_url);
    if (!url) { setError("Failed to generate preview link."); setActionLoading(null); return; }
    setPreviewUrl(url);
    setPreviewTitle(item.title);
    setShowPreview(true);
    setActionLoading(null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!uploadFile) { setUploadError("Please select a PDF file."); return; }
    if (!uploadForm.title.trim()) { setUploadError("Title is required."); return; }
    if (!uploadForm.category) { setUploadError("Category is required."); return; }
    if (!uploadForm.description.trim()) { setUploadError("Description is required."); return; }
    if (!uploadForm.tag) { setUploadError("Tag is required."); return; }
    if (uploadFile.type !== "application/pdf") { setUploadError("Only PDF files are allowed."); return; }
    if (uploadFile.size > 10 * 1024 * 1024) { setUploadError("File must be under 10MB."); return; }

    setUploading(true);
    const supabase = createClient();

    try {
      // Sanitize filename
      const safeTitle = uploadForm.title.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
      const filePath = `${clubId}/${safeTitle}_${Date.now()}.pdf`;

      const { error: storageError } = await supabase.storage
        .from("toolkit-files")
        .upload(filePath, uploadFile, { contentType: "application/pdf", upsert: false });

      if (storageError) throw new Error("Failed to upload file: " + storageError.message);

      const { error: dbError } = await supabase
        .from("visual_toolkit_items")
        .insert({
          title: uploadForm.title.trim(),
          category: uploadForm.category,
          description: uploadForm.description.trim(),
          tag: uploadForm.tag,
          file_url: filePath,
          is_global: false,
          club_id: clubId,
        });

      if (dbError) {
        // Clean up uploaded file if DB insert fails
        await supabase.storage.from("toolkit-files").remove([filePath]);
        throw new Error("Failed to save toolkit item: " + dbError.message);
      }

      setShowUploadModal(false);
      setUploadForm({ title: "", category: "", description: "", tag: "" });
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchItems();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (item: ToolkitItem) => {
    setEditItem(item);
    setEditForm({
      title: item.title,
      category: item.category,
      description: item.description ?? "",
      tag: item.tag ?? "",
    });
    setEditFile(null);
    setEditError(null);
    setShowEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setEditError(null);

    if (!editForm.title.trim()) { setEditError("Title is required."); return; }
    if (!editForm.category) { setEditError("Category is required."); return; }
    if (!editForm.description.trim()) { setEditError("Description is required."); return; }
    if (!editForm.tag) { setEditError("Tag is required."); return; }
    if (editFile && editFile.type !== "application/pdf") { setEditError("Only PDF files are allowed."); return; }
    if (editFile && editFile.size > 10 * 1024 * 1024) { setEditError("File must be under 10MB."); return; }

    setEditing(true);
    const supabase = createClient();

    try {
      let filePath = editItem.file_url;

      // Upload new file if provided
      if (editFile) {
        const safeTitle = editForm.title.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
        const newFilePath = `${clubId}/${safeTitle}_${Date.now()}.pdf`;

        const { error: storageError } = await supabase.storage
          .from("toolkit-files")
          .upload(newFilePath, editFile, { contentType: "application/pdf", upsert: false });

        if (storageError) throw new Error("Failed to upload new file.");

        // Delete old file if exists
        if (editItem.file_url) {
          await supabase.storage.from("toolkit-files").remove([editItem.file_url]);
        }

        filePath = newFilePath;
      }

      const { error: dbError } = await supabase
        .from("visual_toolkit_items")
        .update({
          title: editForm.title.trim(),
          category: editForm.category,
          description: editForm.description.trim(),
          tag: editForm.tag,
          file_url: filePath,
        })
        .eq("id", editItem.id);

      if (dbError) throw new Error("Failed to update toolkit item.");

      setShowEditModal(false);
      setEditItem(null);
      await fetchItems();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (item: ToolkitItem) => {
    setDeleting(true);
    const supabase = createClient();

    try {
      // Delete file from storage
      if (item.file_url) {
        await supabase.storage.from("toolkit-files").remove([item.file_url]);
      }

      const { error } = await supabase
        .from("visual_toolkit_items")
        .delete()
        .eq("id", item.id);

      if (error) throw new Error("Failed to delete toolkit item.");

      setDeleteId(null);
      await fetchItems();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const tags = [...new Set(items.map((i) => i.tag).filter(Boolean))] as string[];

  const filtered = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      (item.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTag = filterTag ? item.tag === filterTag : true;
    return matchesSearch && matchesTag;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading toolkit...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-600">&larr;</Link>
            <h1 className="text-xl font-bold text-gray-800">Visual Toolkit</h1>
          </div>
          <p className="ml-6 text-sm text-gray-500">Manage club toolkit resources</p>
        </div>
        <button
          onClick={() => {
            setShowUploadModal(true);
            setUploadError(null);
            setUploadForm({ title: "", category: "", description: "", tag: "" });
            setUploadFile(null);
          }}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition"
        >
          &#43; Upload Resource
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&#10005;</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search toolkit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
        />
      </div>

      {/* Tag Filter */}
      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterTag("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filterTag === "" ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag === filterTag ? "" : tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filterTag === tag ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <p className="mb-3 text-xs text-gray-500">{filtered.length} items</p>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-8 shadow-sm text-center">
          <p className="text-sm text-gray-500">No toolkit items found.</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-3 text-sm text-teal-600 hover:underline"
          >
            Upload your first resource
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl bg-white shadow-sm overflow-hidden">
              {/* Thumbnail */}
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-teal-100 to-teal-200">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/60 text-2xl"
                  dangerouslySetInnerHTML={{ __html: categoryIcon[item.category] ?? "&#128196;" }}
                />
              </div>

              <div className="p-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">{item.title}</h3>
                  <div className="flex items-center gap-1">
                    {item.tag && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-600">
                        {item.tag}
                      </span>
                    )}
                    {item.is_global && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                        Global
                      </span>
                    )}
                  </div>
                </div>
                <p className="mb-1 text-xs text-gray-500">{item.category}</p>
                {item.description && (
                  <p className="mb-3 text-xs text-gray-600">{item.description}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreview(item)}
                    disabled={!item.file_url || actionLoading === item.id + "-preview"}
                    className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
                  >
                    {actionLoading === item.id + "-preview" ? "Loading..." : "Preview"}
                  </button>

                  {/* Only show edit/delete for club items */}
                  {!item.is_global && (
                    <>
                      <button
                        onClick={() => openEditModal(item)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                      >
                        &#9998; Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                      >
                        &#128465; Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 className="font-semibold text-gray-800">Upload Toolkit Resource</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <form onSubmit={handleUpload} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Water Entry Sequence"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                >
                  <option value="">-- Select category --</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the resource..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tag</label>
                <select
                  value={uploadForm.tag}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, tag: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                >
                  <option value="">-- Select tag --</option>
                  {TAG_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">PDF File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">PDF only, max 10MB</p>
              </div>

              {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 className="font-semibold text-gray-800">Edit Toolkit Resource</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <form onSubmit={handleEdit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                >
                  <option value="">-- Select category --</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tag</label>
                <select
                  value={editForm.tag}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, tag: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                >
                  <option value="">-- Select tag --</option>
                  {TAG_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Replace PDF File <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">Leave empty to keep existing file. PDF only, max 10MB.</p>
              </div>

              {editError && <p className="text-sm text-red-500">{editError}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="flex-1 rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
                >
                  {editing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
            <h2 className="mb-2 font-semibold text-gray-800">Delete Resource</h2>
            <p className="mb-6 text-sm text-gray-500">
              Are you sure you want to delete this resource? This will permanently remove the file and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const item = items.find((i) => i.id === deleteId);
                  if (item) handleDelete(item);
                }}
                disabled={deleting}
                className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="font-semibold text-gray-800">{previewTitle}</h2>
              <button
                onClick={() => { setShowPreview(false); setPreviewUrl(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
            </div>
            <div className="h-[70vh]">
              <iframe src={previewUrl} className="h-full w-full" title={previewTitle} />
            </div>
            <div className="border-t border-gray-100 p-3 text-center">
              <p className="text-xs text-gray-400">Preview link expires in {SIGNED_URL_EXPIRY} seconds for security.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}