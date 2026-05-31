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
    departamento: selectNullable(str(fd, "departamento")) ?? "",
    numero_expediente: str(fd, "numero_expediente"),
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
