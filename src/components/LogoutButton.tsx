"use client";

import { createClient } from "@/utils/supabase/client";

export default function LogoutButton() {
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-400 hover:text-red-500 transition"
    >
      Log out
    </button>
  );
}
