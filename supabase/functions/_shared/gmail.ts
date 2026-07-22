// Gmail API helpers for the sync function: refresh the access token, list/fetch
// messages, parse them into our `emails` shape, and match to an ejecutado by
// expediente number. gmail.readonly is the only scope used.

import { decodeMimePart } from "../../../lib/domain/mime.ts";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Mesa de Entrada Virtual — the official court channel. Mail from this sender is
// the relevant, actionable mail and is shared with every estudio member; all
// other mail stays head-only (see emails RLS). Public gov address, safe to hardcode.
export const MEV_SENDER = "mev@scba.gov.ar";

export interface RefreshedToken {
  accessToken: string;
  expiresIn: number;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshedToken> {
  const clientId = Deno.env.get("GOOGLE_GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_GMAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_GMAIL_CLIENT_ID / _CLIENT_SECRET not set");
  }
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`token refresh failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

// Lists message ids matching `query`, capped at `limit` to bound a single run.
export async function listMessageIds(
  accessToken: string,
  query: string,
  limit: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < limit) {
    const url = new URL(`${API_BASE}/messages`);
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", String(Math.min(100, limit - ids.length)));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`messages.list failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as {
      messages?: { id: string }[];
      nextPageToken?: string;
    };
    for (const m of data.messages ?? []) ids.push(m.id);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return ids;
}

interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailPart;
}

export interface ParsedEmail {
  gmail_message_id: string;
  gmail_thread_id: string | null;
  from_email: string;
  from_name: string;
  to_emails: string[];
  subject: string;
  snippet: string;
  body_text: string;
  body_html: string;
  received_at: string | null;
  gmail_labels: string[];
}

export async function getMessage(
  accessToken: string,
  id: string,
): Promise<ParsedEmail> {
  const res = await fetch(`${API_BASE}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`messages.get failed (${res.status}): ${await res.text()}`);
  }
  return parseMessage((await res.json()) as GmailMessage);
}

function parseMessage(msg: GmailMessage): ParsedEmail {
  const headers = msg.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const { name: fromName, email: fromEmail } = parseAddress(header("From"));
  const toEmails = header("To")
    .split(",")
    .map((a) => parseAddress(a).email)
    .filter(Boolean);

  const bodies = { text: "", html: "" };
  collectBodies(msg.payload, bodies);

  const internal = msg.internalDate ? Number(msg.internalDate) : NaN;

  return {
    gmail_message_id: msg.id,
    gmail_thread_id: msg.threadId ?? null,
    from_email: fromEmail,
    from_name: fromName,
    to_emails: toEmails,
    subject: header("Subject"),
    snippet: msg.snippet ?? "",
    body_text: bodies.text,
    body_html: bodies.html,
    received_at: Number.isFinite(internal)
      ? new Date(internal).toISOString()
      : null,
    gmail_labels: msg.labelIds ?? [],
  };
}

function collectBodies(
  part: GmailPart | undefined,
  out: { text: string; html: string },
): void {
  if (!part) return;
  const mime = part.mimeType ?? "";
  if (!part.filename && part.body?.data) {
    // Decode with the part's declared charset (SCBA/MEV mail is often Latin-1),
    // not always UTF-8 — see lib/domain/mime.ts.
    const contentType = headerValue(part.headers, "Content-Type");
    if (mime === "text/plain" && !out.text) {
      out.text = decodeMimePart(part.body.data, contentType);
    } else if (mime === "text/html" && !out.html) {
      out.html = decodeMimePart(part.body.data, contentType);
    }
  }
  for (const child of part.parts ?? []) collectBodies(child, out);
}

function headerValue(
  headers: { name: string; value: string }[] | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  return headers.find((h) => h.name.toLowerCase() === lower)?.value ?? null;
}

function parseAddress(raw: string): { name: string; email: string } {
  const trimmed = raw.trim();
  const angle = trimmed.match(/^(.*)<([^>]+)>$/);
  if (angle) {
    return {
      name: angle[1].trim().replace(/^"|"$/g, ""),
      email: angle[2].trim().toLowerCase(),
    };
  }
  return { name: "", email: trimmed.toLowerCase() };
}
