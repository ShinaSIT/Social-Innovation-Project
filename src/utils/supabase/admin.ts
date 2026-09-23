import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS and can call auth.admin.* (e.g. sending
// invites). Server-only -- never import this from a "use client" file, or the
// secret key ends up in the browser bundle.
export const createAdminClient = () => {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set.");

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
