import { formatCuil, isValidCuil } from "./cuil";

// A party on a demanda: the demandado (the card's titular) or a codemandado
// (an additional cardholder, solidarily liable under clausula quinta). Both carry
// the same identity + employment shape, because the medida cautelar section is
// composed from the employment status of every party - session 2B does that
// composition and reads exactly these fields.
export type PartyFields = {
  nombre: string;
  cuil: string;
  domicilio: string;
  telefono: string;
  trabaja: boolean;
  empleador_nombre: string;
  empleador_cuit: string;
  empleador_domicilio: string;
  empleador_telefono: string;
  // Per party. cuenta_cliper is shared and lives on the ejecutado.
  tarjeta_cabal: string;
};

// The demanda columns on ejecutados that EjecutadoFormFields does not already
// cover. Maps 1:1 to columns so it can be spread straight into an insert/update.
export type DemandadoExtraFields = {
  trabaja: boolean;
  empleador_nombre: string;
  empleador_cuit: string;
  empleador_domicilio: string;
  empleador_telefono: string;
  tarjeta_cabal: string;
  // Case-level, shared across every party, never repeated per codemandado.
  cuenta_cliper: string;
  fecha_contrato: string | null;
};

export function emptyParty(): PartyFields {
  return {
    nombre: "",
    cuil: "",
    domicilio: "",
    telefono: "",
    trabaja: false,
    empleador_nombre: "",
    empleador_cuit: "",
    empleador_domicilio: "",
    empleador_telefono: "",
    tarjeta_cabal: "",
  };
}

// Card numbers are stored and printed digits only, no dashes (Fran, 2026-08-18).
// The firm's Word documents show dashed forms like 6002-0239-0201; the client
// asked for digits only, so strip on the way in.
export function onlyDigits(value: string): string {
  return String(value ?? "").replace(/[^0-9]/g, "");
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

// The trabaja switch posts an explicit "true"/"false" through a hidden input.
// A bare checkbox would simply be absent when off, which is indistinguishable
// from "the field was not on this form" and would silently clear the column.
function bool(fd: FormData, key: string): boolean {
  return str(fd, key) === "true";
}

/** One party out of a form. `prefix` lets a sub-form namespace its inputs. */
export function parsePartyFormData(fd: FormData, prefix = ""): PartyFields {
  const p = (k: string) => `${prefix}${k}`;
  return {
    nombre: str(fd, p("nombre")),
    cuil: formatCuil(str(fd, p("cuil"))),
    domicilio: str(fd, p("domicilio")),
    telefono: str(fd, p("telefono")),
    trabaja: bool(fd, p("trabaja")),
    empleador_nombre: str(fd, p("empleador_nombre")),
    empleador_cuit: formatCuil(str(fd, p("empleador_cuit"))),
    empleador_domicilio: str(fd, p("empleador_domicilio")),
    empleador_telefono: str(fd, p("empleador_telefono")),
    tarjeta_cabal: onlyDigits(str(fd, p("tarjeta_cabal"))),
  };
}

export function parseDemandadoExtraFormData(fd: FormData): DemandadoExtraFields {
  return {
    trabaja: bool(fd, "trabaja"),
    empleador_nombre: str(fd, "empleador_nombre"),
    empleador_cuit: formatCuil(str(fd, "empleador_cuit")),
    empleador_domicilio: str(fd, "empleador_domicilio"),
    empleador_telefono: str(fd, "empleador_telefono"),
    tarjeta_cabal: onlyDigits(str(fd, "tarjeta_cabal")),
    cuenta_cliper: onlyDigits(str(fd, "cuenta_cliper")),
    fecha_contrato: str(fd, "fecha_contrato") || null,
  };
}

/**
 * The codemandado sub-forms are client state (add / remove / reorder), so they
 * travel as one JSON field rather than as parallel FormData arrays - an unchecked
 * switch is simply absent from FormData, which would misalign the arrays.
 * Tolerant by design: anything unparseable becomes an empty list rather than a
 * 500, and unknown keys are dropped.
 */
export function parsePartiesJson(raw: string): PartyFields[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: PartyFields[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
    const party: PartyFields = {
      nombre: s("nombre"),
      cuil: formatCuil(s("cuil")),
      domicilio: s("domicilio"),
      telefono: s("telefono"),
      trabaja: o.trabaja === true || o.trabaja === "true",
      empleador_nombre: s("empleador_nombre"),
      empleador_cuit: formatCuil(s("empleador_cuit")),
      empleador_domicilio: s("empleador_domicilio"),
      empleador_telefono: s("empleador_telefono"),
      tarjeta_cabal: onlyDigits(s("tarjeta_cabal")),
    };
    // A row the user added and never filled in is dropped rather than rejected.
    if (party.nombre === "") continue;
    out.push(party);
  }
  return out;
}

/**
 * Party-level validation, shared by the demanda form and the codemandado cards.
 * `label` names the party in the message ("El codemandado 2", "El demandado").
 * Returns a user-facing Spanish string, or null.
 *
 * Employer data is required when trabaja is true - the "Ambos con Embargo de
 * Sueldo" model prints the full employer block - but it is enforced here rather
 * than with a DB constraint, because legacy rows have none of it.
 */
/**
 * The employment half, shared by validateParty and validateDemandadoExtra.
 * A working party needs the full employer block because the haberes model prints
 * it: "… y trabaja para [EMPLEADOR] (CUIT …) con domicilio en […]".
 */
function validateEmpleo(
  p: Pick<PartyFields, "trabaja" | "empleador_nombre" | "empleador_cuit">,
  label: string,
): string | null {
  if (!p.trabaja) return null;
  if (p.empleador_nombre === "") {
    return `${label}: si trabaja, el nombre del empleador es obligatorio.`;
  }
  if (p.empleador_cuit === "") {
    return `${label}: si trabaja, el CUIT del empleador es obligatorio.`;
  }
  // A CUIT is the same mod-11 construction with a 30/33/34 prefix.
  if (!isValidCuil(p.empleador_cuit)) {
    return `${label}: CUIT del empleador inválido, el dígito verificador no coincide.`;
  }
  return null;
}

export function validateParty(p: PartyFields, label: string): string | null {
  if (p.nombre === "") return `${label}: el nombre es obligatorio.`;
  // CUIL and domicilio are required (Fran, 2026-08-21): all three cautelar
  // fragments print both for every party, so a blank one is not a missing field
  // in a database, it is a hole in the middle of a filed court document.
  if (p.cuil === "") return `${label}: el CUIL es obligatorio.`;
  if (!isValidCuil(p.cuil)) {
    return `${label}: CUIL inválido, el dígito verificador no coincide.`;
  }
  if (p.domicilio === "") return `${label}: el domicilio es obligatorio.`;
  return validateEmpleo(p, label);
}

/**
 * The demandado's own employment block, validated with the same employer rules.
 * Identity (nombre, cuil, domicilio) is deliberately NOT checked here: the
 * Demanda card edits only the employment half, and the main "Datos" form owns
 * the rest. Applying the identity rules here would block saving the employer of
 * a migrated case that predates the CUIL column.
 */
export function validateDemandadoExtra(extra: DemandadoExtraFields): string | null {
  return validateEmpleo(extra, "El demandado");
}

/**
 * Narrow a codemandados row (or an ejecutados row, which carries the same column
 * names) down to the party shape the form components take. Structurally typed so
 * lib/domain stays free of Supabase imports.
 */
export function partyFromRow(row: {
  nombre?: string | null;
  cuil?: string | null;
  domicilio?: string | null;
  telefono?: string | null;
  trabaja?: boolean | null;
  empleador_nombre?: string | null;
  empleador_cuit?: string | null;
  empleador_domicilio?: string | null;
  empleador_telefono?: string | null;
  tarjeta_cabal?: string | null;
}): PartyFields {
  return {
    nombre: row.nombre ?? "",
    cuil: row.cuil ?? "",
    domicilio: row.domicilio ?? "",
    telefono: row.telefono ?? "",
    // ejecutados.trabaja is nullable on purpose - a legacy row genuinely does not
    // know - and an unknown reads as "does not work" in the form.
    trabaja: row.trabaja === true,
    empleador_nombre: row.empleador_nombre ?? "",
    empleador_cuit: row.empleador_cuit ?? "",
    empleador_domicilio: row.empleador_domicilio ?? "",
    empleador_telefono: row.empleador_telefono ?? "",
    tarjeta_cabal: row.tarjeta_cabal ?? "",
  };
}

export function labelForCodemandado(index: number): string {
  return `El codemandado ${index + 1}`;
}
