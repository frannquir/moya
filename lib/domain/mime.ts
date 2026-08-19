// Charset-aware MIME part decoding, shared by the gmail-sync Edge function
// (supabase/functions/_shared/gmail.ts) and covered by Vitest. Pure TS with no
// Deno/Node-specific imports: `atob`, `TextDecoder` and `Uint8Array` are globals
// in both runtimes, so the same code decodes mail bytes in Deno and in tests.
//
// Why this exists: SCBA/MEV (Mesa de Entrada Virtual) mail parts are commonly
// labelled ISO-8859-1 / Windows-1252, not UTF-8. Decoding those bytes as UTF-8
// produced mojibake ("Olavarr¡a", mangled accented surnames), which corrupted the
// ejecutado names we pre-fill from parsed mail. The bytes must be decoded with the
// charset the part actually declares.

// Map a charset label seen in a Content-Type header to a TextDecoder-supported
// label. ISO-8859-1 / latin1 / us-ascii are decoded as windows-1252: it is a
// superset of Latin-1 that also maps the 0x80-0x9F range (smart quotes, etc.)
// instead of emitting control chars, and it round-trips the accented characters
// in Argentine court mail. Unknown or absent labels fall back to UTF-8.
export function canonicalCharset(charset: string | null | undefined): string {
  const c = (charset ?? "").trim().toLowerCase();
  if (!c) return "utf-8";
  switch (c) {
    case "iso-8859-1":
    case "iso8859-1":
    case "latin1":
    case "latin-1":
    case "us-ascii":
    case "ascii":
    case "windows-1252":
    case "cp1252":
      return "windows-1252";
    case "utf-8":
    case "utf8":
      return "utf-8";
    default:
      // Let TextDecoder try the raw label; decodeMimePart falls back to UTF-8 if
      // it is not a recognized encoding.
      return c;
  }
}

// Extract the charset parameter from a MIME Content-Type header value, e.g.
// `text/plain; charset="ISO-8859-1"` -> "iso-8859-1". Null when no charset is
// declared (the caller then defaults to UTF-8).
export function charsetFromContentType(
  contentType: string | null | undefined,
): string | null {
  if (!contentType) return null;
  const m = contentType.match(/charset\s*=\s*"?([^";]+)"?/i);
  return m ? m[1].trim().toLowerCase() : null;
}

// base64url (Gmail API `body.data`) -> raw bytes. atob is a global in Deno and in
// Node >= 16, so this needs no Buffer/Deno import.
export function base64UrlToBytes(data: string): Uint8Array {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Decode a base64url-encoded MIME part using the charset declared in its
// Content-Type header, falling back to UTF-8 when the charset is missing or not
// supported by the runtime's TextDecoder. Never throws on a mail body.
export function decodeMimePart(
  data: string,
  contentType?: string | null,
): string {
  const bytes = base64UrlToBytes(data);
  const label = canonicalCharset(charsetFromContentType(contentType));
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
