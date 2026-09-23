import type { SupabaseClient } from "@supabase/supabase-js";

// Which swimmer this viewer sees: themself, or (for a caregiver account) the
// swimmer they're linked to via caregiver_swimmers.
export async function resolveSwimmerId(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: caregiverLinks } = await supabase
    .from("caregiver_swimmers")
    .select("swimmer_id")
    .eq("caregiver_id", user.id)
    .limit(1);

  return caregiverLinks && caregiverLinks.length > 0 ? caregiverLinks[0].swimmer_id : user.id;
}
