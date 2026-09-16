import { describe, it, expect } from "vitest";
import {
  HONORARIO_JUS_DEFAULT,
  IVA_RATE,
  APORTES_RATE,
  TAX_MULTIPLIER,
  roundJus,
  grossCapJus,
  taxJus,
  splitGross,
  remainingJus,
  remainingGrossJus,
  composeGross,
  techoHonorario,
  formatArs,
  formatArsExacto,
  arsToJus,
  jusToArs,
  roundCentavos,
  truncJus,
  arsToBaseJus,
  baseJusToArs,
  jusToArsExacto,
  composeGrossArs,
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

  it("every honorario amount produces a 2-dp cap", () => {
    // The amount is free now, so this has to hold for arbitrary figures, not
    // just the two the UI used to offer.
    for (const monto of [0.5, 1, 3.5, 5, 7, 8.25, 12, 20.4]) {
      const cap = grossCapJus(monto);
      expect(cap).toBe(roundJus(cap));
      expect(cap).toBeGreaterThan(monto);
    }
  });

  it("scales a free amount by the same 1.31", () => {
    expect(grossCapJus(5)).toBe(6.55);
    expect(grossCapJus(10)).toBe(13.1);
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
    for (const tipo of [0.5, 3.5, 5, 7, 8.25]) {
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

describe("HONORARIO_JUS_DEFAULT", () => {
  it("is 7, the amount the card starts at", () => {
    expect(HONORARIO_JUS_DEFAULT).toBe(7);
  });
});

describe("composeGross", () => {
  it("splits 7 JUS into fee + IVA + aportes that add back to the cap", () => {
    const c = composeGross(7);
    expect(c).toEqual({ base: 7, iva: 1.47, aportes: 0.7, total: 9.17 });
    expect(roundJus(c.base + c.iva + c.aportes)).toBe(c.total);
  });

  it("reconciles for every amount, residue absorbed by aportes", () => {
    // The card prints these four numbers as an addition; one that does not add
    // up reads as a bug even when each line is individually correct.
    for (const monto of [0.5, 1, 3.5, 5, 7, 8.25, 12, 20.4, 33.33]) {
      const c = composeGross(monto);
      expect(c.total).toBe(grossCapJus(monto));
      expect(roundJus(c.base + c.iva + c.aportes)).toBe(c.total);
    }
  });

  it("agrees with splitGross, which works from the total backwards", () => {
    const c = composeGross(7);
    expect(splitGross(c.total)).toEqual({ base: 7, iva: 1.47, aportes: 0.7 });
  });
});

describe("techoHonorario", () => {
  const JUS = 53232; // vigente desde 2026-08-01

  const legal = (pagadoJus: number, pagadoArs = 0) =>
    techoHonorario({
      baseJus: 7,
      maxAcordadoArs: null,
      pagadoJus,
      pagadoArs,
      jusValue: JUS,
    });

  const acordado = (maxAcordadoArs: number | null, pagadoArs: number) =>
    techoHonorario({
      baseJus: 7,
      maxAcordadoArs,
      pagadoJus: 0,
      pagadoArs,
      jusValue: JUS,
    });

  it("falls back to base x 1.31, in JUS, when nothing was settled", () => {
    const t = legal(0);
    expect(t.tipo).toBe("legal");
    expect(t.capJus).toBe(9.17);
    expect(t.capArs).toBe(488137); // 9.17 x 53232
  });

  it("a settled maximum wins, below or above the legal cap", () => {
    expect(acordado(300_000, 0).capArs).toBe(300_000); // quita
    expect(acordado(600_000, 0).capArs).toBe(600_000); // agreed extra
  });

  it("ignores a non-positive maximum instead of freezing collection", () => {
    expect(acordado(0, 0).tipo).toBe("legal");
    expect(acordado(-1, 0).tipo).toBe("legal");
  });

  it("drops the JUS figures once a peso amount was agreed", () => {
    // Converting an agreed peso figure back to JUS would invent precision the
    // agreement never had, and would move the next time the JUS does.
    const t = acordado(257_102, 0);
    expect(t.capJus).toBeNull();
    expect(t.pendienteJus).toBeNull();
  });

  it("measures the settled maximum against the pesos actually received", () => {
    expect(acordado(257_102, 100_000).pendienteArs).toBe(157_102);
    expect(acordado(257_102, 257_102).pendienteArs).toBe(0);
  });

  it("measures the legal ceiling against the JUS collected", () => {
    expect(legal(3).pendienteJus).toBe(6.17);
    expect(legal(9.17).pendienteJus).toBe(0);
  });

  it("never goes negative, so an over-collected honorario reads as settled", () => {
    expect(legal(10).pendienteJus).toBe(0);
    expect(acordado(257_102, 300_000).pendienteArs).toBe(0);
  });

  it("a quita closes a honorario the legal cap would leave open", () => {
    // 5 JUS collected: still 4.17 short of the 9.17 legal cap, but square with
    // the debtor if that is what was agreed in pesos.
    expect(legal(5).pendienteJus).toBe(4.17);
    const cincoJusEnPesos = 5 * JUS;
    expect(acordado(cincoJusEnPesos, cincoJusEnPesos).pendienteArs).toBe(0);
  });

  it("a negotiated ceiling does not drift when the JUS moves", () => {
    // The whole reason max_acordado is stored in pesos: the agreed figure is the
    // agreed figure whatever the JUS does afterwards.
    const hoy = techoHonorario({
      baseJus: 7,
      maxAcordadoArs: 257_102,
      pagadoJus: 0,
      pagadoArs: 0,
      jusValue: JUS,
    });
    const despues = techoHonorario({
      baseJus: 7,
      maxAcordadoArs: 257_102,
      pagadoJus: 0,
      pagadoArs: 0,
      jusValue: JUS * 2,
    });
    expect(despues.capArs).toBe(hoy.capArs);
  });

  it("splits what the firm banked into the figures the factura needs", () => {
    // The client's own case: $257.102,50 received against a 7 JUS honorario.
    const s = splitGross(257_102.5);
    expect(s.base).toBe(196_261.45);
    expect(s.iva).toBe(41_214.9);
    expect(s.aportes).toBe(19_626.15);
    expect(s.base + s.iva + s.aportes).toBeCloseTo(257_102.5, 2);
  });

  it("un acordado pagado al centavo queda en cero, no en un peso", () => {
    // Rounding the ceiling to the whole peso left $257.102,50 paid in full
    // showing "$1 pendiente", and the honorario never read as settled.
    const t = techoHonorario({
      baseJus: 7,
      maxAcordadoArs: 257_102.5,
      pagadoJus: 4.83,
      pagadoArs: 257_102.5,
      jusValue: JUS,
    });
    expect(t.capArs).toBe(257_102.5);
    expect(t.pendienteArs).toBe(0);
  });
});

describe("formato de pesos", () => {
  it("las cifras que van a una factura llevan centavos", () => {
    // A breakdown whose parts do not visibly add up to its total is worse than
    // a longer number: 196.261 + 41.215 + 19.626 does not read as 257.103.
    expect(formatArsExacto(196_261.45)).toContain("196.261,45");
    expect(formatArsExacto(41_214.9)).toContain("41.214,90");
    expect(formatArsExacto(19_626.15)).toContain("19.626,15");
    expect(formatArsExacto(257_102.5)).toContain("257.102,50");
  });

  it("las cifras convertidas desde JUS van redondeadas", () => {
    // An estimate printed to the centavo is a lie about its own precision.
    expect(formatArs(488_137.44)).not.toContain(",");
  });
});

describe("el JUS denomina el honorario base, nunca el bruto", () => {
  const JUS = 53232; // vigente desde 2026-08-01

  // The case the client wrote in about: a transfer of $213.909,90 against a
  // 7 JUS honorario. What he perceives is the fee inside it, not the transfer —
  // the juzgado withholds IVA and aportes before the money moves.
  it("un pago de $213.909,90 son 3,06 JUS de honorario y no 4,02", () => {
    expect(arsToBaseJus(213_909.9, JUS)).toBe(3.06);
    // What the form used to print, kept here on purpose: the gross over the JUS
    // value, a number that denominates nothing anybody receives.
    expect(arsToJus(213_909.9, JUS)).toBe(4.02);
  });

  it("el desglose de ese pago suma exactamente lo transferido", () => {
    const s = splitGross(213_909.9);
    expect(s).toEqual({ base: 163_290, iva: 34_290.9, aportes: 16_329 });
    expect(roundCentavos(s.base + s.iva + s.aportes)).toBe(213_909.9);
  });

  it("163.290 / 53.232 se trunca a 3,06 — no se redondea a 3,07", () => {
    // Decided with Fran on 2026-09-16: the firm writes 3,06, and a fee is not
    // rounded up in its own favour. Display only — arsToJus() still rounds.
    expect(163_290 / JUS).toBeCloseTo(3.0675, 4);
    expect(truncJus(163_290 / JUS)).toBe(3.06);
    expect(arsToJus(163_290, JUS)).toBe(3.07);
  });

  it("truncJus no pierde un centésimo por el ruido del binario", () => {
    // 3.06 * 100 is 305.99999999999994; cutting that raw would print 3,05.
    expect(truncJus(3.06)).toBe(3.06);
    expect(truncJus(9.17)).toBe(9.17);
    expect(truncJus(0.07)).toBe(0.07);
    expect(truncJus(7)).toBe(7);
    expect(truncJus(0)).toBe(0);
  });

  it("sin valor JUS configurado no inventa un honorario", () => {
    expect(arsToBaseJus(213_909.9, 0)).toBe(0);
  });

  it("la card imprime cuatro cifras en pesos que suman el techo", () => {
    const c = composeGrossArs(7, JUS);
    expect(c).toEqual({
      base: 372_624,
      iva: 78_251.04,
      aportes: 37_262.4,
      total: 488_137.44,
    });
    expect(roundCentavos(c.base + c.iva + c.aportes)).toBe(c.total);
  });

  it("reconcilia para cualquier honorario y cualquier valor JUS", () => {
    for (const jusValue of [53_232, 49_000.5, 1, 12_345.67]) {
      for (const monto of [0.5, 3.5, 7, 8.25, 12, 33.33]) {
        const c = composeGrossArs(monto, jusValue);
        expect(roundCentavos(c.base + c.iva + c.aportes)).toBe(c.total);
      }
    }
  });

  it("el techo no se movió: sigue siendo base x 1,31 al valor del día", () => {
    // 7 JUS -> 9,17 gross -> $488.137,44. This is a presentation change; the
    // ceiling check_honorario_pago_cap() enforces is the same one as before.
    expect(grossCapJus(7)).toBe(9.17);
    expect(composeGrossArs(7, JUS).total).toBe(jusToArsExacto(grossCapJus(7), JUS));
    expect(composeGrossArs(7, JUS).total).toBe(488_137.44);
  });

  it("los pesos que se postean llevan centavos", () => {
    // jusToArs() rounds to the peso, and the ceiling would land $0,44 under the
    // one the card prints — enough for the base to read a centésima low.
    expect(baseJusToArs(7, JUS)).toBe(488_137.44);
    expect(jusToArs(9.17, JUS)).toBe(488_137);
  });

  it("ida y vuelta: el honorario vuelve igual o un centésimo abajo, nunca arriba", () => {
    // Truncating costs at most one centésima, and only when the gross rounds
    // down on the way to pesos. What must never happen is the other direction:
    // a fee that grows just by being displayed.
    for (const baseJus of [1, 3.06, 7, 9.17, 0.5, 12.34]) {
      const vuelta = arsToBaseJus(baseJusToArs(baseJus, JUS), JUS);
      expect(vuelta).toBeLessThanOrEqual(baseJus);
      expect(roundJus(baseJus - vuelta)).toBeLessThanOrEqual(0.01);
    }
  });

  it("un pago escrito en JUS no se pasa del techo por redondeo", () => {
    // The gross is rounded to the nearest centésima of JUS rather than up: the
    // ceiling is rounded too, and a gross rounded up would be refused as
    // "excede lo pendiente" on a honorario the lawyer meant to settle in full.
    for (const base of [3.5, 3.53, 7, 9.17, 12.34]) {
      const grossJus = arsToJus(baseJusToArs(base, JUS), JUS);
      expect(grossJus).toBeLessThanOrEqual(grossCapJus(base));
    }
  });
});
