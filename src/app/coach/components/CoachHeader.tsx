"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/coach/dashboard", label: "Dashboard", icon: "\u{1F3E0}" },
  { href: "/coach/students", label: "Students", icon: "\u{1F465}" },
  { href: "/coach/toolkit", label: "Visual Toolkit", icon: "\u{1F5BC}" },
  { href: "/coach/training", label: "Training", icon: "\u{1F393}" },
  
];

export default function CoachHeader() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex gap-4 text-sm">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 ${
                isActive ? "text-teal-600 font-medium" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>{item.icon}</span> {item.label}
            </Link>
          );
        })}
      </div>
      <Link
        href="/coach/profile"
        className={`flex items-center gap-1 text-sm ${
          pathname === "/coach/profile" ? "text-teal-600 font-medium" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <span>{"\u{1F464}"}</span> Profile
      </Link>
    </nav>
  );
}
