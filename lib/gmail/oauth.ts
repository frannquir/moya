// Server-side auth-code flow for Gmail OAuth client #2 (gmail.readonly).
// Distinct from client #1 (Supabase Google login): this client redirects to
// /api/gmail/callback and exchanges the code via a raw fetch to Google.

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const PROFILE_ENDPOINT =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";

function clientConfig() {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_GMAIL_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Gmail OAuth env vars missing (GOOGLE_GMAIL_CLIENT_ID / _CLIENT_SECRET / _REDIRECT_URI)",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

// access_type=offline + prompt=consent force Google to return a refresh token;
// without them a repeat consent reuses the grant and omits it, breaking sync.
export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = clientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = clientConfig();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Google token exchange failed (${res.status}): ${await res.text()}`,
    );
  }
  return res.json();
}

// gmail.readonly is enough to read the connected address via the profile
// endpoint — no userinfo.email scope needed.
export async function fetchGmailAddress(accessToken: string): Promise<string> {
  const res = await fetch(PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(
      `Gmail profile fetch failed (${res.status}): ${await res.text()}`,
    );
  }
  const data = (await res.json()) as { emailAddress?: string };
  if (!data.emailAddress) throw new Error("Gmail profile returned no emailAddress");
  return data.emailAddress;
}
