"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useDisplayName } from "@/app/hooks/useDisplayName";

/**
 * The signed-in user's name in the nav bar, opening a menu with links to their
 * profile and a log out action. Replaces the per-page "Log Out" buttons that
 * used to sit at the bottom of the profile pages.
 */
export default function UserMenu({
  profileHref,
  isActive,
}: {
  profileHref: string;
  isActive: boolean;
}) {
  const displayName = useDisplayName();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // Escape returns focus to the trigger, so keyboard users are not dumped
    // back at the top of the document.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // A full navigation rather than router.push: it drops any client-side
    // state held by the page we are leaving.
    window.location.href = "/login";
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1 text-sm ${
          isActive ? "text-teal-600 font-medium" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <span aria-hidden="true">{"\u{1F464}"}</span>
        <span className="max-w-[8rem] truncate sm:max-w-[12rem]" title={displayName ?? undefined}>
          {displayName ?? "Profile"}
        </span>
        <span aria-hidden="true" className="text-[0.6rem]">{"▼"}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          // left-0 on small screens: when the nav wraps, this group sits near the
          // left of its own row, and anchoring the menu's right edge to the
          // button would push it off the left of the screen.
          className="absolute left-0 z-50 mt-2 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg sm:left-auto sm:right-0"
        >
          <Link
            role="menuitem"
            href={profileHref}
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            My Profile
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
