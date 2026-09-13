"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminHeader from "@/app/admin/components/AdminHeader";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  target_role: string | null;
  target_user_id: string | null;
  target_name?: string;
  amount_due: number | null;
  due_date: string | null;
  scheduled_at: string | null;
  created_at: string;
  read_count: number;
}

interface User {
  id: string;
  name: string;
  role: string;
}

const TYPE_OPTIONS = [
  { value: "general", label: "General" },
  { value: "announcement", label: "Announcement" },
  { value: "payment", label: "Payment Reminder" },
];

const TARGET_ROLE_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "coach", label: "All Coaches" },
  { value: "swimmer", label: "All Swimmers" },
  { value: "specific", label: "Specific Users" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clubId, setClubId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    message: "",
    type: "general",
    target_role: "all",
    target_user_ids: [] as string[],
    amount_due: "",
    due_date: "",
    scheduled_at: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

      const cId = adminProfile?.club_id;
      setClubId(cId);

      // Fetch ALL notifications for admin (including scheduled)
      const { data: notifs, error: notifsError } = await supabase
        .from("notifications")
        .select("id, title, message, type, target_role, target_user_id, amount_due, due_date, scheduled_at, created_at")
        .eq("club_id", cId)
        .order("created_at", { ascending: false });

      if (notifsError) throw new Error("Failed to load notifications.");

      // Fetch read counts
      const notifIds = (notifs ?? []).map((n) => n.id);
      const { data: reads } = await supabase
        .from("notification_reads")
        .select("notification_id")
        .in("notification_id", notifIds.length > 0 ? notifIds : ["00000000-0000-0000-0000-000000000000"]);

      const readCountMap: Record<string, number> = {};
      for (const r of reads ?? []) {
        readCountMap[r.notification_id] = (readCountMap[r.notification_id] ?? 0) + 1;
      }

      // Fetch target user names
      const targetUserIds = (notifs ?? [])
        .filter((n) => n.target_user_id)
        .map((n) => n.target_user_id);

      const { data: targetProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", targetUserIds.length > 0 ? targetUserIds : ["00000000-0000-0000-0000-000000000000"]);

      const nameMap: Record<string, string> = {};
      for (const p of targetProfiles ?? []) nameMap[p.id] = p.full_name ?? "Unknown";

      setNotifications(
        (notifs ?? []).map((n) => ({
          ...n,
          read_count: readCountMap[n.id] ?? 0,
          target_name: n.target_user_id ? nameMap[n.target_user_id] : undefined,
        }))
      );

      // Fetch all club users for targeting
      const { data: swimmerRows } = await supabase
        .from("swimmers")
        .select("id")
        .eq("club_id", cId);

      const { data: coachRows } = await supabase
        .from("coaches")
        .select("id")
        .eq("club_id", cId);

      const allIds = [
        ...(swimmerRows ?? []).map((s) => s.id),
        ...(coachRows ?? []).map((c) => c.id),
      ];

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", allIds.length > 0 ? allIds : ["00000000-0000-0000-0000-000000000000"]);

      setUsers(
        (allProfiles ?? []).map((p) => ({
          id: p.id,
          name: p.full_name ?? "Unknown",
          role: p.role,
        }))
      );

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!form.title.trim()) { setCreateError("Title is required."); return; }
    if (!form.message.trim()) { setCreateError("Message is required."); return; }
    if (form.target_role === "specific" && form.target_user_ids.length === 0) {
      setCreateError("Please select at least one user."); return;
    }
    if (form.type === "payment" && !form.amount_due) {
      setCreateError("Please enter the amount due for payment reminders."); return;
    }

    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    try {
      if (form.target_role === "specific") {
        for (const userId of form.target_user_ids) {
          const { error } = await supabase
            .from("notifications")
            .insert({
              club_id: clubId,
              created_by: user?.id,
              title: form.title.trim(),
              message: form.message.trim(),
              type: form.type,
              target_role: null,
              target_user_id: userId,
              amount_due: form.amount_due ? parseFloat(form.amount_due) : null,
              due_date: form.due_date || null,
              scheduled_at: form.scheduled_at || null,
            });
          if (error) throw new Error("Failed to create notification for one or more users.");
        }
      } else {
        const { error } = await supabase
          .from("notifications")
          .insert({
            club_id: clubId,
            created_by: user?.id,
            title: form.title.trim(),
            message: form.message.trim(),
            type: form.type,
            target_role: form.target_role,
            target_user_id: null,
            amount_due: form.amount_due ? parseFloat(form.amount_due) : null,
            due_date: form.due_date || null,
            scheduled_at: form.scheduled_at || null,
          });
        if (error) throw new Error("Failed to create notification.");
      }

      setShowCreateModal(false);
      setForm({
        title: "",
        message: "",
        type: "general",
        target_role: "all",
        target_user_ids: [],
        amount_due: "",
        due_date: "",
        scheduled_at: "",
      });
      await fetchData();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw new Error("Failed to delete notification.");
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getTargetLabel = (n: Notification) => {
    if (n.target_user_id && n.target_name) return `&#128100; ${n.target_name}`;
    if (n.target_role === "all") return "&#127760; Everyone";
    if (n.target_role === "coach") return "&#127941; All Coaches";
    if (n.target_role === "swimmer") return "&#127946; All Swimmers";
    return "—";
  };

  const typeBadgeColor: Record<string, string> = {
    payment: "bg-red-100 text-red-700",
    announcement: "bg-blue-100 text-blue-700",
    general: "bg-gray-100 text-gray-600",
  };

  const today = new Date().toISOString().split("T")[0];

  const isScheduled = (n: Notification) =>
    n.scheduled_at && n.scheduled_at > today;

  if (loading) {
    return (
      <div className="min-h-screen page-shell bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell bg-gray-50">
      <AdminHeader />
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-600">&larr;</Link>
              <h1 className="text-xl font-bold text-gray-800">Notifications</h1>
            </div>
            <p className="ml-6 text-sm text-gray-500">Send alerts and reminders to club members</p>
          </div>
          <button
            onClick={() => { setShowCreateModal(true); setCreateError(null); }}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition"
          >
            &#43; New Notification
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Scheduled vs Sent tabs indicator */}
        {notifications.some((n) => isScheduled(n)) && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            &#9201; {notifications.filter((n) => isScheduled(n)).length} notification{notifications.filter((n) => isScheduled(n)).length > 1 ? "s are" : " is"} scheduled for future delivery.
          </div>
        )}

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="rounded-xl bg-white p-8 shadow-sm text-center">
            <p className="text-sm text-gray-500">No notifications sent yet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-3 text-sm text-teal-600 hover:underline"
            >
              Send your first notification
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl bg-white p-4 shadow-sm ${isScheduled(n) ? "border border-amber-200" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${typeBadgeColor[n.type] ?? typeBadgeColor.general}`}>
                        {n.type}
                      </span>
                      {isScheduled(n) && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          &#9201; Scheduled
                        </span>
                      )}
                      <span
                        className="text-xs text-gray-500"
                        dangerouslySetInnerHTML={{ __html: getTargetLabel(n) }}
                      />
                      <span className="text-xs text-gray-400">{formatDate(n.created_at)}</span>
                    </div>
                    <p className="font-medium text-gray-800">{n.title}</p>
                    <p className="text-sm text-gray-600">{n.message}</p>
                    {n.amount_due && (
                      <p className="mt-1 text-sm font-medium text-red-600">Amount: ${n.amount_due}</p>
                    )}
                    {n.due_date && (
                      <p className="text-xs text-gray-500">Due: {formatDate(n.due_date)}</p>
                    )}
                    {n.scheduled_at && (
                      <p className={`text-xs ${isScheduled(n) ? "text-amber-600" : "text-gray-400"}`}>
                        {isScheduled(n) ? `Sends on: ${formatDate(n.scheduled_at)}` : `Sent on: ${formatDate(n.scheduled_at)}`}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">&#128065; {n.read_count} read</p>
                  </div>
                  <button
                    onClick={() => setDeleteId(n.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                  >
                    &#128465; Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <h2 className="font-semibold text-gray-800">New Notification</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>

              <form onSubmit={handleCreate} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Send To</label>
                  <select
                    value={form.target_role}
                    onChange={(e) => setForm((prev) => ({ ...prev, target_role: e.target.value, target_user_ids: [] }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                  >
                    {TARGET_ROLE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {form.target_role === "specific" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Select Users <span className="text-xs text-gray-400">(select multiple)</span>
                    </label>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                      {users.map((u) => (
                        <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.target_user_ids.includes(u.id)}
                            onChange={(e) => {
                              setForm((prev) => ({
                                ...prev,
                                target_user_ids: e.target.checked
                                  ? [...prev.target_user_ids, u.id]
                                  : prev.target_user_ids.filter((id) => id !== u.id),
                              }));
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-teal-500 focus:ring-teal-400"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-700">{u.name}</p>
                            <p className="text-xs text-gray-400 capitalize">{u.role}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {form.target_user_ids.length > 0 && (
                      <p className="mt-1 text-xs text-teal-600">
                        {form.target_user_ids.length} user{form.target_user_ids.length > 1 ? "s" : ""} selected
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Monthly Fee Reminder"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="e.g. Your monthly swimming fee is due. Please make payment by the due date."
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Schedule Date <span className="text-xs text-gray-400">(optional — leave blank to send immediately)</span>
                  </label>
                  <input
                    type="date"
                    value={form.scheduled_at}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setForm((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                  />
                  {form.scheduled_at && (
                    <p className="mt-1 text-xs text-amber-600">
                      &#9201; This notification will appear to users on {new Date(form.scheduled_at + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>

                {form.type === "payment" && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Amount Due ($) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount_due}
                        onChange={(e) => setForm((prev) => ({ ...prev, amount_due: e.target.value }))}
                        placeholder="e.g. 150.00"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Due Date</label>
                      <input
                        type="date"
                        value={form.due_date}
                        onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {createError && <p className="text-sm text-red-500">{createError}</p>}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition disabled:opacity-60"
                  >
                    {creating ? "Sending..." : form.scheduled_at ? "Schedule Notification" : "Send Notification"}
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
              <h2 className="mb-2 font-semibold text-gray-800">Delete Notification</h2>
              <p className="mb-6 text-sm text-gray-500">
                Are you sure you want to delete this notification? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  disabled={deleting}
                  className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}