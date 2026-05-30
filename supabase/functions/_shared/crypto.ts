// Deno mirror of lib/gmail/crypto.ts. Same AES-256-GCM scheme, same
// GMAIL_TOKEN_ENC_KEY, same "ivB64:ciphertextB64" format — so what the Next.js
// callback encrypts, this sync function can decrypt. Keep the two in sync.

const ALGO = "AES-GCM";
const KEY_BYTES = 32;

function getKeyBytes(): Uint8Array {
  const b64 = Deno.env.get("GMAIL_TOKEN_ENC_KEY");
  if (!b64) throw new Error("GMAIL_TOKEN_ENC_KEY is not set");
  const raw = fromBase64(b64);
  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `GMAIL_TOKEN_ENC_KEY must decode to ${KEY_BYTES} bytes (base64 of 32 random bytes)`,
    );
  }
  return raw;
}

function importKey(usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", getKeyBytes(), ALGO, false, usage);
}

export async function decryptToken(payload: string): Promise<string> {
  const [ivB64, ciphertextB64] = payload.split(":");
  if (!ivB64 || !ciphertextB64) throw new Error("malformed encrypted token");
  const key = await importKey(["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGO, iv: fromBase64(ivB64) },
    key,
    fromBase64(ciphertextB64),
  );
  return new TextDecoder().decode(plaintext);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
