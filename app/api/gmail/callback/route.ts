import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, fetchGmailAddress } from "@/lib/gmail/oauth";
import { encryptToken } from "@/lib/gmail/crypto";
import { NextResponse } from "next/server";

// Gmail OAuth client #2 redirect target. Verifies the single-use state, exchanges
// the code for tokens, encrypts the refresh token, and upserts the estudio's
// connection. All writes go through the service-role admin client (bypasses RLS).
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/mail?gmail=error&reason=${reason}`);

  const oauthError = searchParams.get("error");
  if (oauthError) return fail(oauthError);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return fail("missing_params");

  const admin = createAdminClient();

  // Single-use state: read it, then delete it regardless of outcome.
  const { data: stateRow } = await admin
    .from("gmail_oauth_states")
    .select("estudio_id, created_by_user_id, expires_at")
    .eq("state", state)
    .maybeSingle();

  if (!stateRow) return fail("invalid_state");
  await admin.from("gmail_oauth_states").delete().eq("state", state);
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return fail("expired_state");
  }

  let accessToken: string;
  let refreshToken: string;
  let scope: string;
  let expiresIn: number;
  let googleEmail: string;
  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) return fail("no_refresh_token");
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    scope = tokens.scope;
    expiresIn = tokens.expires_in;
    googleEmail = await fetchGmailAddress(accessToken);
  } catch {
    return fail("token_exchange");
  }

  const { error } = await admin.from("gmail_connections").upsert(
    {
      estudio_id: stateRow.estudio_id,
      connected_by_user_id: stateRow.created_by_user_id,
      google_email: googleEmail,
      access_token: accessToken,
      refresh_token_encrypted: await encryptToken(refreshToken),
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scope,
      last_sync_error: null,
      archived_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "estudio_id" },
  );
  if (error) return fail("persist");

  return NextResponse.redirect(`${origin}/mail?gmail=connected`);
}
