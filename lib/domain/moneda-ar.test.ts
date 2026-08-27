import { describe, it, expect } from "vitest";
import {
  digitsBefore,
  formatMonedaAr,
  maskMonedaAr,
  offsetAfterDigits,
  parseMonedaAr,
} from "./moneda-ar";

// deuda_inicial feeds generateLiquidacion and {{MONTO_LETRAS}}; monto_acuerdo
// feeds the convenio's instalments. A wrong parse here is a wrong number in a
// filed document, so these cover the ambiguous shapes rather than the happy path.

describe("parseMonedaAr — Argentine input", () => {
  it("reads the canonical grouped form", () => {
    expect(parseMonedaAr("1.234.567,89")).toBe(1234567.89);
  });

  it("reads a comma decimal without grouping", () => {
    expect(parseMonedaAr("1234567,89")).toBe(1234567.89);
    expect(parseMonedaAr("0,05")).toBe(0.05);
  });

  it("reads a bare integer", () => {
    expect(parseMonedaAr("270000")).toBe(270000);
  });

  it("reads a grouped integer with no decimals", () => {
    expect(parseMonedaAr("1.234.567")).toBe(1234567);
    expect(parseMonedaAr("270.000")).toBe(270000);
  });

  it("strips the currency symbol and spaces the way a paste carries them", () => {
    expect(parseMonedaAr("$ 1.234.567,89")).toBe(1234567.89);
    expect(parseMonedaAr("  $270.000  ")).toBe(270000);
  });

  it("round-trips whatever formatMonedaAr produced", () => {
    for (const n of [0, 0.05, 1234.5, 270000, 1234567.89, 9530792.4]) {
      expect(parseMonedaAr(formatMonedaAr(n))).toBeCloseTo(n, 2);
    }
  });
});

describe("parseMonedaAr — the ambiguous dot", () => {
  it("one dot with exactly three digits after it is grouping, the Argentine reading", () => {
    expect(parseMonedaAr("1.234")).toBe(1234);
    expect(parseMonedaAr("270.000")).toBe(270000);
  });

  it("one dot with one or two digits after it is a decimal point", () => {
    // What a spreadsheet or the database hands you.
    expect(parseMonedaAr("1234.5")).toBe(1234.5);
    expect(parseMonedaAr("1234.56")).toBe(1234.56);
  });

  it("several dots can only be grouping", () => {
    expect(parseMonedaAr("1.234.567")).toBe(1234567);
  });

  it("reads a pasted en-US value, where the last separator is the dot", () => {
    expect(parseMonedaAr("1,234,567.89")).toBe(1234567.89);
    expect(parseMonedaAr("1,234.56")).toBe(1234.56);
  });
});

describe("parseMonedaAr — rejection", () => {
  it("returns null, never 0, for input that is not an amount", () => {
    // 0 is a legitimate amount and must not be what a typo becomes.
    for (const s of ["", "   ", "$", "-", "abc", "1..2", "1,,2", "1.2.3,4,5"]) {
      expect(parseMonedaAr(s)).toBeNull();
    }
  });

  it("rejects more than two decimals rather than silently rounding", () => {
    expect(parseMonedaAr("1234,567")).toBeNull();
  });

  it("keeps a negative sign", () => {
    expect(parseMonedaAr("-1.234,56")).toBe(-1234.56);
  });
});

describe("formatMonedaAr", () => {
  it("always shows two decimals", () => {
    expect(formatMonedaAr(270000)).toBe("270.000,00");
    expect(formatMonedaAr(1234567.89)).toBe("1.234.567,89");
    expect(formatMonedaAr(0)).toBe("0,00");
  });

  it("is empty for a missing value", () => {
    expect(formatMonedaAr(null)).toBe("");
    expect(formatMonedaAr(undefined)).toBe("");
    expect(formatMonedaAr(NaN)).toBe("");
  });
});

describe("maskMonedaAr", () => {
  it("groups the integer part as you type", () => {
    expect(maskMonedaAr("1")).toBe("1");
    expect(maskMonedaAr("1234")).toBe("1.234");
    expect(maskMonedaAr("1234567")).toBe("1.234.567");
  });

  it("leaves a trailing comma alone instead of completing it", () => {
    // Jumping to "1.234,00" under the cursor would fight the typist.
    expect(maskMonedaAr("1234,")).toBe("1.234,");
    expect(maskMonedaAr("1234,5")).toBe("1.234,5");
  });

  it("caps the decimals at two", () => {
    expect(maskMonedaAr("1234,5678")).toBe("1.234,56");
  });

  it("re-masks a pasted formatted value without changing it", () => {
    expect(maskMonedaAr("1.234.567,89")).toBe("1.234.567,89");
  });

  it("is empty for empty input", () => {
    expect(maskMonedaAr("")).toBe("");
    expect(maskMonedaAr("$")).toBe("");
  });
});

describe("caret helpers", () => {
  it("counts digits before the caret, ignoring separators", () => {
    expect(digitsBefore("1.234.567", 5)).toBe(4); // "1.234" holds four digits
    expect(digitsBefore("1.234", 0)).toBe(0);
  });

  it("finds the offset just after N digits", () => {
    expect(offsetAfterDigits("1.234.567", 4)).toBe(5);
    expect(offsetAfterDigits("1.234", 0)).toBe(0);
    expect(offsetAfterDigits("1.234", 99)).toBe(5);
  });

  it("round-trips a caret across a re-mask, which is what keeps typing usable", () => {
    const before = "1.234";
    const caret = 3; // "1.2" precedes the caret -> two digits
    const n = digitsBefore(before, caret);
    const after = maskMonedaAr("12345");
    expect(after).toBe("12.345");
    // Two digits into "12.345" is offset 2 — right after "12", before the dot.
    expect(offsetAfterDigits(after, n)).toBe(2);
  });
});
