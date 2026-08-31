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

/**
 * A stable key per movimiento, so the UI can colour a case by its stage without
 * matching on the Spanish label — rewording an option would otherwise silently
 * drop its colour and leave one grey row in a coloured table.
 *
 * `satisfies` (not `:`) keeps the literal types, so `Etapa` stays the union of
 * the five keys rather than widening to string, AND still fails the build if a
 * movimiento is added to MOVIMIENTO_OPTIONS without a key here.
 */
export const MOVIMIENTO_ETAPA = {
  "Inicio Causa": "inicio",
  "Enviar Cédula": "cedula",
  "Enviar Mandamiento": "mandamiento",
  "Pedir Sentencia": "sentencia",
  "En Cobro": "cobro",
} as const satisfies Record<Movimiento, string>;

export type Etapa = (typeof MOVIMIENTO_ETAPA)[Movimiento];

/**
 * The etapa a stored movimiento belongs to. NULL — and any value that predates
 * the current option list — reads as "no stage", which the UI renders neutral
 * rather than guessing a colour.
 */
export function etapaDe(movimiento: string | null | undefined): Etapa | null {
  if (!movimiento) return null;
  return (MOVIMIENTO_ETAPA as Record<string, Etapa>)[movimiento] ?? null;
}

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

/**
 * The orderings the list offers. "recientes" is most recently added and is the
 * default; "actualizados" answers a different question — what moved lately.
 */
export const ORDEN_OPTIONS = [
  { value: "recientes", label: "Agregados recientemente", column: "created_at", asc: false },
  { value: "actualizados", label: "Actualizados recientemente", column: "updated_at", asc: false },
  // nombre_orden, not nombre: a generated lower(btrim(nombre)) column, because
  // PostgREST's .order() takes a column name and cannot express lower(nombre).
  { value: "alfabetico", label: "Alfabético (A-Z)", column: "nombre_orden", asc: true },
  { value: "deuda", label: "Mayor deuda", column: "deuda_inicial", asc: false },
  { value: "juzgado", label: "Juzgado", column: "juzgado", asc: true },
] as const;

export type Orden = (typeof ORDEN_OPTIONS)[number]["value"];

export const ORDEN_DEFAULT: Orden = "recientes";

export function isOrden(value: string | null | undefined): value is Orden {
  return ORDEN_OPTIONS.some((o) => o.value === value);
}

export function ordenOf(value: string | null | undefined): Orden {
  return isOrden(value) ? value : ORDEN_DEFAULT;
}

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

// The detail page edits the case on the left and the liquidación's inputs on the
// right, so it saves through separate forms — and separate forms need disjoint
// column sets, never one shared type. `EjecutadoFormFields` is spread straight
// into `.update()`, so a form posting half of it would write NULL over the other
// half (gotcha #41). It stays as it is and keeps serving creation, where every
// field really is on one form; the types below serve editing only.

/** Right column: the figures and dates the liquidación is computed from. */
export type EjecutadoMontosFields = {
  deuda_inicial: number;
  gastos: number;
  fecha_gastos: string | null;
  interes_gastos: number | null;
  fecha_mora: string | null;
  fecha_deuda: string | null;
};

/**
 * The medida cautelar block. Its own set because Codemandados sits between it and
 * the identity fields and carries a form of its own, and nested forms are invalid
 * HTML — a separate card means a separate disjoint parser.
 *
 * dinero_en_cuenta rides along: it only exists because an embargo was granted.
 */
export type EjecutadoCautelarFields = {
  medida_cautelar: MedidaCautelar | null;
  medida_cautelar_estado: MedidaEstado | null;
  medida_cautelar_diligenciada: boolean;
  medida_cautelar_nota: string;
  dinero_en_cuenta: number | null;
};

/**
 * What is left: identity, expediente, movimiento, observaciones. Derived by Omit,
 * so a new column that joins neither other set lands here rather than nowhere.
 */
export type EjecutadoCasoFields = Omit<
  EjecutadoFormFields,
  keyof EjecutadoMontosFields | keyof EjecutadoCautelarFields
>;

// The money half must name real columns of EjecutadoFormFields with the same
// types, so a typo or a drifted type stops the build.
//
// It cannot catch an under-split: EjecutadoCasoFields is derived by Omit, so a
// column left out of the money half lands in the caso half automatically.
// Completeness comes from that derivation, not from this assertion.
type _MontosAreRealColumns =
  EjecutadoMontosFields extends Pick<EjecutadoFormFields, keyof EjecutadoMontosFields>
    ? true
    : never;
const _montosCheck: _MontosAreRealColumns = true;
void _montosCheck;

type _CautelarAreRealColumns =
  EjecutadoCautelarFields extends Pick<EjecutadoFormFields, keyof EjecutadoCautelarFields>
    ? true
    : never;
const _cautelarCheck: _CautelarAreRealColumns = true;
void _cautelarCheck;

export function parseMontosFormData(fd: FormData): EjecutadoMontosFields {
  return {
    deuda_inicial: numOrNull(fd, "deuda_inicial") ?? 0,
    gastos: numOrNull(fd, "gastos") ?? 0,
    fecha_gastos: str(fd, "fecha_gastos") || null,
    interes_gastos: numOrNull(fd, "interes_gastos"),
    fecha_mora: str(fd, "fecha_mora") || null,
    fecha_deuda: str(fd, "fecha_deuda") || null,
  };
}

export function validateMontosFields(f: EjecutadoMontosFields): string | null {
  if (f.interes_gastos !== null && !(f.interes_gastos >= 0)) {
    return "El interés sobre gastos no puede ser negativo.";
  }
  if (!(f.deuda_inicial >= 0)) return "La deuda inicial no puede ser negativa.";
  if (!(f.gastos >= 0)) return "Los gastos no pueden ser negativos.";
  return null;
}

export function parseCautelarFormData(fd: FormData): EjecutadoCautelarFields {
  const all = parseEjecutadoFormData(fd);
  return {
    medida_cautelar: all.medida_cautelar,
    medida_cautelar_estado: all.medida_cautelar_estado,
    medida_cautelar_diligenciada: all.medida_cautelar_diligenciada,
    medida_cautelar_nota: all.medida_cautelar_nota,
    dinero_en_cuenta: all.dinero_en_cuenta,
  };
}

/** The caso half, parsed from its own form. */
export function parseCasoFormData(fd: FormData): EjecutadoCasoFields {
  // One parser, so CUIL masking, documento sync, expediente normalisation and the
  // tri-state selects stay in one place; the money half is dropped after.
  const all = parseEjecutadoFormData(fd);
  const {
    deuda_inicial: _d,
    gastos: _g,
    fecha_gastos: _fg,
    interes_gastos: _ig,
    fecha_mora: _fm,
    fecha_deuda: _fd2,
    medida_cautelar: _mc,
    medida_cautelar_estado: _mce,
    medida_cautelar_diligenciada: _mcd,
    medida_cautelar_nota: _mcn,
    dinero_en_cuenta: _dec,
    ...caso
  } = all;
  void [_d, _g, _fg, _ig, _fm, _fd2, _mc, _mce, _mcd, _mcn, _dec];
  return caso;
}

export function validateCasoFields(f: EjecutadoCasoFields): string | null {
  if (!f.nombre) return "El nombre del demandado es obligatorio.";
  if (f.cuil !== "" && !isValidCuil(f.cuil)) {
    return "CUIL inválido: revisá el número, el dígito verificador no coincide.";
  }
  if (f.numero_expediente !== "" && extractCausa(f.numero_expediente).causa === null) {
    return "N° de expediente inválido: debe contener un número de causa (1 a 7 dígitos).";
  }
  return null;
}
