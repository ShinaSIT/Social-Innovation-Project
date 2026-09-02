"use client";

import { useState, useEffect } from "react";
import { useNotifications } from "@/app/hooks/useNotifications";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export default function NotificationPopup() {
  const { notifications, unreadCount, isAdmin, markAsRead, dismiss } = useNotifications();
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  const unread = notifications.filter((n) => !n.is_read);

  useEffect(() => {
    // Never show popup for admins
    if (isAdmin) return;
    if (unread.length > 0) {
      setVisible(true);
      setCurrent(0);
    }
  }, [unreadCount, isAdmin]);

  if (isAdmin || !visible || unread.length === 0) return null;

  const notif = unread[current];

  const handleDismiss = async () => {
    await dismiss(notif.id);
    if (current >= unread.length - 1) {
      setVisible(false);
    }
  };

  const handleNext = async () => {
    await markAsRead(notif.id);
    if (current >= unread.length - 1) {
      setVisible(false);
    } else {
      setCurrent((prev) => prev + 1);
    }
  };

  const typeIcon: Record<string, string> = {
    payment: "&#128176;",
    announcement: "&#128226;",
    general: "&#128276;",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className={`rounded-t-xl p-4 ${
          notif.type === "payment" ? "bg-red-50" :
          notif.type === "announcement" ? "bg-blue-50" :
          "bg-teal-50"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-xl"
                dangerouslySetInnerHTML={{ __html: typeIcon[notif.type] ?? typeIcon.general }}
              />
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                notif.type === "payment" ? "bg-red-100 text-red-700" :
                notif.type === "announcement" ? "bg-blue-100 text-blue-700" :
                "bg-teal-100 text-teal-700"
              }`}>
                {notif.type}
              </span>
            </div>
            {unread.length > 1 && (
              <span className="text-xs text-gray-500">
                {current + 1} of {unread.length}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-base font-semibold text-gray-800">{notif.title}</h2>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-700">{notif.message}</p>
          {notif.amount_due && (
            <div className="rounded-lg bg-red-50 px-4 py-3">
              <p className="text-xs text-gray-500">Amount Due</p>
              <p className="text-lg font-bold text-red-600">${notif.amount_due}</p>
            </div>
          )}
          {notif.due_date && (
            <div className="rounded-lg bg-gray-50 px-4 py-2">
              <p className="text-xs text-gray-500">Due Date</p>
              <p className="text-sm font-medium text-gray-800">{formatDate(notif.due_date)}</p>
            </div>
          )}
          <p className="text-xs text-gray-400">{formatDate(notif.created_at)}</p>
        </div>

        <div className="flex gap-3 border-t border-gray-100 p-4">
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Dismiss
          </button>
          <button
            onClick={handleNext}
            className="flex-1 rounded-full bg-teal-500 py-2.5 text-sm font-medium text-white hover:bg-teal-600 transition"
          >
            {unread.length > 1 && current < unread.length - 1 ? "Next" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}