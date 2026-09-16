import { type Tables } from "@/lib/supabase/db-helpers";

export type Honorario = Tables<"honorarios">;
export type HonorarioPago = Tables<"honorarios_pagos">;

// What a new honorario starts at, in JUS. The amount is free — the firm
// regulates case by case — so this is a default, not a limit.
export const HONORARIO_JUS_DEFAULT = 7;

// Tax charged on top of the regulated base, additive: a 7 JUS honorario may be
// collected up to 9.17 JUS gross, a 3.5 up to 4.59.
//
// The DB trigger check_honorario_pago_cap() enforces the same ceiling via
// public.honorario_gross_cap(); the two are kept in step by the constants here
// and the assertions in honorarios.test.ts. Change one, change the other.
export const IVA_RATE = 0.21;
export const APORTES_RATE = 0.1;
export const TAX_MULTIPLIER = 1 + IVA_RATE + APORTES_RATE; // 1.31

// Pagos are stored as 2-dp JUS, so every cap and split is rounded to that same
// precision — a maximum the UI shows must be a number the trigger accepts.
// Half-up, matching Postgres ROUND() on NUMERIC.
export function roundJus(jus: number): number {
  return Math.round((jus + Number.EPSILON) * 100) / 100;
}

// Pesos to the centavo. Same arithmetic as roundJus, named for what it is:
// these figures get transcribed into a factura, so the centavos are the point.
export function roundCentavos(ars: number): number {
  return Math.round((ars + Number.EPSILON) * 100) / 100;
}

// The most that can be collected against a base honorario, tax included.
export function grossCapJus(baseJus: number): number {
  return roundJus(baseJus * TAX_MULTIPLIER);
}

// The tax portion alone — what sits above the regulated fee.
export function taxJus(baseJus: number): number {
  return roundJus(grossCapJus(baseJus) - baseJus);
}

export type HonorarioComposition = {
  base: number;
  iva: number;
  aportes: number;
  total: number;
};

// The fee and the tax on it as four separate figures — this is what the card
// prints as "7 + IVA + aportes = 9,17", so the parts have to add up to exactly
// the same total the cap function returns. Aportes absorbs the rounding residue,
// same convention as splitGross().
export function composeGross(baseJus: number): HonorarioComposition {
  const base = roundJus(baseJus);
  const total = grossCapJus(baseJus);
  const iva = roundJus(base * IVA_RATE);
  return { base, iva, aportes: roundJus(total - base - iva), total };
}

// The ceiling that actually applies, and what is left of it.
//
// The two possible ceilings are denominated differently on purpose: the arancel
// is a JUS amount, a settlement with the debtor is a fixed peso amount. Each is
// compared against collections in ITS OWN unit, so both sides of the comparison
// are the same kind of number and neither drifts when the JUS moves. Mirrors
// check_honorario_pago_cap(), which enforces exactly this.
export type TechoHonorario = {
  tipo: "acordado" | "legal";
  // The ceiling and its remainder in pesos — what the card prints, and what the
  // pago form posts against. For a negotiated honorario these are the exact
  // agreed figures; for the arancel they are today's conversion of a JUS
  // ceiling, to the centavo: 7 JUS is $488.137,44 and rounding that to the peso
  // made the form refuse the very amount it had just told the lawyer to pay.
  capArs: number;
  pendienteArs: number;
  // The same two in JUS. Null once a peso amount was agreed: converting it back
  // would invent precision the agreement never had.
  capJus: number | null;
  pendienteJus: number | null;
};

// A negotiated max may be BELOW the legal cap (a quita) or above it; the only
// thing rejected is a non-positive one, which would freeze collection entirely.
export function techoHonorario(input: {
  baseJus: number;
  maxAcordadoArs: number | null | undefined;
  pagadoJus: number;
  pagadoArs: number;
  jusValue: number;
}): TechoHonorario {
  const { baseJus, maxAcordadoArs, pagadoJus, pagadoArs, jusValue } = input;

  if (maxAcordadoArs != null && maxAcordadoArs > 0) {
    // Centavos, not whole pesos: an agreement of $257.102,50 paid in full has to
    // land on exactly zero. Rounding to the peso left a phantom $1 pendiente and
    // the honorario never read as settled.
    const capArs = roundCentavos(maxAcordadoArs);
    return {
      tipo: "acordado",
      capArs,
      pendienteArs: Math.max(0, roundCentavos(capArs - pagadoArs)),
      capJus: null,
      pendienteJus: null,
    };
  }

  // The arancel's ceiling is enforced in JUS — capJus and pendienteJus are the
  // numbers check_honorario_pago_cap() compares, and they do not change here.
  // Their peso equivalents carry centavos so the form, the card and "Saldar"
  // all name the same amount.
  const capJus = grossCapJus(baseJus);
  const pendienteJus = Math.max(0, roundJus(capJus - pagadoJus));
  return {
    tipo: "legal",
    capArs: jusToArsExacto(capJus, jusValue),
    pendienteArs: jusToArsExacto(pendienteJus, jusValue),
    capJus,
    pendienteJus,
  };
}

// The same ceiling for a `honorarios_with_balance` row — how every surface other
// than the ejecutado card reaches a honorario.
//
// The view has peso columns of its own, `cap_cobrable_ars` and
// `pendiente_cobrable_ars`, and they are NOT the figures to print: the pendiente
// one subtracts pesos received at the JUS of each payment's own date from a
// ceiling converted at TODAY's JUS, so it mixes units. A honorario settled in
// full at a JUS of 50.000 reads $29.637 still owing once the JUS moves to
// 53.232, while the card reads $0 — the card is right. Going through
// techoHonorario() keeps one answer: compared in JUS for the arancel's ceiling,
// in pesos for a settled one, exactly as check_honorario_pago_cap() does.
//
// Every column is nullable because every view column is typed nullable
// (gotcha #3), not because a honorario can lack a base.
export function saldoHonorario(
  fila: {
    monto_total_jus: number | null;
    max_acordado_ars: number | null;
    pagado_jus: number | null;
    pagado_ars: number | null;
  },
  jusValue: number,
): TechoHonorario {
  return techoHonorario({
    baseJus: fila.monto_total_jus ?? 0,
    maxAcordadoArs: fila.max_acordado_ars,
    pagadoJus: fila.pagado_jus ?? 0,
    pagadoArs: fila.pagado_ars ?? 0,
    jusValue,
  });
}

export type GrossSplit = { base: number; iva: number; aportes: number };

// Break a gross amount into what it is made of. Aportes absorbs the rounding
// residue so the three parts always add back up to exactly `grossJus` — a split
// that doesn't reconcile is worse than one that's off by a hundredth.
export function splitGross(grossJus: number): GrossSplit {
  const base = roundJus(grossJus / TAX_MULTIPLIER);
  const iva = roundJus(base * IVA_RATE);
  const aportes = roundJus(grossJus - base - iva);
  return { base, iva, aportes };
}

export function jusToArs(jus: number, jusValue: number): number {
  return Math.round(jus * jusValue);
}

export function arsToJus(ars: number, jusValue: number): number {
  if (!(jusValue > 0)) return 0;
  return Math.round((ars / jusValue) * 100) / 100; // 2-dp JUS
}

// Remaining against the regulated BASE — what's left of the fee proper.
// Reaching zero here means the fee is covered but the tax on it may not be.
export function remainingJus(capJus: number, pagadoJus: number): number {
  return Math.max(0, roundJus(capJus - pagadoJus));
}

// Remaining against the GROSS cap — what may still be collected in total.
// This is the one that gates whether another pago is allowed.
export function remainingGrossJus(baseJus: number, pagadoJus: number): number {
  return Math.max(0, roundJus(grossCapJus(baseJus) - pagadoJus));
}

// Glanceable pesos: whole numbers, for figures that are already approximate
// (anything converted from JUS at today's value) or that nobody transcribes.
export function formatArs(ars: number): string {
  return ars.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

// Pesos to the centavo, for money that has to be exact: what was collected, the
// fee/IVA/aportes breakdown, an amount settled with the debtor. These are the
// figures the firm copies into a factura request, and a breakdown whose parts
// do not visibly add up to its total is worse than a longer number.
export function formatArsExacto(ars: number): string {
  return ars.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatJus(jus: number): string {
  return `${jus.toLocaleString("es-AR", { maximumFractionDigits: 2 })} JUS`;
}

// ---------------------------------------------------------------------------
// What the lawyer actually perceives
//
// The JUS is the unit the arancel is written in, and the arancel is the fee
// BEFORE tax. The juzgado withholds IVA and aportes when it transfers, so
// dividing a gross transfer by the JUS value denominates nothing anybody
// receives: $213.909,90 at a JUS of $53.232 is 3,06 JUS of fee, not 4,02 JUS.
//
// The rule (Fran, 2026-09-15): a JUS figure is always a base figure. IVA and
// aportes are shown in pesos only. Nothing below changes what is stored or what
// the ceiling is — check_honorario_pago_cap(), grossCapJus(), techoHonorario()
// and honorarios_pagos.monto_jus all keep working in gross JUS.
// ---------------------------------------------------------------------------

// Cut to two decimals instead of rounded: 163.290 / 53.232 is 3,0675 and the
// firm reads that as 3,06 — a fee is not rounded up in its own favour.
// PRESENTATION ONLY. arsToJus() still rounds, and it is what feeds the ceiling
// the DB trigger mirrors; never compute a stored amount through this.
export function truncJus(jus: number): number {
  if (!(jus > 0)) return 0;
  // 3.06 * 100 is 305.99999999999994 in binary floating point, and cutting that
  // raw would print 3,05. Settle the dust before taking the floor.
  return Math.floor(Number((jus * 100).toFixed(6))) / 100;
}

// The fee inside a gross peso amount, in JUS. Every "what is this worth in JUS"
// on screen goes through here — there is no second converter.
export function arsToBaseJus(grossArs: number, jusValue: number): number {
  if (!(jusValue > 0)) return 0;
  return truncJus(splitGross(grossArs).base / jusValue);
}

// Pesos to the centavo. jusToArs() rounds to the peso, which is right for a
// glanceable estimate; this is for the figures the card adds up and for the
// amount a pago is actually posted with.
export function jusToArsExacto(jus: number, jusValue: number): number {
  return roundCentavos(jus * jusValue);
}

// The inverse of arsToBaseJus(): what the juzgado has to transfer for a fee of
// `baseJus` to be perceived, tax included.
//
// grossCapJus() is the same arithmetic — base x 1.31 at 2-dp JUS — and reusing
// it keeps one multiplier in the app. Rounded to the nearest centésima of JUS,
// never up: the ceiling the trigger enforces is rounded too, and a gross rounded
// up would be refused as "excede lo pendiente" on a honorario paid in full. The
// cost is that a base recovered from these pesos can read one centésima low.
export function baseJusToArs(baseJus: number, jusValue: number): number {
  return jusToArsExacto(grossCapJus(baseJus), jusValue);
}

export type HonorarioComposicionArs = {
  base: number;
  iva: number;
  aportes: number;
  total: number;
};

// The card's four lines in pesos, reconciling to the centavo. IVA and aportes
// are peso-only now, so the three parts are read as an addition; converting each
// line independently can drift a centavo off the total. Aportes absorbs the
// residue, same convention as composeGross() and splitGross().
export function composeGrossArs(
  baseJus: number,
  jusValue: number,
): HonorarioComposicionArs {
  const comp = composeGross(baseJus);
  const base = jusToArsExacto(comp.base, jusValue);
  const iva = jusToArsExacto(comp.iva, jusValue);
  const total = jusToArsExacto(comp.total, jusValue);
  return { base, iva, aportes: roundCentavos(total - base - iva), total };
}
