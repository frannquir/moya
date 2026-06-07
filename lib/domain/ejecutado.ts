import { extractCausa } from "./mail-match";

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

// codemandados is stored as TEXT[]. The form collects a comma/newline-separated
// string; split, trim, drop empties on the way in, join with ", " on the way out.
export function parseCodemandados(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function formatCodemandados(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
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
  documento: string;
  domicilio: string;
  codemandados: string[];
  deuda_inicial: number;
  gastos: number;
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
  if (f.numero_expediente !== "" && extractCausa(f.numero_expediente).causa === null) {
    return "N° de expediente inválido: debe contener un número de causa (1 a 7 dígitos).";
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

  return {
    nombre: str(fd, "nombre"),
    juzgado: str(fd, "juzgado"),
    juzgado_id: selectNullable(str(fd, "juzgado_id")),
    departamento: selectNullable(str(fd, "departamento")) ?? "",
    numero_expediente: normalizeNumeroExpediente(str(fd, "numero_expediente")),
    documento: str(fd, "documento"),
    domicilio: str(fd, "domicilio"),
    codemandados: parseCodemandados(str(fd, "codemandados")),
    deuda_inicial: numOrNull(fd, "deuda_inicial") ?? 0,
    gastos: numOrNull(fd, "gastos") ?? 0,
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
