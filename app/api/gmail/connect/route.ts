import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAuthUrl } from "@/lib/gmail/oauth";
import { NextResponse } from "next/server";

const STATE_TTL_MS = 10 * 60 * 1000;

// Starts the Gmail OAuth flow for the estudio's shared inbox. Only the head may
// connect it; members never link their own mail.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: membership } = await supabase
    .from("estudio_members")
    .select("estudio_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "head") {
    return NextResponse.redirect(`${origin}/mail?gmail=error&reason=not_head`);
  }

  const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const admin = createAdminClient();
  const { error } = await admin.from("gmail_oauth_states").insert({
    state,
    estudio_id: membership.estudio_id,
    created_by_user_id: user.id,
    expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  });
  if (error) {
    return NextResponse.redirect(`${origin}/mail?gmail=error&reason=state_init`);
  }

  return NextResponse.redirect(buildAuthUrl(state));
}
