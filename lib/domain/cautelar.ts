// The medida cautelar composer.
//
// Section VII of the demanda varies with the number of parties and with each
// party's employment, which is combinatorial: the firm's MODELOS PARA MEDIDAS
// CAUTELARES enumerates nine cases for two parties alone, and one template per
// case does not terminate. The closing note of that document gives the actual
// rule away — homogeneous cases take one joint paragraph with plural verbs,
// mixed cases take one clause per party with singular verbs — so the whole space
// collapses to three fragments plus this selector.
//
// IGB stays out of scope as a per-party state (locked decision #14): trabaja is
// a boolean, and "Subsidiariamente … inhibición general de bienes" is appended
// on every branch instead.
//
// This module decides WHAT to render, never the text itself. The wording lives
// in escritos_templates rows so the firm can reword it without a deploy.

import { cuilToDni, formatDni } from "./cuil";
import { type TemplateRecord, type TemplateScope } from "./template-engine";

export type EmpleadorCautelar = {
  nombre: string;
  cuit: string;
  domicilio: string;
};

export type ParteCautelar = {
  nombre: string;
  cuil: string;
  domicilio: string;
  trabaja: boolean;
  empleador: EmpleadorCautelar | null;
};

export const CAUTELAR_CLAVES = [
  "cautelar.haberes",
  "cautelar.mercadopago",
  "cautelar.mixto",
] as const;

export type CautelarClave = (typeof CAUTELAR_CLAVES)[number];

export type CautelarPlan = {
  /** The escritos_templates row to render (matched on clave, never on título). */
  clave: CautelarClave;
  /** Verb agreement: "solicito se decreten embargos" vs "se decrete embargo". */
  plural: boolean;
  /** Demandado first, then codemandados in `orden`. */
  partes: ParteCautelar[];
};

/**
 * Selection rule:
 *   every party works  -> haberes      (embargo de haberes)
 *   no party works     -> mercadopago  (embargo de billetera virtual)
 *   otherwise          -> mixto        (one clause per party)
 *
 * Party order is the caller's: the demandado first, then codemandados by
 * `orden`. It is preserved verbatim, because the mixto fragment names each
 * party in turn and the demandado has to lead.
 */
export function resolveCautelar(partes: ParteCautelar[]): CautelarPlan {
  const plural = partes.length > 1;
  const trabajan = partes.filter((p) => p.trabaja).length;

  let clave: CautelarClave;
  if (partes.length === 0) {
    // Defensive: a demanda always has a demandado. Nothing to embargo, so the
    // cheapest correct answer is the fragment that needs no employer data.
    clave = "cautelar.mercadopago";
  } else if (trabajan === partes.length) {
    clave = "cautelar.haberes";
  } else if (trabajan === 0) {
    clave = "cautelar.mercadopago";
  } else {
    clave = "cautelar.mixto";
  }

  return { clave, plural, partes };
}

/** "demandado" for the first party, "codemandado" for the rest. */
export function rolDeParte(index: number): string {
  return index === 0 ? "demandado" : "codemandado";
}

/**
 * Parties whose CUIL or domicilio is missing, described in Spanish for the
 * Demanda card. Every fragment prints both fields for every party, so a blank
 * one becomes a visible [CUIL] / [DOMICILIO] marker in section VII — this is how
 * the lawyer finds out before generating rather than while proofreading.
 *
 * Cases created after 2026-08-21 cannot have these gaps (validateParty rejects
 * them); migrated ones can.
 */
export function avisosDePartes(partes: ParteCautelar[]): string[] {
  const avisos: string[] = [];
  partes.forEach((p, i) => {
    const faltan: string[] = [];
    if (p.cuil.trim() === "") faltan.push("el CUIL");
    if (p.domicilio.trim() === "") faltan.push("el domicilio");
    if (faltan.length === 0) return;
    const quien = p.nombre.trim() !== "" ? p.nombre.trim() : `el ${rolDeParte(i)}`;
    avisos.push(`${faltan.join(" y ")} de ${quien}`);
  });
  return avisos;
}

/**
 * Natural-language joins as two booleans rather than one separator token:
 * "A", "A y B", "A, B y C". A separator token would be legitimately empty on the
 * last item, and an empty token is exactly what the engine renders as a visible
 * [SEP] marker — that fallback is load-bearing and must not be weakened so one
 * list can read nicely. Two sibling {{#if}}s inside the {{#each}} say the same
 * thing without ever asking for an empty value.
 */
export function separadoresDeLista(
  index: number,
  total: number,
): { SEP_Y: boolean; SEP_COMA: boolean } {
  return {
    SEP_Y: total > 1 && index === total - 2,
    SEP_COMA: index < total - 2,
  };
}

/**
 * A party as the fragment templates see it. Anything the case is missing comes
 * through as an empty string on purpose: the engine turns that into a visible
 * [CUIL] / [DOMICILIO] marker, which is how the lawyer notices the gap before
 * filing rather than after.
 */
export function parteRecord(parte: ParteCautelar, index: number): TemplateRecord {
  const dni = cuilToDni(parte.cuil);
  return {
    NOMBRE: parte.nombre,
    DNI: dni === "" ? "" : formatDni(dni),
    CUIL: parte.cuil,
    DOMICILIO: parte.domicilio,
    ROL: rolDeParte(index),
    TRABAJA: parte.trabaja,
    EMPLEADOR: parte.empleador?.nombre ?? "",
    EMPLEADOR_CUIT: parte.empleador?.cuit ?? "",
    EMPLEADOR_DOMICILIO: parte.empleador?.domicilio ?? "",
  };
}

/**
 * The scope the fragment body is rendered with. PLURAL drives verb agreement in
 * the homogeneous fragments; ALGUNO_TRABAJA / VARIOS_TRABAJAN drive the
 * retenciones paragraph in the mixed one, which is addressed to the employers
 * and must not appear at all when nobody works.
 */
export function cautelarScope(plan: CautelarPlan): TemplateScope {
  const trabajan = plan.partes.filter((p) => p.trabaja).length;
  return {
    PLURAL: plan.plural,
    ALGUNO_TRABAJA: trabajan > 0,
    VARIOS_TRABAJAN: trabajan > 1,
    HAY_CODEMANDADOS: plan.partes.length > 1,
    PARTES: plan.partes.map(parteRecord),
  };
}
