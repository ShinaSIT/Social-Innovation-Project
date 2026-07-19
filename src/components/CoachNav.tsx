"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

export default function CoachNav() {
  const pathname = usePathname();

  const links = [
    { href: "/coach/students", label: "Students", icon: "👥" },
    { href: "/coach/toolkit", label: "Visual Toolkit", icon: "🖼" },
    { href: "/coach/training", label: "Training", icon: "🎓" },
  ];

  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex gap-4 text-sm">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-1 ${
              pathname === l.href
                ? "text-teal-600 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{l.icon}</span> {l.label}
          </Link>
        ))}
      </div>
      <LogoutButton />
    </div>
  );
}
