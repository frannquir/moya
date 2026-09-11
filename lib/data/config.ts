import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import {
  sortTasasChronological,
  type TasaRow,
  type TasaRowFull,
} from "@/lib/domain/liquidaciones";

type Client = SupabaseClient<Database>;

// The two global reference values every peso figure in the app derives from.
// Both live outside any estudio and, until 20260905130000, could only be changed
// over SQL — which is how the JUS went five months stale and the BCRA rates
// stopped three months short without anything complaining.

export type JusConfig = {
  value: number;
  /** Date the value took effect (ISO), as published by the Colegio. */
  date: string | null;
  /** When the row was last written — how stale the figure is. */
  updatedAt: string | null;
};

export async function getJusConfig(supabase: Client): Promise<JusConfig | null> {
  const { data, error } = await supabase
    .from("system_config")
    .select("value, updated_at")
    .eq("key", "jus_config")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const v = data.value as { value?: number; date?: string } | null;
  return {
    value: Number(v?.value ?? 0),
    date: v?.date ?? null,
    updatedAt: data.updated_at ?? null,
  };
}

// Head-only at the DB (policy "Head updates system_config"); a member's write
// matches no row and Postgres reports success on zero rows, so the caller is
// told explicitly rather than shown a silent no-op.
export async function setJusConfig(
  supabase: Client,
  input: { value: number; date: string },
): Promise<void> {
  if (!(input.value > 0)) throw new Error("El valor del JUS tiene que ser mayor a 0.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Ingresá la fecha de vigencia.");
  }

  const { data, error } = await supabase
    .from("system_config")
    .update({ value: { value: input.value, date: input.date } })
    .eq("key", "jus_config")
    .select("key");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("No se pudo actualizar el JUS. Solo el dueño del estudio puede hacerlo.");
  }
}

export async function listTasas(supabase: Client): Promise<TasaRowFull[]> {
  const { data, error } = await supabase
    .from("bcra_tasas")
    .select("mes, anio, tna, ints_punitorios, tea, cft");
  if (error) throw error;
  return sortTasasChronological(
    (data ?? []).map((r) => ({
      mes: r.mes,
      anio: r.anio,
      tna: Number(r.tna),
      intsPunitorios: r.ints_punitorios === null ? null : Number(r.ints_punitorios),
      tea: r.tea === null ? null : Number(r.tea),
      cft: r.cft === null ? null : Number(r.cft),
    })),
  );
}

export type { TasaRow, TasaRowFull };

// Upsert on the table's UNIQUE(anio, mes): re-pasting a month corrects it
// instead of duplicating it. Month names arrive already normalised to the
// domain's SETIEMBRE spelling from parsePastedTasaLine.
export async function upsertTasas(
  supabase: Client,
  rows: TasaRowFull[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const { data, error } = await supabase
    .from("bcra_tasas")
    .upsert(
      rows.map((r) => ({
        anio: r.anio,
        mes: r.mes,
        tna: r.tna,
        // Written even when null: re-pasting a month that only had Fin. Saldos
        // must be able to clear a wrong figure, not just add to it.
        ints_punitorios: r.intsPunitorios,
        tea: r.tea,
        cft: r.cft,
      })),
      { onConflict: "anio,mes" },
    )
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("No se pudieron guardar las tasas. Solo el dueño del estudio puede hacerlo.");
  }
  return data.length;
}


// --- Historial ---------------------------------------------------------------
//
// Written by DB triggers, never from here, so a change made over SQL is recorded
// too. Read-only for the app: there is no policy that lets it be edited.

export type ConfigHistorialEntry = {
  id: string;
  tipo: "jus" | "tasa";
  etiqueta: string;
  anterior: JusValue | TasaValue | null;
  nuevo: JusValue | TasaValue;
  /** '' when the change came from SQL or a service-role script — worth seeing. */
  porNombre: string;
  cuando: string;
  /** A change that created a value has nothing to go back to. */
  restaurable: boolean;
};

export type JusValue = { value: number; date: string | null };
export type TasaValue = {
  anio: number;
  mes: string;
  tna: number | null;
  ints_punitorios: number | null;
  tea: number | null;
  cft: number | null;
};

export async function listConfigHistorial(
  supabase: Client,
  limit = 30,
): Promise<ConfigHistorialEntry[]> {
  const { data, error } = await supabase
    .from("config_historial")
    .select("id, tipo, etiqueta, valor_anterior, valor_nuevo, changed_by_nombre, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    tipo: r.tipo as "jus" | "tasa",
    etiqueta: r.etiqueta,
    anterior: (r.valor_anterior ?? null) as JusValue | TasaValue | null,
    nuevo: r.valor_nuevo as unknown as JusValue | TasaValue,
    porNombre: r.changed_by_nombre,
    cuando: r.created_at,
    restaurable: r.valor_anterior !== null,
  }));
}

// Put a value back to what it was before one recorded change. Deliberately goes
// through the same writes a manual edit uses, so the RLS head check applies and
// the restore is itself logged — the history stays append-only and honest.
export async function restoreConfigValue(
  supabase: Client,
  historialId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("config_historial")
    .select("tipo, etiqueta, valor_anterior")
    .eq("id", historialId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No se encontró ese cambio en el historial.");
  if (data.valor_anterior === null) {
    throw new Error(`${data.etiqueta} no tenía un valor anterior: ese cambio lo creó.`);
  }

  if (data.tipo === "jus") {
    const v = data.valor_anterior as unknown as JusValue;
    await setJusConfig(supabase, {
      value: Number(v.value),
      // A jus_config written before the date field existed has none; the
      // restore should not invent one, so it keeps today's.
      date: v.date ?? new Date().toISOString().slice(0, 10),
    });
    return "Valor del JUS restaurado.";
  }

  const v = data.valor_anterior as unknown as TasaValue;
  if (v.tna === null) {
    throw new Error(`${data.etiqueta} no tenía tasa anterior para restaurar.`);
  }
  await upsertTasas(supabase, [
    {
      anio: v.anio,
      mes: v.mes,
      tna: Number(v.tna),
      intsPunitorios: v.ints_punitorios === null ? null : Number(v.ints_punitorios),
      tea: v.tea === null ? null : Number(v.tea),
      cft: v.cft === null ? null : Number(v.cft),
    },
  ]);
  return `${data.etiqueta} restaurado.`;
}
