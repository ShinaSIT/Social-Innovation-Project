import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

// Landing point for the invite email link. The Supabase "Invite user" email
// template must link here with the token hash:
//   {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite
// Verifying on the server sets the session cookie, so the coach arrives at
// /auth/set-password already signed in.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL("/auth/set-password", origin));
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
}
