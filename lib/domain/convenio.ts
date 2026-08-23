// The Reconocimiento de Deuda (CONVENIO DE RECONOCIMIENTO Y REFINANCIACIÓN DE
// DEUDA) — the document an extrajudicial case is settled with.
//
// Everything here is derived, never stored (Fran, 2026-08-18): the ejecutado
// carries only `monto_acuerdo`, `cuotas` and `fecha_vencimiento`, and the
// instalment schedule is recomputed each time the escrito is generated. There is
// no cuotas child table and no per-instalment paid flag; if the firm ever needs
// to reconcile partial payments against cobros_pagos, tracked rows can be added
// later without a data migration.
//
// No business-day calendar either, and that is deliberate: the convenio's own
// prose already covers it — "Si la fecha de vencimiento convenida correspondiere
// a día inhábil o feriado, el pago deberá efectuarse el día hábil posterior".

import { formatArDate, formatLocalDate, parseLocalDate } from "./dates";
import { montoALetras, numeroALetras } from "./numero-a-letras";
import { type TemplateRecord } from "./template-engine";

// Matched on clave, never on título (gotcha #31). The pinned layer and the
// render layer both name it, so it lives here rather than in either of them.
export const CONVENIO_CLAVE = "convenio.reconocimiento-deuda";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

/**
 * The same day-of-month `months` on, clamped to the end of a shorter month.
 *
 * Date's own month arithmetic overflows — 31/01 + 1 month lands on 03/03 — which
 * would silently skip February in a payment schedule. A vencimiento on the 31st
 * steps 31/01 → 28/02 → 31/03 instead: the clamp applies per step from the
 * ORIGINAL day, so a short month never drags the rest of the schedule down with
 * it.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastOfMonth = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(day, lastOfMonth));
  return target;
}

/**
 * Per-instalment amounts, in pesos, adding back up to exactly `monto`.
 *
 * Worked in integer centavos: the split of a negotiated figure has to reconcile,
 * and a document whose instalments do not sum to the DEUDA RECONOCIDA is worse
 * than one that is a centavo lopsided. The residue lands on the LAST instalment,
 * which is also the one the debtor has most time to prepare for.
 */
export function montosCuotas(monto: number, cuotas: number): number[] {
  const n = Math.max(1, Math.trunc(cuotas));
  const totalCents = Math.round(Math.abs(Number(monto) || 0) * 100);
  const baseCents = Math.floor(totalCents / n);
  const resto = totalCents - baseCents * n;

  return Array.from({ length: n }, (_, i) =>
    (i === n - 1 ? baseCents + resto : baseCents) / 100,
  );
}

/**
 * The vencimiento of every instalment as an ISO date: the first is the one the
 * lawyer entered, the rest step one month at a time from it.
 */
export function vencimientos(fechaVencimiento: string, cuotas: number): string[] {
  const n = Math.max(1, Math.trunc(cuotas));
  const first = parseLocalDate(fechaVencimiento);
  return Array.from({ length: n }, (_, i) =>
    formatLocalDate(addMonthsClamped(first, i)),
  );
}

/**
 * Clause SEGUNDA's payment form. This one token replaces the four separate
 * convenio templates the firm was keeping by hand.
 *
 *   1  → "UN PAGO"
 *   N  → "TRES CUOTAS de PESOS NOVENTA MIL ($90.000,00.-) cada una"
 *
 * The instalment count is spelled out rather than printed as a digit, matching
 * the "UN PAGO" the firm's own source document uses and the register of the rest
 * of the clause.
 *
 * When the amount does not divide evenly the "cada una" phrasing would be a
 * false statement, so an uneven split names the last instalment separately. The
 * even case — which is what the firm will hit in practice, since the settlement
 * figure is negotiated — reads exactly as specified.
 */
export function cuotasTexto(monto: number, cuotas: number): string {
  const n = Math.max(1, Math.trunc(cuotas));
  if (n === 1) return "UN PAGO";

  const montos = montosCuotas(monto, n);
  const base = montos[0];
  const ultima = montos[n - 1];
  const cuenta = numeroALetras(n);

  if (base === ultima) {
    return `${cuenta} CUOTAS de ${montoALetras(base)} cada una`;
  }
  return (
    `${cuenta} CUOTAS: ${numeroALetras(n - 1)} de ${montoALetras(base)} ` +
    `y una última de ${montoALetras(ultima)}`
  );
}

/**
 * The schedule as the template's {{#each PLAN_PAGOS}} sees it. Rendered only
 * when there is more than one instalment — a single payment is already fully
 * described by "en UN PAGO. Con vencimiento la primera el …".
 */
export function planDePagos(
  monto: number,
  cuotas: number,
  fechaVencimiento: string,
): TemplateRecord[] {
  const montos = montosCuotas(monto, cuotas);
  const fechas = vencimientos(fechaVencimiento, cuotas);
  return montos.map((m, i) => ({
    NRO: String(i + 1),
    MONTO: montoALetras(m),
    FECHA: formatArDate(fechas[i]),
  }));
}

/**
 * The signature clause's date, preamble included: "a los DIECINUEVE días del mes
 * de Marzo de 2026". Day 1 takes the ordinal instead — "al PRIMER día del mes
 * de …" — because "a los UNO días" is not Spanish.
 */
export function fechaEnLetras(date: Date): string {
  const dia = date.getDate();
  const mes = MESES[date.getMonth()];
  const año = date.getFullYear();
  if (dia === 1) return `al PRIMER día del mes de ${mes} de ${año}`;
  return `a los ${numeroALetras(dia, { apocopar: true })} días del mes de ${mes} de ${año}`;
}
