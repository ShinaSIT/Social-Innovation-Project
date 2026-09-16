"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/app/components/NotificationBell";
import NotificationPopup from "@/app/components/NotificationPopup";
import UserMenu from "@/app/components/UserMenu";

// Profile lives in the right-hand group beside the notification bell, so it is
// deliberately not repeated here.
const navItems = [
  { href: "/swimmer/dashboard", label: "Dashboard", icon: "\u{1F3E0}" },
  { href: "/swimmer/timetables", label: "Timetables", icon: "\u{1F4C4}" },
  { href: "/swimmer/calendar", label: "My Schedule", icon: "\u{1F4C5}" },
];

export default function SwimmerHeader() {
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
        aria-label="Swimmer navigation"
        className="sticky top-0 z-40 mb-6 border-b border-gray-200 bg-white"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {/* Plain text, not a link: the Dashboard item sits right beside it
                and already points at the same place. */}
            <span className="text-base font-bold tracking-tight text-gray-800 sm:text-lg">AquaBridge</span>
            <span className="hidden h-4 w-px bg-gray-200 sm:block" aria-hidden="true" />
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
            <UserMenu
              profileHref="/swimmer/profile/edit"
              isActive={pathname.startsWith("/swimmer/profile")}
            />
          </div>
        </div>
      </nav>
    </>
  );
}