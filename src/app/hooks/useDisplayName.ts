import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

/**
 * The signed-in user's name, for display in navigation.
 *
 * Returns null until it resolves (and if no name can be found at all), so
 * callers should render their own fallback label rather than an empty string.
 *
 * `profiles.full_name` is the source of truth -- it is what the profile form
 * and the coach's add-student flow write. `user_metadata.full_name` is only a
 * fallback for accounts whose profile row is unreadable or not created yet: it
 * is set once at sign-up and never updated, so it goes stale if the name is
 * later edited.
 */
export function useDisplayName(): string | null {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      const name =
        data?.full_name ??
        (user.user_metadata?.full_name as string | undefined) ??
        null;
      if (name) setDisplayName(name);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return displayName;
}
