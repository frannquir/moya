import { describe, it, expect } from "vitest";
import {
  HONORARIO_TIPOS,
  IVA_RATE,
  APORTES_RATE,
  TAX_MULTIPLIER,
  roundJus,
  grossCapJus,
  taxJus,
  splitGross,
  remainingJus,
  remainingGrossJus,
  arsToJus,
  jusToArs,
} from "./honorarios";

describe("tax constants", () => {
  it("IVA 21% + aportes 10% are additive", () => {
    expect(IVA_RATE).toBe(0.21);
    expect(APORTES_RATE).toBe(0.1);
    expect(TAX_MULTIPLIER).toBe(1.31);
  });

  // The DB trigger hardcodes 1.31 in public.honorario_gross_cap(). If this
  // fails, the migration is out of step with the app and the two will disagree
  // about what a valid pago is.
  it("the multiplier the trigger mirrors has not drifted", () => {
    expect(TAX_MULTIPLIER).toBeCloseTo(1.31, 10);
  });
});

describe("roundJus", () => {
  it("rounds to the 2-dp precision pagos are stored at", () => {
    expect(roundJus(4.5849)).toBe(4.58);
    expect(roundJus(1.005)).toBe(1.01);
    expect(roundJus(7)).toBe(7);
  });

  it("rounds half up, matching Postgres ROUND() on NUMERIC", () => {
    // 3.5 x 1.31 = 4.585 exactly; both sides must land on 4.59, not 4.58.
    expect(roundJus(4.585)).toBe(4.59);
  });
});

describe("grossCapJus", () => {
  it("7 JUS collects up to 9.17 gross", () => {
    expect(grossCapJus(7)).toBe(9.17);
  });

  it("3.5 JUS collects up to 4.59 gross (4.585 rounded half-up)", () => {
    expect(grossCapJus(3.5)).toBe(4.59);
  });

  it("every honorario type produces a 2-dp cap", () => {
    for (const tipo of HONORARIO_TIPOS) {
      const cap = grossCapJus(tipo);
      expect(cap).toBe(roundJus(cap));
      expect(cap).toBeGreaterThan(tipo);
    }
  });

  it("zero base has a zero cap", () => {
    expect(grossCapJus(0)).toBe(0);
  });
});

describe("taxJus", () => {
  it("is the slice above the regulated fee", () => {
    expect(taxJus(7)).toBe(2.17);
    expect(taxJus(3.5)).toBe(1.09);
  });

  it("base + tax reconstitutes the gross cap", () => {
    for (const tipo of HONORARIO_TIPOS) {
      expect(roundJus(tipo + taxJus(tipo))).toBe(grossCapJus(tipo));
    }
  });
});

describe("splitGross", () => {
  it("splits a full 7 JUS collection into base / IVA / aportes", () => {
    expect(splitGross(9.17)).toEqual({ base: 7, iva: 1.47, aportes: 0.7 });
  });

  it("splits a full 3.5 JUS collection", () => {
    expect(splitGross(4.59)).toEqual({ base: 3.5, iva: 0.74, aportes: 0.35 });
  });

  it("the three parts always add back up to the gross amount", () => {
    for (const gross of [9.17, 4.59, 1, 0.01, 3.33, 12.5, 0.07]) {
      const { base, iva, aportes } = splitGross(gross);
      expect(roundJus(base + iva + aportes)).toBe(gross);
    }
  });

  it("splits a partial payment proportionally", () => {
    const { base, iva, aportes } = splitGross(1.31);
    expect(base).toBe(1);
    expect(iva).toBe(0.21);
    expect(aportes).toBe(0.1);
  });

  it("handles zero", () => {
    expect(splitGross(0)).toEqual({ base: 0, iva: 0, aportes: 0 });
  });
});

describe("remainingJus (base) vs remainingGrossJus", () => {
  it("base remaining reaches zero while gross remaining does not", () => {
    // The fee is covered; the IVA + aportes on it still are not.
    expect(remainingJus(7, 7)).toBe(0);
    expect(remainingGrossJus(7, 7)).toBe(2.17);
  });

  it("gross remaining reaches zero only at the full cap", () => {
    expect(remainingGrossJus(7, 9.17)).toBe(0);
    expect(remainingGrossJus(3.5, 4.59)).toBe(0);
  });

  it("never goes negative when overpaid", () => {
    expect(remainingGrossJus(7, 99)).toBe(0);
    expect(remainingJus(7, 99)).toBe(0);
  });

  it("nothing paid leaves the whole gross cap outstanding", () => {
    expect(remainingGrossJus(7, 0)).toBe(9.17);
  });

  it("stays free of float dust across partial payments", () => {
    // 0.1 + 0.2 territory — the reason remaining is rounded.
    expect(remainingGrossJus(7, 0.1 + 0.2)).toBe(8.87);
    expect(remainingJus(3.5, 1.1)).toBe(2.4);
  });
});

describe("boundary — what the trigger will accept", () => {
  it("a pago filling the exact gross cap is allowed", () => {
    const cap = grossCapJus(7);
    expect(remainingGrossJus(7, cap)).toBe(0);
    expect(cap).toBe(9.17);
  });

  it("the 3.5 cap is enterable at 2 dp (4.59, not 4.585)", () => {
    const cap = grossCapJus(3.5);
    expect(cap).toBe(roundJus(cap));
    // A lawyer typing the displayed maximum must not be rejected.
    expect(remainingGrossJus(3.5, cap)).toBe(0);
  });

  it("a centavo past the cap leaves nothing to collect", () => {
    expect(remainingGrossJus(7, 9.18)).toBe(0);
  });
});

describe("ARS <-> JUS conversion at the gross cap", () => {
  const JUS = 25000;

  it("round-trips the gross cap through ARS within a centavo of JUS", () => {
    const cap = grossCapJus(7);
    expect(arsToJus(jusToArs(cap, JUS), JUS)).toBeCloseTo(cap, 2);
  });

  it("returns 0 JUS when no JUS value is configured", () => {
    expect(arsToJus(100000, 0)).toBe(0);
  });
});
