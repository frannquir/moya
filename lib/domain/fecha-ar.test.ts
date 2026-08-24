import { describe, it, expect } from "vitest";
import { formatFechaAr, maskFechaAr, parseFechaAr } from "./fecha-ar";

describe("parseFechaAr", () => {
  it("reads the canonical dd/mm/yyyy", () => {
    expect(parseFechaAr("09/12/2021")).toBe("2021-12-09");
  });

  it("reads day and month without the leading zero", () => {
    expect(parseFechaAr("9/2/2021")).toBe("2021-02-09");
  });

  it("accepts the separators people actually paste", () => {
    for (const s of ["09/12/2021", "09-12-2021", "09.12.2021", "09 12 2021"]) {
      expect(parseFechaAr(s)).toBe("2021-12-09");
    }
  });

  it("accepts eight bare digits", () => {
    expect(parseFechaAr("09122021")).toBe("2021-12-09");
  });

  it("accepts a pasted ISO value, which is what the database gives you", () => {
    expect(parseFechaAr("2021-12-09")).toBe("2021-12-09");
  });

  it("pivots a two-digit year at 69", () => {
    expect(parseFechaAr("09/12/21")).toBe("2021-12-09");
    expect(parseFechaAr("09/12/68")).toBe("2068-12-09");
    expect(parseFechaAr("09/12/69")).toBe("1969-12-09");
    expect(parseFechaAr("09/12/95")).toBe("1995-12-09");
  });

  it("trims surrounding whitespace, which pasting drags along", () => {
    expect(parseFechaAr("  09/12/2021 ")).toBe("2021-12-09");
  });

  it("returns null rather than guessing at an impossible date", () => {
    // The whole point: 31/02 must not silently become 03/03.
    expect(parseFechaAr("31/02/2021")).toBeNull();
    expect(parseFechaAr("00/12/2021")).toBeNull();
    expect(parseFechaAr("09/13/2021")).toBeNull();
    expect(parseFechaAr("09/00/2021")).toBeNull();
    expect(parseFechaAr("2021-02-31")).toBeNull();
  });

  it("knows February in a leap year and out of one", () => {
    expect(parseFechaAr("29/02/2028")).toBe("2028-02-29");
    expect(parseFechaAr("29/02/2026")).toBeNull();
  });

  it("returns null for input that is not a date yet", () => {
    for (const s of ["", "   ", "09", "09/", "09/12", "abc", "09/12/2", "1/2/3/4"]) {
      expect(parseFechaAr(s)).toBeNull();
    }
  });

  it("round-trips with formatFechaAr", () => {
    for (const iso of ["2021-12-09", "1995-01-31", "2026-03-20", "2028-02-29"]) {
      expect(parseFechaAr(formatFechaAr(iso))).toBe(iso);
    }
  });
});

describe("formatFechaAr", () => {
  it("renders dd/mm/yyyy", () => {
    expect(formatFechaAr("2021-12-09")).toBe("09/12/2021");
  });

  it("keeps four digits of year, because these land in filed documents", () => {
    expect(formatFechaAr("1995-01-05")).toBe("05/01/1995");
  });

  it("is empty for anything that is not an ISO date", () => {
    for (const v of [null, undefined, "", "09/12/2021", "not a date"]) {
      expect(formatFechaAr(v)).toBe("");
    }
  });
});

describe("maskFechaAr", () => {
  it("inserts the slashes as you type", () => {
    expect(maskFechaAr("0")).toBe("0");
    expect(maskFechaAr("09")).toBe("09");
    expect(maskFechaAr("091")).toBe("09/1");
    expect(maskFechaAr("0912")).toBe("09/12");
    expect(maskFechaAr("09122")).toBe("09/12/2");
    expect(maskFechaAr("09122021")).toBe("09/12/2021");
  });

  it("re-masks a pasted value whatever its separators", () => {
    expect(maskFechaAr("09-12-2021")).toBe("09/12/2021");
    expect(maskFechaAr("2021-12-09")).toBe("20/21/1209");
  });

  it("caps at eight digits so a fat-fingered paste cannot run away", () => {
    expect(maskFechaAr("0912202199999")).toBe("09/12/2021");
  });

  it("leaves a half-typed value alone instead of rejecting it", () => {
    // Validation happens on the parsed value, never mid-keystroke.
    expect(maskFechaAr("3")).toBe("3");
    expect(maskFechaAr("31/0")).toBe("31/0");
  });
});
