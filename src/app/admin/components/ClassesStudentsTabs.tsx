"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/swimmers", label: "Students" },
  { href: "/admin/coaches", label: "Coaches" },
  { href: "/admin/term-schedules", label: "Term Schedules" },
];

// Sub-tab row shown across Classes, Students, Coaches and Term Schedules,
// since they all share one top-level nav item now. Highlights "Classes" for
// the class detail page too (/admin/classes/[id]).
export default function ClassesStudentsTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-1 border-b border-gray-200">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              active
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
