import { describe, it, expect } from "vitest";
import {
  canonicalCharset,
  charsetFromContentType,
  decodeMimePart,
} from "./mime";

// Build a base64url payload (Gmail's body.data shape) from raw bytes.
function toBase64Url(bytes: number[]): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// "Olavarría" — the seat city that arrives mojibake'd from SCBA/MEV when decoded
// as UTF-8. In Latin-1 / windows-1252 the í is a single 0xED byte; in UTF-8 it is
// the two-byte sequence 0xC3 0xAD.
const LATIN1_OLAVARRIA = toBase64Url([
  0x4f, 0x6c, 0x61, 0x76, 0x61, 0x72, 0x72, 0xed, 0x61,
]);
const UTF8_OLAVARRIA = toBase64Url([...new TextEncoder().encode("Olavarría")]);

describe("charsetFromContentType", () => {
  it("extracts a quoted charset", () => {
    expect(charsetFromContentType('text/plain; charset="ISO-8859-1"')).toBe(
      "iso-8859-1",
    );
  });
  it("extracts an unquoted charset and ignores trailing params", () => {
    expect(charsetFromContentType("text/plain; charset=utf-8; format=flowed")).toBe(
      "utf-8",
    );
  });
  it("returns null when no charset is declared", () => {
    expect(charsetFromContentType("text/html")).toBeNull();
    expect(charsetFromContentType(null)).toBeNull();
    expect(charsetFromContentType(undefined)).toBeNull();
  });
});

describe("canonicalCharset", () => {
  it("maps the Latin-1 / windows-1252 family to windows-1252", () => {
    expect(canonicalCharset("iso-8859-1")).toBe("windows-1252");
    expect(canonicalCharset("latin1")).toBe("windows-1252");
    expect(canonicalCharset("us-ascii")).toBe("windows-1252");
    expect(canonicalCharset("windows-1252")).toBe("windows-1252");
    expect(canonicalCharset("cp1252")).toBe("windows-1252");
  });
  it("keeps utf-8 and defaults missing to utf-8", () => {
    expect(canonicalCharset("utf-8")).toBe("utf-8");
    expect(canonicalCharset(null)).toBe("utf-8");
    expect(canonicalCharset("")).toBe("utf-8");
  });
});

describe("decodeMimePart", () => {
  it("round-trips a Latin-1 part declared ISO-8859-1", () => {
    expect(
      decodeMimePart(LATIN1_OLAVARRIA, 'text/plain; charset="ISO-8859-1"'),
    ).toBe("Olavarría");
  });

  it("round-trips a UTF-8 part declared utf-8", () => {
    expect(decodeMimePart(UTF8_OLAVARRIA, "text/plain; charset=utf-8")).toBe(
      "Olavarría",
    );
  });

  it("defaults to UTF-8 when the part has no Content-Type", () => {
    expect(decodeMimePart(UTF8_OLAVARRIA, null)).toBe("Olavarría");
    expect(decodeMimePart(UTF8_OLAVARRIA)).toBe("Olavarría");
  });

  it("does not recover Latin-1 bytes when the part declares no charset", () => {
    // No charset declared → decoded as UTF-8, so Latin-1 bytes stay mojibake'd.
    expect(decodeMimePart(LATIN1_OLAVARRIA, null)).not.toBe("Olavarría");
  });
});
