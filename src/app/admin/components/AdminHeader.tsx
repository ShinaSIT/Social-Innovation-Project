"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
  { href: "/admin/reports", label: "Reports", icon: "\u{1F4C2}" },
];

export default function AdminHeader() {
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
    </nav>
  );
}
