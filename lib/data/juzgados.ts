import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type Tables } from "@/lib/supabase/db-helpers";

type Client = SupabaseClient<Database>;
export type Juzgado = Tables<"juzgados">;

// Court types offered in the ejecutado picker (Receptorías are reference-only).
export const PICKER_TIPOS = [
  "Juzgado Civil y Comercial",
  "Juzgado de Paz",
] as const;
export type PickerTipo = (typeof PICKER_TIPOS)[number];

// One selectable court for the cross-filtered Departamento/Juzgado picker.
export type CourtEntry = {
  juzgadoId: string;
  // Seat city (localidad), e.g. "Tandil" — what the estudio calls "departamento".
  departamento: string;
  tipo: PickerTipo;
  numero: number | null;
  // Identity shared across cities for cross-filtering: Civil courts are keyed by
  // number (every city's "N° 3" collapses to "civil:3"); Paz courts are unique to
  // one city so they key by id.
  juzgadoKey: string;
  // Human label shown in the Juzgado dropdown.
  label: string;
};

const LOWER = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "a"]);

function titleCaseEs(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && LOWER.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * The court's name as the firm writes it in a filing.
 *
 * The SCBA publishes "Juzgado en lo Civil y Comercial Nº 2 - Azul" with a
 * masculine ordinal (º, U+00BA); every escrito the estudio files uses the degree
 * sign (°, U+00B0). The two look almost identical on screen and are different
 * characters in the filed text, so the raw string went straight into {{JUZGADO}}
 * until 2026-09-17 (Fran picked this rendering over the raw one and over
 * rebuilding the name from tipo + número + localidad — that third option prints
 * the seat city, and some courts are seated in a city other than the one their
 * own name carries).
 *
 * Nothing else about the string is touched: it is the court's official name.
 */
export function formatOrganismo(organismo: string | null | undefined): string {
  return String(organismo ?? "").replace(/º/g, "°");
}

function pazPartido(organismo: string): string {
  const after = organismo.split(" - ").slice(1).join(" - ").trim();
  return titleCaseEs(after || organismo);
}

function toEntry(row: {
  id: string;
  departamento_judicial: string;
  tipo: string;
  numero: number | null;
  organismo: string;
  localidad: string;
}): CourtEntry {
  const tipo = row.tipo as PickerTipo;
  // The estudio thinks of "departamento" as the seat city (Tandil, Olavarría,
  // Balcarce…), not the 20 judicial departments — and within a department the
  // court number repeats per city, so the city is what disambiguates. Key the
  // picker on localidad, falling back to the judicial department if missing.
  const ciudad = row.localidad?.trim() || row.departamento_judicial;
  if (tipo === "Juzgado de Paz") {
    return {
      juzgadoId: row.id,
      departamento: ciudad,
      tipo,
      numero: null,
      juzgadoKey: `paz:${row.id}`,
      label: `Paz - ${pazPartido(row.organismo)}`,
    };
  }
  return {
    juzgadoId: row.id,
    departamento: ciudad,
    tipo,
    numero: row.numero,
    juzgadoKey: `civil:${row.numero}`,
    label: `Civil y Comercial N° ${row.numero}`,
  };
}

// Compact index (~293 rows) of Civil y Comercial + Paz courts for the picker,
// keyed by seat city (localidad).
export async function getCourtIndex(supabase: Client): Promise<CourtEntry[]> {
  const { data, error } = await supabase
    .from("juzgados")
    .select("id, departamento_judicial, tipo, numero, organismo, localidad")
    .in("tipo", PICKER_TIPOS as unknown as string[])
    .order("localidad")
    .order("tipo")
    .order("numero");
  if (error) throw error;
  return (data ?? []).map(toEntry);
}

export async function getById(supabase: Client, id: string): Promise<Juzgado | null> {
  const { data, error } = await supabase
    .from("juzgados")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
