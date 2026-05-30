// AES-256-GCM token encryption built on Web Crypto, so it runs identically in
// Next.js route handlers (Node) and the Edge sync function (Deno). The Gmail
// callback encrypts the refresh token here; the sync decrypts it with the same
// GMAIL_TOKEN_ENC_KEY. A key mismatch decrypts to garbage, so both runtimes must
// share the exact same key.
//
// Stored format: "ivB64:ciphertextB64". Web Crypto appends the 16-byte GCM auth
// tag to the ciphertext, so it is not stored separately.

const ALGO = "AES-GCM";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getKeyBytes(): Uint8Array<ArrayBuffer> {
  const b64 = process.env.GMAIL_TOKEN_ENC_KEY;
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

export async function encryptToken(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await importKey(["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
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

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
