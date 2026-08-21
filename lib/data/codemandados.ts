import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type Tables } from "@/lib/supabase/db-helpers";
import { type PartyFields } from "@/lib/domain/demanda";

type Client = SupabaseClient<Database>;
export type Codemandado = Tables<"codemandados">;

export async function listByEjecutado(
  supabase: Client,
  ejecutadoId: string,
): Promise<Codemandado[]> {
  const { data, error } = await supabase
    .from("codemandados")
    .select("*")
    .eq("ejecutado_id", ejecutadoId)
    .is("archived_at", null)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Insert one row per party, keeping the order the form showed them in. RLS also
 * gates this: a non-head member can only write codemandados of an ejecutado
 * assigned to them.
 */
export async function createMany(
  supabase: Client,
  input: {
    estudioId: string;
    userId: string;
    ejecutadoId: string;
    parties: PartyFields[];
    ordenFrom?: number;
  },
): Promise<void> {
  if (input.parties.length === 0) return;
  const from = input.ordenFrom ?? 0;
  const rows = input.parties.map((p, i) => ({
    estudio_id: input.estudioId,
    created_by_user_id: input.userId,
    ejecutado_id: input.ejecutadoId,
    orden: from + i,
    ...p,
  }));
  const { error } = await supabase.from("codemandados").insert(rows);
  if (error) throw error;
}

/** Next free orden, so an "Agregar codemandado" lands after the existing cards. */
export async function nextOrden(supabase: Client, ejecutadoId: string): Promise<number> {
  const { data, error } = await supabase
    .from("codemandados")
    .select("orden")
    .eq("ejecutado_id", ejecutadoId)
    .order("orden", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0].orden + 1 : 0;
}

export async function update(
  supabase: Client,
  id: string,
  fields: PartyFields,
): Promise<void> {
  const { error } = await supabase.from("codemandados").update(fields).eq("id", id);
  if (error) throw error;
}

/** "Delete codemandado" in the UI. No DELETE policy exists (locked decision #3). */
export async function archive(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase
    .from("codemandados")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
