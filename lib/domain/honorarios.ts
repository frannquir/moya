import { type Tables } from "@/lib/supabase/db-helpers";

export type Honorario = Tables<"honorarios">;
export type HonorarioPago = Tables<"honorarios_pagos">;

// The two regulated honorario types (JUS). These are the BASE amounts — the
// regulated fee itself, before tax.
export const HONORARIO_TIPOS = [3.5, 7] as const;
export type HonorarioTipo = (typeof HONORARIO_TIPOS)[number];

// Tax charged on top of the regulated base, additive (Fran/client, 2026-07-22):
// a 7 JUS honorario may be collected up to 9.17 JUS gross, a 3.5 up to 4.59.
// The type choice stays 3.5 / 7 — only what may be collected against it grows.
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

// The most that can be collected against a base honorario, tax included.
export function grossCapJus(baseJus: number): number {
  return roundJus(baseJus * TAX_MULTIPLIER);
}

// The tax portion alone — what sits above the regulated fee.
export function taxJus(baseJus: number): number {
  return roundJus(grossCapJus(baseJus) - baseJus);
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

export function formatArs(ars: number): string {
  return ars.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function formatJus(jus: number): string {
  return `${jus.toLocaleString("es-AR", { maximumFractionDigits: 2 })} JUS`;
}