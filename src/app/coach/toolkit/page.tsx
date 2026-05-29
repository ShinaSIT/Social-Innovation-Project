"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import CoachHeader from "@/app/coach/components/CoachHeader";

interface ToolkitItem {
  id: string;
  title: string;
  category: string;
  description: string | null;
  tag: string | null;
  file_url: string | null;
  is_global: boolean;
  club_id: string | null;
}

const SIGNED_URL_EXPIRY = 60; // seconds

export default function VisualToolkitPage() {
  const [items, setItems] = useState<ToolkitItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

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

      const clubId = profile?.club_id;

      // Fetch global items and club-specific items
      let query = supabase
        .from("visual_toolkit_items")
        .select("id, title, category, description, tag, file_url, is_global, club_id")
        .order("category", { ascending: true });

      if (clubId) {
        query = query.or(`is_global.eq.true,club_id.eq.${clubId}`);
      } else {
        query = query.eq("is_global", true);
      }

      const { data, error: fetchError } = await query;
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
    setActionLoading(item.id);

    const url = await getSignedUrl(item.file_url);
    if (!url) {
      setError("Failed to generate preview link. Please try again.");
      setActionLoading(null);
      return;
    }

    setPreviewUrl(url);
    setPreviewTitle(item.title);
    setShowPreview(true);
    setActionLoading(null);
  };

  const handleDownload = async (item: ToolkitItem) => {
    if (!item.file_url) return;
    setActionLoading(item.id + "-download");

    const url = await getSignedUrl(item.file_url);
    if (!url) {
      setError("Failed to generate download link. Please try again.");
      setActionLoading(null);
      return;
    }

    // Create a temporary anchor to trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = item.title + ".pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setActionLoading(null);
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

  const categoryIcon: Record<string, string> = {
    "Social Narrative": "&#128214;",
    "Safety Cue": "&#128721;",
    "Skill Cue": "&#127946;",
    "Schedule": "&#128197;",
    "Regulation Tool": "&#128522;",
    "Routine Template": "&#9201;",
    "Safety": "&#9888;",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading toolkit...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CoachHeader />
      <div id="main-content" tabIndex={-1} className="p-6">

        {/* Header */}
        <div className="mb-1">
          <h1 className="text-xl font-bold text-gray-800">Visual Toolkit Library</h1>
        </div>
        <p className="mb-6 text-sm text-gray-500">Access visual cue cards and resources</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
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
                filterTag === ""
                  ? "bg-teal-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag === filterTag ? "" : tag)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filterTag === tag
                    ? "bg-teal-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Count */}
        <p className="mb-3 text-xs text-gray-500">{filtered.length} items</p>

        {/* Cards Grid */}
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">No toolkit items found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((item) => (
              <div key={item.id} className="rounded-xl bg-white shadow-sm overflow-hidden">
                {/* Thumbnail */}
                <div className="flex h-28 items-center justify-center bg-gradient-to-br from-teal-100 to-teal-200">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/60 text-2xl"
                    dangerouslySetInnerHTML={{ __html: categoryIcon[item.category] ?? "&#128196;" }}
                  />
                </div>

                <div className="p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800">{item.title}</h3>
                    {item.tag && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-600">
                        {item.tag}
                      </span>
                    )}
                  </div>
                  <p className="mb-1 text-xs text-gray-500">{item.category}</p>
                  {item.description && (
                    <p className="mb-3 text-xs text-gray-600">{item.description}</p>
                  )}
                  {!item.is_global && (
                    <span className="mb-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                      Club Resource
                    </span>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreview(item)}
                      disabled={!item.file_url || actionLoading === item.id}
                      className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
                    >
                      {actionLoading === item.id ? "Loading..." : <><span>&#128065;</span> Preview</>}
                    </button>
                    <button
                      onClick={() => handleDownload(item)}
                      disabled={!item.file_url || actionLoading === item.id + "-download"}
                      className="flex-1 rounded-lg bg-teal-500 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-40 transition"
                    >
                      {actionLoading === item.id + "-download" ? "Loading..." : <><span>&#11015;</span> Download</>}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="font-semibold text-gray-800">{previewTitle}</h2>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewUrl(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
            </div>
            <div className="h-[70vh]">
              <iframe
                src={previewUrl}
                className="h-full w-full"
                title={previewTitle}
              />
            </div>
            <div className="border-t border-gray-100 p-4">
              <p className="text-center text-xs text-gray-400">
                Preview link expires in {SIGNED_URL_EXPIRY} seconds for security.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}