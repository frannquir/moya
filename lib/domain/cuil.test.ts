import { describe, it, expect } from "vitest";
import {
  CUIL_REGEX,
  cuilCheckDigit,
  cuilDigits,
  cuilToDni,
  dniToCuil,
  formatCuil,
  formatDni,
  isValidCuil,
} from "./cuil";

// PII rule: every fixture here is SYNTHETIC. The CUILs in the firm's Word
// documents belong to real people and must never reach a test file. These were
// generated with dniToCuil from invented DNIs, so they are check-digit-valid
// without being anybody's.
const VALID = {
  masculino: "20-12345678-6",
  femenino: "27-12345678-0",
  // resto === 1 -> the prefix flips to 23 and the check digit is 9 / 4.
  flipMasculino: "23-11222333-9",
  flipFemenino: "23-01234567-4",
  // 7-digit DNI: stored zero-padded to 8 inside the CUIL.
  padded: "20-09876543-4",
  // Juridical prefixes - an empleador CUIT is the same construction.
  cuit30: "30-70123456-8",
  cuit33: "33-70123456-7",
  cuit34: "34-70123456-3",
};

describe("CUIL_REGEX", () => {
  it("accepts every allowed prefix", () => {
    for (const p of ["20", "23", "24", "27", "30", "33", "34"]) {
      expect(CUIL_REGEX.test(`${p}-12345678-0`)).toBe(true);
    }
  });

  it("rejects an unknown prefix, a short DNI block and a missing check digit", () => {
    expect(CUIL_REGEX.test("21-12345678-0")).toBe(false);
    expect(CUIL_REGEX.test("20-1234567-0")).toBe(false);
    expect(CUIL_REGEX.test("20-12345678")).toBe(false);
  });
});

describe("isValidCuil", () => {
  it("accepts check-digit-valid CUILs", () => {
    for (const cuil of Object.values(VALID)) {
      expect(isValidCuil(cuil)).toBe(true);
    }
  });

  it("rejects a wrong check digit", () => {
    // Same digits, every other check digit must fail.
    for (let v = 0; v <= 9; v++) {
      const candidate = `20-12345678-${v}`;
      expect(isValidCuil(candidate)).toBe(v === 6);
    }
  });

  it("rejects an unknown prefix even when the check digit computes", () => {
    // 21 is not in the allowed set; the prefix guard has to catch it.
    expect(CUIL_REGEX.test("21-12345678-4")).toBe(false);
    expect(isValidCuil("21-12345678-4")).toBe(false);
  });

  it("accepts input that is only missing its dashes", () => {
    expect(isValidCuil("20123456786")).toBe(true);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "   ", "abc", "20-12345678", "20-1234567890-1", "not a cuil"]) {
      expect(isValidCuil(bad)).toBe(false);
    }
  });
});

describe("cuilCheckDigit", () => {
  it("returns null when resto === 1, the case that has no valid check digit", () => {
    // 20-11222333 is the pre-flip form of VALID.flipMasculino.
    expect(cuilCheckDigit("2011222333")).toBeNull();
  });

  it("returns null for anything that is not exactly ten digits", () => {
    expect(cuilCheckDigit("201234567")).toBeNull();
    expect(cuilCheckDigit("20123456789")).toBeNull();
    expect(cuilCheckDigit("20-1234567")).toBeNull();
  });
});

describe("formatCuil", () => {
  it("masks progressively as the user types", () => {
    expect(formatCuil("")).toBe("");
    expect(formatCuil("2")).toBe("2");
    expect(formatCuil("20")).toBe("20");
    expect(formatCuil("201")).toBe("20-1");
    expect(formatCuil("2012345678")).toBe("20-12345678");
    expect(formatCuil("20123456786")).toBe("20-12345678-6");
  });

  it("drops non-digits and anything past eleven digits", () => {
    expect(formatCuil("20.123.456/78-6")).toBe("20-12345678-6");
    expect(formatCuil("201234567869999")).toBe("20-12345678-6");
  });

  it("is idempotent on an already formatted value", () => {
    expect(formatCuil(VALID.masculino)).toBe(VALID.masculino);
  });
});

describe("cuilToDni", () => {
  it("strips prefix, dashes and check digit", () => {
    expect(cuilToDni(VALID.masculino)).toBe("12345678");
  });

  it("strips the zero pad on a 7-digit DNI (gotcha #36)", () => {
    expect(cuilToDni(VALID.padded)).toBe("9876543");
    expect(cuilToDni(VALID.flipFemenino)).toBe("1234567");
  });

  it("returns empty for anything that is not a complete CUIL", () => {
    for (const bad of ["", "20-1234567", "abc", "2012345678"]) {
      expect(cuilToDni(bad)).toBe("");
    }
  });
});

describe("formatDni", () => {
  it("groups with dots", () => {
    expect(formatDni("23890549")).toBe("23.890.549");
    expect(formatDni("9876543")).toBe("9.876.543");
    expect(formatDni("123456")).toBe("123.456");
    expect(formatDni("999")).toBe("999");
  });

  it("drops the zero pad and tolerates an already grouped value", () => {
    expect(formatDni("09876543")).toBe("9.876.543");
    expect(formatDni("23.890.549")).toBe("23.890.549");
    expect(formatDni("")).toBe("");
  });
});

describe("dniToCuil", () => {
  it("derives the masculine and feminine forms", () => {
    expect(dniToCuil("12345678", "M")).toBe(VALID.masculino);
    expect(dniToCuil("12345678", "F")).toBe(VALID.femenino);
  });

  it("flips to the 23 prefix when resto === 1", () => {
    expect(dniToCuil("11222333", "M")).toBe(VALID.flipMasculino);
    expect(dniToCuil("1234567", "F")).toBe(VALID.flipFemenino);
  });

  it("zero-pads a 7-digit DNI", () => {
    expect(dniToCuil("9876543", "M")).toBe(VALID.padded);
  });

  it("round-trips: every derived CUIL is valid and returns the original DNI", () => {
    const dnis = ["12345678", "11222333", "9876543", "1234567", "30111222", "8000001"];
    for (const dni of dnis) {
      for (const sexo of ["M", "F"] as const) {
        const cuil = dniToCuil(dni, sexo);
        expect(isValidCuil(cuil)).toBe(true);
        expect(cuilToDni(cuil)).toBe(dni);
      }
    }
  });

  it("returns empty for a DNI that is missing or too long", () => {
    expect(dniToCuil("", "M")).toBe("");
    expect(dniToCuil("123456789", "M")).toBe("");
  });
});

describe("cuilDigits", () => {
  it("keeps only digits", () => {
    expect(cuilDigits("20-12345678-6")).toBe("20123456786");
    expect(cuilDigits("  20 12 ")).toBe("2012");
    expect(cuilDigits("abc")).toBe("");
  });
});
