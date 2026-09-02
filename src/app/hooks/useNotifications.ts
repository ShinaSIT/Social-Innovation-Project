import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  amount_due: number | null;
  due_date: string | null;
  scheduled_at: string | null;
  created_at: string;
  created_by: string | null;
  target_role: string | null;
  target_user_id: string | null;
  is_read: boolean;
  is_dismissed: boolean;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchNotifications = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userIsAdmin = profile?.role === "admin";
    setIsAdmin(userIsAdmin);

    const today = new Date().toISOString().split("T")[0];

    // Fetch notifications visible to this user
    const { data: notifs } = await supabase
      .from("notifications")
      .select("id, title, message, type, amount_due, due_date, scheduled_at, created_at, created_by, target_role, target_user_id")
      .or(`scheduled_at.is.null,scheduled_at.lte.${today}`)
      .order("created_at", { ascending: false });

    const notifIds = (notifs ?? []).map((n) => n.id);

    const { data: reads } = await supabase
      .from("notification_reads")
      .select("notification_id, read_at, dismissed_at")
      .eq("user_id", user.id)
      .in("notification_id", notifIds.length > 0 ? notifIds : ["00000000-0000-0000-0000-000000000000"]);

    const readMap: Record<string, { read: boolean; dismissed: boolean }> = {};
    for (const r of reads ?? []) {
      readMap[r.notification_id] = {
        read: !!r.read_at,
        dismissed: !!r.dismissed_at,
      };
    }

    if (userIsAdmin) {
      // Admins see all notifications in bell but NOT as popup
      // Filter out dismissed ones for bell display
      const adminNotifs: Notification[] = (notifs ?? [])
        .filter((n) => !readMap[n.id]?.dismissed)
        .map((n) => ({
          ...n,
          is_read: readMap[n.id]?.read ?? false,
          is_dismissed: false,
        }));

      setAdminNotifications(adminNotifs);
      setUnreadCount(adminNotifs.filter((n) => !n.is_read).length);
      setNotifications([]); // Admins don't get popups
    } else {
      // Non-admins: filter out notifications they created (shouldn't happen but just in case)
      // and filter out dismissed ones
      const userNotifs: Notification[] = (notifs ?? [])
        .filter((n) => n.created_by !== user.id)
        .filter((n) => !readMap[n.id]?.dismissed)
        .map((n) => ({
          ...n,
          is_read: readMap[n.id]?.read ?? false,
          is_dismissed: false,
        }));

      setNotifications(userNotifs);
      setUnreadCount(userNotifs.filter((n) => !n.is_read).length);
      setAdminNotifications([]);
    }

    setLoading(false);
  };

  const markAsRead = async (notificationId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notification_reads")
      .upsert({
        notification_id: notificationId,
        user_id: user.id,
        read_at: new Date().toISOString(),
      }, { onConflict: "notification_id,user_id" });

    if (isAdmin) {
      setAdminNotifications((prev) =>
        prev.map((n) => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } else {
      setNotifications((prev) =>
        prev.map((n) => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    }
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const list = isAdmin ? adminNotifications : notifications;
    const unread = list.filter((n) => !n.is_read);

    for (const n of unread) {
      await supabase
        .from("notification_reads")
        .upsert({
          notification_id: n.id,
          user_id: user.id,
          read_at: new Date().toISOString(),
        }, { onConflict: "notification_id,user_id" });
    }

    if (isAdmin) {
      setAdminNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
    setUnreadCount(0);
  };

  const dismiss = async (notificationId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notification_reads")
      .upsert({
        notification_id: notificationId,
        user_id: user.id,
        read_at: new Date().toISOString(),
        dismissed_at: new Date().toISOString(),
      }, { onConflict: "notification_id,user_id" });

    if (isAdmin) {
      setAdminNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } else {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    }
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return {
    notifications,
    adminNotifications,
    unreadCount,
    loading,
    isAdmin,
    markAsRead,
    markAllAsRead,
    dismiss,
    fetchNotifications,
  };
}