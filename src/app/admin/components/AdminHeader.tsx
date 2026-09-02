"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/app/components/NotificationBell";
import NotificationPopup from "@/app/components/NotificationPopup";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
  { href: "/admin/classes", label: "Classes", icon: "\u{1F465}" },
  { href: "/admin/calendar", label: "Calendar", icon: "\u{1F5D3}\u{FE0F}" },
  { href: "/admin/term-schedules", label: "Term Schedules", icon: "\u{1F4C5}" },
  { href: "/admin/reports", label: "Reports", icon: "\u{1F4C2}" },
  { href: "/admin/toolkit", label: "Toolkit", icon: "\u{1F4E6}" },
  { href: "/admin/notifications", label: "Notifications", icon: "\u{1F514}" },
];

export default function AdminHeader() {
  const pathname = usePathname();

  return (
    <>
      <NotificationPopup /><a
      
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-teal-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>
      <nav
        aria-label="Admin navigation"
        className="mb-6 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3"
      >
        <div className="flex gap-4 text-sm">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-1 ${
                  isActive ? "text-teal-600 font-medium" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span> {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
        </div>
      </nav>
    </>
  );
}