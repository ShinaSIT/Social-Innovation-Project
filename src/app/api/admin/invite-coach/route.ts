import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Admin creates a coach account: Supabase emails the coach an invite link,
// which lands on /auth/confirm and then /auth/set-password.
//
// The coach_invites row is what makes the new account a coach: when Supabase
// creates the auth user, handle_new_user() finds the invite for that email and
// creates the coach profile in the admin's club. The role in user metadata is
// ignored by the database, since anyone calling signUp can set it.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim().slice(0, 200) : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!fullName) return NextResponse.json({ error: "Please enter the coach's name." }, { status: 400 });
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin" || !me.club_id) {
    return NextResponse.json({ error: "Only club admins can invite coaches." }, { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server is missing SUPABASE_SECRET_KEY." }, { status: 500 });
  }

  const { error: inviteRowError } = await admin
    .from("coach_invites")
    .upsert({ email, full_name: fullName, club_id: me.club_id, invited_by: user.id });
  if (inviteRowError) {
    return NextResponse.json({ error: "Could not record invite: " + inviteRowError.message }, { status: 500 });
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    // Only used for routing in middleware; the database takes the role from coach_invites.
    data: { role: "coach", full_name: fullName },
    redirectTo: `${request.nextUrl.origin}/auth/confirm`,
  });

  if (inviteError || !invited.user) {
    await admin.from("coach_invites").delete().eq("email", email);
    const exists = inviteError?.message.toLowerCase().includes("already been registered");
    return NextResponse.json(
      { error: exists ? "An account with this email already exists." : "Could not send invite: " + (inviteError?.message ?? "unknown error") },
      { status: exists ? 409 : 500 }
    );
  }

  // If the email belonged to an existing unconfirmed account, Supabase re-sends
  // an invite to that account instead of creating a new one, so no coach
  // profile gets made. Surface that rather than reporting success.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", invited.user.id)
    .maybeSingle();
  if (profile?.role !== "coach") {
    await admin.from("coach_invites").delete().eq("email", email);
    return NextResponse.json(
      { error: "An account with this email already exists, so it wasn't set up as a coach." },
      { status: 409 }
    );
  }

  return NextResponse.json({ id: invited.user.id }, { status: 201 });
}
