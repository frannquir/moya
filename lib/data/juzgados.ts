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
  departamento: string;
  tipo: PickerTipo;
  numero: number | null;
  // Identity shared across departamentos for cross-filtering: Civil courts are
  // keyed by number (every depto's "N° 3" collapses to "civil:3"); Paz courts are
  // unique to one depto so they key by id.
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
}): CourtEntry {
  const tipo = row.tipo as PickerTipo;
  if (tipo === "Juzgado de Paz") {
    return {
      juzgadoId: row.id,
      departamento: row.departamento_judicial,
      tipo,
      numero: null,
      juzgadoKey: `paz:${row.id}`,
      label: `Paz - ${pazPartido(row.organismo)}`,
    };
  }
  return {
    juzgadoId: row.id,
    departamento: row.departamento_judicial,
    tipo,
    numero: row.numero,
    juzgadoKey: `civil:${row.numero}`,
    label: `Civil y Comercial N° ${row.numero}`,
  };
}

// Compact index (~293 rows) of Civil y Comercial + Paz courts for the picker.
export async function getCourtIndex(supabase: Client): Promise<CourtEntry[]> {
  const { data, error } = await supabase
    .from("juzgados")
    .select("id, departamento_judicial, tipo, numero, organismo")
    .in("tipo", PICKER_TIPOS as unknown as string[])
    .order("departamento_judicial")
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
