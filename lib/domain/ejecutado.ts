import { extractCausa } from "./mail-match";
import { cuilToDni, formatCuil, isValidCuil } from "./cuil";

export const MOVIMIENTO_OPTIONS = [
  "Inicio Causa",
  "Enviar Cédula",
  "Enviar Mandamiento",
  "Pedir Sentencia",
  "En Cobro",
] as const;

export type Movimiento = (typeof MOVIMIENTO_OPTIONS)[number];

// Medida cautelar tipo: stored lowercase (DB CHECK), displayed capitalized.
export const MEDIDA_CAUTELAR_OPTIONS = [
  { value: "embargo", label: "Embargo" },
  { value: "igb", label: "IGB" },
] as const;

export type MedidaCautelar = (typeof MEDIDA_CAUTELAR_OPTIONS)[number]["value"];

export const MEDIDA_ESTADO_OPTIONS = ["Solicitada", "Proveída"] as const;

export type MedidaEstado = (typeof MEDIDA_ESTADO_OPTIONS)[number];

// Judicial vs extrajudicial is an axis PARALLEL to movimiento (locked decision
// #15), never a movimiento value: the debtor can call and agree to settle at any
// procedural stage, so the case keeps whatever movimiento it already had.
export const VIA_OPTIONS = ["judicial", "extrajudicial"] as const;

export type Via = (typeof VIA_OPTIONS)[number];

export const VIA_LABELS: Record<Via, string> = {
  judicial: "Judicial",
  extrajudicial: "Extrajudicial",
};

// The instalment counts the firm offers. A closed set, so the UI is a dropdown
// and the DB carries the same list as a CHECK - change one, change both.
export const CUOTAS_OPTIONS = [1, 3, 6, 12] as const;

export type Cuotas = (typeof CUOTAS_OPTIONS)[number];

/**
 * The extrajudicial half of an ejecutado, written only by the "Pasar a
 * extrajudicial" action.
 *
 * Deliberately NOT part of EjecutadoFormFields: that type is spread straight
 * into an UPDATE and the main "Datos" form does not post these fields, so
 * folding them in would blank the settlement every time anyone saved the case -
 * exactly the bug `empresa` had.
 */
export type ViaFields = {
  via: Via;
  monto_acuerdo: number | null;
  cuotas: Cuotas | null;
  fecha_vencimiento: string | null;
};

export function isVia(value: string): value is Via {
  return (VIA_OPTIONS as readonly string[]).includes(value);
}

export function isCuotas(value: number): value is Cuotas {
  return (CUOTAS_OPTIONS as readonly number[]).includes(value);
}

/** The via a row carries; anything unrecognised (or NULL) reads as judicial. */
export function viaOf(value: string | null | undefined): Via {
  return value === "extrajudicial" ? "extrajudicial" : "judicial";
}

// Shared set of writable ejecutado columns parsed from a create/edit form.
// Both createEjecutado and updateEjecutado go through this so the field mapping
// stays in one place.
export type EjecutadoFormFields = {
  nombre: string;
  juzgado: string;
  juzgado_id: string | null;
  departamento: string;
  numero_expediente: string;
  // documento is derived from cuil on save and kept in sync: mail-match and the
  // escritos token layer still read it (locked decision #11).
  documento: string;
  cuil: string;
  domicilio: string;
  telefono: string;
  deuda_inicial: number;
  gastos: number;
  // Both blank by default — NULL means "not entered", not zero.
  fecha_gastos: string | null;
  interes_gastos: number | null;
  fecha_mora: string | null;
  fecha_deuda: string | null;
  dinero_en_cuenta: number | null;
  movimiento: Movimiento | null;
  movimiento_diligenciada: boolean | null;
  empresa: string | null;
  medida_cautelar: MedidaCautelar | null;
  medida_cautelar_estado: MedidaEstado | null;
  medida_cautelar_diligenciada: boolean;
  medida_cautelar_nota: string;
  observaciones: string;
};

// Formalize a free-text expediente into a consistent stored shape so the mess we
// inherited (bare digits, "OL-840-2019", "TD1436 2021", "16183 - 2024"…) can't
// reappear via the form. Uses the SAME extractor the matcher reads, so what we
// store always round-trips: "TD1436 2021" → "TD-1436-2021", "16183 - 2024" →
// "16183/2024", "1513" → "1513". Unparseable input is returned verbatim and
// rejected by validateEjecutadoFields.
export function normalizeNumeroExpediente(raw: string): string {
  const t = raw.trim();
  if (t === "") return "";
  const { causa, depto, año } = extractCausa(t);
  if (!causa) return t;
  if (depto && año) return `${depto}-${causa}-${año}`;
  if (año) return `${causa}/${año}`;
  return causa;
}

// Form-level validation shared by the create and update actions. Returns a
// user-facing (Spanish) error string, or null when the fields are acceptable.
export function validateEjecutadoFields(f: EjecutadoFormFields): string | null {
  if (!f.nombre) return "El nombre del demandado es obligatorio.";
  if (f.cuil !== "" && !isValidCuil(f.cuil)) {
    return "CUIL inválido: revisá el número, el dígito verificador no coincide.";
  }
  if (f.numero_expediente !== "" && extractCausa(f.numero_expediente).causa === null) {
    return "N° de expediente inválido: debe contener un número de causa (1 a 7 dígitos).";
  }
  // Only validated when present — blank stays blank rather than becoming 0.
  if (f.interes_gastos !== null && !(f.interes_gastos >= 0)) {
    return "El interés sobre gastos no puede ser negativo.";
  }
  return null;
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function numOrNull(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Radix Select can't use "" as a value, so the UI sends "__none__" for "no choice".
function selectNullable(raw: string): string | null {
  return raw === "" || raw === "__none__" ? null : raw;
}

// 3-state Select: "si" / "no" / "__unknown__" (or empty) -> true / false / null.
function triState(raw: string): boolean | null {
  return raw === "si" ? true : raw === "no" ? false : null;
}

export function parseEjecutadoFormData(fd: FormData): EjecutadoFormFields {
  const movRaw = selectNullable(str(fd, "movimiento")) ?? "";
  const movimiento = (MOVIMIENTO_OPTIONS as readonly string[]).includes(movRaw)
    ? (movRaw as Movimiento)
    : null;

  const medidaRaw = selectNullable(str(fd, "medida_cautelar")) ?? "";
  const medida_cautelar =
    medidaRaw === "embargo" || medidaRaw === "igb"
      ? (medidaRaw as MedidaCautelar)
      : null;

  const estadoRaw = selectNullable(str(fd, "medida_cautelar_estado")) ?? "";
  const estadoValid = (MEDIDA_ESTADO_OPTIONS as readonly string[]).includes(estadoRaw)
    ? (estadoRaw as MedidaEstado)
    : null;

  const empresaRaw = selectNullable(str(fd, "empresa"));

  // Normalize the mask before anything reads it, so a value typed without dashes
  // is stored the same way as one typed with them.
  const cuil = formatCuil(str(fd, "cuil"));

  return {
    nombre: str(fd, "nombre"),
    juzgado: str(fd, "juzgado"),
    juzgado_id: selectNullable(str(fd, "juzgado_id")),
    departamento: selectNullable(str(fd, "departamento")) ?? "",
    numero_expediente: normalizeNumeroExpediente(str(fd, "numero_expediente")),
    // Keep documento in sync from the CUIL whenever one is present.
    documento: cuil === "" ? str(fd, "documento") : cuilToDni(cuil),
    cuil,
    domicilio: str(fd, "domicilio"),
    telefono: str(fd, "telefono"),
    deuda_inicial: numOrNull(fd, "deuda_inicial") ?? 0,
    gastos: numOrNull(fd, "gastos") ?? 0,
    fecha_gastos: str(fd, "fecha_gastos") || null,
    interes_gastos: numOrNull(fd, "interes_gastos"),
    fecha_mora: str(fd, "fecha_mora") || null,
    fecha_deuda: str(fd, "fecha_deuda") || null,
    dinero_en_cuenta: numOrNull(fd, "dinero_en_cuenta"),
    movimiento,
    movimiento_diligenciada: triState(str(fd, "movimiento_diligenciada")),
    empresa: empresaRaw,
    medida_cautelar,
    // estado is only meaningful when a medida exists.
    medida_cautelar_estado: medida_cautelar ? estadoValid : null,
    medida_cautelar_diligenciada: str(fd, "medida_cautelar_diligenciada") === "si",
    medida_cautelar_nota: str(fd, "medida_cautelar_nota"),
    observaciones: str(fd, "observaciones"),
  };
}

/**
 * The "Pasar a extrajudicial" form. Reverting posts via=judicial and nothing
 * else, and the settlement columns come back NULL: they are only meaningful
 * under an agreement, and a stale monto left behind would let the convenio
 * generate against numbers nobody agreed to.
 */
export function parseViaFormData(fd: FormData): ViaFields {
  const via = isVia(str(fd, "via")) ? (str(fd, "via") as Via) : "judicial";
  if (via === "judicial") {
    return { via, monto_acuerdo: null, cuotas: null, fecha_vencimiento: null };
  }

  const cuotasRaw = numOrNull(fd, "cuotas");
  return {
    via,
    monto_acuerdo: numOrNull(fd, "monto_acuerdo"),
    cuotas: cuotasRaw !== null && isCuotas(cuotasRaw) ? cuotasRaw : null,
    fecha_vencimiento: str(fd, "fecha_vencimiento") || null,
  };
}

/**
 * All three settlement fields are required to go extrajudicial. The state exists
 * because a settlement was agreed, and the convenio cannot be written without
 * the amount, the instalment count and the first due date - a half-filled switch
 * would produce a Reconocimiento de Deuda pinned to the top of the feed that
 * prints markers where the numbers belong.
 */
export function validateViaFields(f: ViaFields): string | null {
  if (f.via === "judicial") return null;
  if (f.monto_acuerdo === null || !(f.monto_acuerdo > 0)) {
    return "El monto del acuerdo es obligatorio y debe ser mayor a cero.";
  }
  if (f.cuotas === null) {
    return "Elegí la cantidad de cuotas (1, 3, 6 o 12).";
  }
  if (!f.fecha_vencimiento) {
    return "La fecha de vencimiento de la primera cuota es obligatoria.";
  }
  return null;
}
