// The honorarios payment plan: an anticipo on signing, N monthly cuotas from a
// date the lawyer types, and the deuda start that follows from them (B1,
// 2026-09-23).
//
// Derived, never stored, exactly like the deuda schedule in convenio.ts: a
// honorario carries only plan_anticipo_ars, plan_cuotas and plan_fecha_primera
// (plus plan_cap_legal_ars, below), and every amount and date here is recomputed
// from them. No cuotas table and no per-cuota paid flag — honorarios_pagos is the
// ledger and is deliberately not tied to the plan. The plan says how the agreed
// amount will arrive; check_honorario_pago_cap() still decides how much may.
//
// All the arithmetic is convenio.ts's: montosCuotas() splits, vencimientos() /
// addMonthsClamped() date, cuotasTexto() words. Two implementations of a money
// split is how clause TERCERA stops matching the rows printed under it.
//
// WHAT THE PLAN DIVIDES (Fran, 2026-09-23). A plan does not require a settled
// máximo. It splits max_acordado_ars when there is one, and otherwise the
// DEFAULT — the legal ceiling, base x 1,31 — frozen in pesos on the day the plan
// is made, in plan_cap_legal_ars; the lawyer is told the default was used
// (techoDelPlan().origen). Frozen rather than converted at render time because
// the convenio prints fixed pesos while the legal ceiling is a JUS amount: a
// plan re-derived from today's JUS makes a convenio signed in September
// disagree with itself in October — the defect 20260905120000's header
// documents. The migration 20260923120000 carries the full reasoning.

import { cuotasTexto, montosCuotas, vencimientos } from "./convenio";
import { formatLocalDate, parseLocalDate } from "./dates";
import { formatArsExacto, techoHonorario } from "./honorarios";
import { montoALetras } from "./numero-a-letras";

// Free from 1 to 12 (Fran, 2026-09-23) — not the deuda's CUOTAS_OPTIONS
// (1/3/6/12): his own worked example is two honorarios cuotas. The DB carries
// the same range as a CHECK on honorarios.plan_cuotas; change one, change both
// (honorarios-plan.test.ts reads the migration to hold them together).
export const PLAN_CUOTAS_MIN = 1;
export const PLAN_CUOTAS_MAX = 12;
export const PLAN_CUOTAS_OPTIONS: readonly number[] = Array.from(
  { length: PLAN_CUOTAS_MAX - PLAN_CUOTAS_MIN + 1 },
  (_, i) => PLAN_CUOTAS_MIN + i,
);

export type CuotaHonorarios = {
  nro: number;
  /** Pesos, to the centavo. */
  monto: number;
  /** ISO yyyy-mm-dd. */
  fecha: string;
};

export type PlanHonorarios = {
  /** Paid on signing, in pesos. 0 when there is none. */
  anticipo: number;
  /** One entry per cuota. Never empty: a plan has at least one. */
  cuotas: CuotaHonorarios[];
  /** ISO date of the last honorarios cuota. */
  ultimaFecha: string;
};

export type PlanHonorariosInput = {
  /** The amount the plan splits — techoDelPlan().total. Null when there is none. */
  total: number | null;
  anticipoArs: number | null;
  cuotas: number | null;
  /** ISO yyyy-mm-dd. "" counts as absent: it is what an untouched DateField posts. */
  fechaPrimera: string | null;
};

// Same rounding montosCuotas() does internally, so an amount taken to the
// centavo here is the amount it will split.
function aCentavos(ars: number): number {
  return Math.round(ars * 100);
}

function esFechaIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // parseLocalDate() overflows quietly (2025-02-30 is 02/03), so a real date is
  // one that survives the round trip.
  return formatLocalDate(parseLocalDate(value)) === value;
}

/**
 * Why this input is not a plan that can be printed, as the message the form
 * shows — or null when it is fine, including when there is simply no plan.
 *
 * An anticipo equal to or above the total is REJECTED, not clamped to zero
 * cuotas: a plan whose cuotas are $0,00 is not a plan, and the lawyer who typed
 * it meant something else. The DB refuses the same row
 * (honorarios_plan_anticipo_bajo_techo), so this is the friendly half of it.
 */
export function validarPlanHonorarios(input: PlanHonorariosInput): string | null {
  const { total, anticipoArs, cuotas } = input;
  const fechaPrimera = input.fechaPrimera || null;

  if (cuotas == null && fechaPrimera == null) {
    return anticipoArs == null ? null : "El anticipo va con un plan de cuotas.";
  }
  if (cuotas == null) return "Elegí la cantidad de cuotas.";
  if (fechaPrimera == null) return "Falta la fecha de la primera cuota.";

  if (total == null || !Number.isFinite(total) || aCentavos(total) <= 0) {
    return "No hay un máximo sobre el cual armar el plan.";
  }
  if (!Number.isInteger(cuotas) || cuotas < PLAN_CUOTAS_MIN || cuotas > PLAN_CUOTAS_MAX) {
    return `Las cuotas van de ${PLAN_CUOTAS_MIN} a ${PLAN_CUOTAS_MAX}.`;
  }
  if (!esFechaIso(fechaPrimera)) return "La fecha de la primera cuota no es válida.";

  if (anticipoArs != null) {
    if (!Number.isFinite(anticipoArs) || aCentavos(anticipoArs) <= 0) {
      return "El anticipo tiene que ser mayor a 0.";
    }
    if (aCentavos(anticipoArs) >= aCentavos(total)) {
      return `El anticipo tiene que ser menor que el máximo (${formatArsExacto(total)}).`;
    }
  }

  // Every cuota at least a centavo. Only a near-total anticipo gets here, but a
  // convenio that promises a cuota of $0,00 is a wrong document.
  const saldo = aCentavos(total) - (anticipoArs == null ? 0 : aCentavos(anticipoArs));
  if (saldo < cuotas) return `El saldo no alcanza para ${cuotas} cuotas.`;

  return null;
}

/**
 * The honorarios schedule, or null when there is no plan — `cuotas` or
 * `fechaPrimera` missing, which is every honorario today: one payment, and the
 * convenio keeps printing exactly what it prints now.
 *
 * Cuota 1 falls ON `fechaPrimera` (Fran: "pago 27/09/2025, next payment should
 * be 27/10"), the rest step monthly from it, clamped per step from the original
 * day. The anticipo comes off the total first and the remainder splits with the
 * residue on the last cuota, so anticipo + cuotas is the total to the centavo.
 *
 * Throws a RangeError, with validarPlanHonorarios()'s message, on a plan that
 * cannot be printed. A row saved through the app cannot reach it: the table's
 * CHECKs refuse all of it except the centavo-per-cuota rule, which the server
 * action checks before writing. A form that previews while the lawyer types
 * validates first.
 */
export function planHonorarios(input: PlanHonorariosInput): PlanHonorarios | null {
  if (input.cuotas == null || !input.fechaPrimera) return null;

  const error = validarPlanHonorarios(input);
  if (error) throw new RangeError(error);

  const n = input.cuotas;
  const anticipo = input.anticipoArs == null ? 0 : aCentavos(input.anticipoArs);
  const saldo = aCentavos(input.total!) - anticipo;
  const montos = montosCuotas(saldo / 100, n);
  const fechas = vencimientos(input.fechaPrimera, n);

  return {
    anticipo: anticipo / 100,
    cuotas: montos.map((monto, i) => ({ nro: i + 1, monto, fecha: fechas[i] })),
    ultimaFecha: fechas[n - 1],
  };
}

/**
 * The deuda's first vencimiento when the lawyer did not type one: the month
 * after the last honorarios cuota. Null when there is no plan to chain off.
 *
 * It is the NEXT date of the same monthly series, anchored on the plan's first
 * day — so 31/01 and 28/02 lead to 31/03, not to the 28/03 that adding a month
 * to an already clamped date would give. That is the rule addMonthsClamped()
 * exists for: a short month does not drag the rest of the schedule down.
 */
export function inicioDeudaSugerido(plan: PlanHonorarios | null): string | null {
  if (!plan) return null;
  const n = plan.cuotas.length;
  return vencimientos(plan.cuotas[0].fecha, n + 1)[n];
}

/**
 * How the convenio says the honorarios are paid. A phrase that completes
 * "… será abonada por EL DEUDOR en ___", the way cuotasTexto() completes clause
 * SEGUNDA:
 *
 *   no plan / 1 cuota    → "UN PAGO"
 *   3 cuotas             → "TRES CUOTAS de PESOS … cada una"
 *   anticipo + 3 cuotas  → "UN ANTICIPO de PESOS … a la firma del presente y el
 *                           saldo en TRES CUOTAS de PESOS … cada una"
 *
 * The cuotas part IS cuotasTexto() over the plan's own remainder, so the words
 * and the rows under them come from one split (uneven residue included).
 */
export function honorariosTexto(plan: PlanHonorarios | null): string {
  // No plan: one payment, in cuotasTexto()'s own words for it.
  if (!plan) return "UN PAGO";

  const saldo = plan.cuotas.reduce((s, c) => s + aCentavos(c.monto), 0) / 100;
  const enCuotas = cuotasTexto(saldo, plan.cuotas.length);
  if (!(plan.anticipo > 0)) return enCuotas;

  return (
    `UN ANTICIPO de ${montoALetras(plan.anticipo)} a la firma del presente ` +
    `y el saldo en ${enCuotas}`
  );
}

export type TechoPlan = {
  /** Pesos: the amount anticipo + cuotas add up to. */
  total: number;
  /**
   * "legal" when nothing was settled and the plan splits the default frozen at
   * plan time — the case the lawyer has to be told about.
   */
  origen: "acordado" | "legal";
};

/**
 * What a plan on this honorario splits. A settled máximo wins over the default
 * (Fran: "pisarlo en caso de que se haya acordado un valor en pesos"); the
 * table allows only one of the two once there is a plan, so the order only
 * matters for a row that has none.
 */
export function techoDelPlan(fila: {
  max_acordado_ars: number | null;
  plan_cap_legal_ars: number | null;
}): TechoPlan | null {
  if (fila.max_acordado_ars != null && fila.max_acordado_ars > 0) {
    return { total: fila.max_acordado_ars, origen: "acordado" };
  }
  if (fila.plan_cap_legal_ars != null && fila.plan_cap_legal_ars > 0) {
    return { total: fila.plan_cap_legal_ars, origen: "legal" };
  }
  return null;
}

/**
 * The default to freeze into plan_cap_legal_ars when a plan is made with no
 * settled máximo: the legal ceiling in pesos at today's JUS, to the centavo —
 * techoHonorario()'s own figure, so the plan and the card name the same amount
 * on the day it is made. Null when there is no JUS value or no base to convert.
 */
export function capLegalParaPlan(baseJus: number, jusValue: number): number | null {
  if (!(baseJus > 0) || !(jusValue > 0)) return null;
  return techoHonorario({
    baseJus,
    maxAcordadoArs: null,
    pagadoJus: 0,
    pagadoArs: 0,
    jusValue,
  }).capArs;
}

/**
 * The plan of a `honorarios` / `honorarios_with_balance` row — the one way a
 * surface should get from the stored columns to a schedule, like
 * saldoHonorario() is for the balance. Every field is nullable because every
 * view column is typed nullable (gotcha #3).
 *
 * Never throws, unlike planHonorarios(). It reads STORED data that this module
 * does not control, and its callers are Server Components: a row that somehow
 * violates the plan's rules has to render as "no plan", not as a 500. The
 * throwing path stays for the form, which is the only place the message helps.
 * The database refuses such a row anyway — the CHECKs of 20260923120000 plus
 * honorarios_plan_saldo_por_cuota (20260924130000) — so this is the second
 * fence, not the first.
 */
export function planDeFila(fila: {
  max_acordado_ars: number | null;
  plan_cap_legal_ars: number | null;
  plan_anticipo_ars: number | null;
  plan_cuotas: number | null;
  plan_fecha_primera: string | null;
}): PlanHonorarios | null {
  const input: PlanHonorariosInput = {
    total: techoDelPlan(fila)?.total ?? null,
    anticipoArs: fila.plan_anticipo_ars,
    cuotas: fila.plan_cuotas,
    fechaPrimera: fila.plan_fecha_primera,
  };
  if (validarPlanHonorarios(input)) return null;
  return planHonorarios(input);
}
