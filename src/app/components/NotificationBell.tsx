"use client";

import { useState } from "react";
import { useNotifications } from "@/app/hooks/useNotifications";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function typeBadge(type: string) {
  const map: Record<string, { label: string; color: string }> = {
    payment: { label: "Payment", color: "bg-red-100 text-red-600" },
    announcement: { label: "Announcement", color: "bg-blue-100 text-blue-600" },
    general: { label: "General", color: "bg-gray-100 text-gray-600" },
  };
  return map[type] ?? map.general;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    adminNotifications,
    unreadCount,
    isAdmin,
    markAsRead,
    markAllAsRead,
    dismiss,
  } = useNotifications();

  const displayList = isAdmin ? adminNotifications : notifications;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition"
        aria-label="Notifications"
      >
        <span className="text-lg">&#128276;</span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl bg-white shadow-xl border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h3 className="font-semibold text-gray-800">Notifications</h3>
                {isAdmin && (
                  <p className="text-xs text-gray-400">Admin view — all club notifications</p>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-teal-600 hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {displayList.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500">
                  No notifications
                </p>
              ) : (
                displayList.map((n) => {
                  const badge = typeBadge(n.type);
                  return (
                    <div
                      key={n.id}
                      className={`border-b border-gray-50 px-4 py-3 cursor-pointer ${!n.is_read ? "bg-teal-50" : ""}`}
                      onClick={() => !n.is_read && markAsRead(n.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.color}`}>
                              {badge.label}
                            </span>
                            {!n.is_read && (
                              <span className="h-2 w-2 rounded-full bg-teal-500" />
                            )}
                            {isAdmin && n.scheduled_at && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                                Scheduled
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-800">{n.title}</p>
                          <p className="text-xs text-gray-600">{n.message}</p>
                          {n.amount_due && (
                            <p className="mt-1 text-xs font-medium text-red-600">
                              Amount due: ${n.amount_due}
                            </p>
                          )}
                          {n.due_date && (
                            <p className="text-xs text-gray-500">Due: {formatDate(n.due_date)}</p>
                          )}
                          {isAdmin && n.scheduled_at && (
                            <p className="text-xs text-amber-600">
                              Sends: {formatDate(n.scheduled_at)}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-gray-400">{formatDate(n.created_at)}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                          className="text-gray-300 hover:text-gray-500 text-lg leading-none"
                          aria-label="Dismiss"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}