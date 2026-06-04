import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type Tables } from "@/lib/supabase/db-helpers";
import { type EjecutadoFormFields } from "@/lib/domain/ejecutado";

type Client = SupabaseClient<Database>;
export type Ejecutado = Tables<"ejecutados">;

const PAGE_SIZE_DEFAULT = 25;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}


export async function listActive(
  supabase: Client,
  {
    q = "",
    page = 1,
    pageSize = PAGE_SIZE_DEFAULT,
  }: { q?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: Ejecutado[]; totalCount: number }> {
  const term = q.trim().slice(0, 100);
  const from = (Math.max(1, page) - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("ejecutados")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .eq("is_draft", false)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (term) {
    query = query.ilike("nombre", `%${escapeLike(term)}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { items: data ?? [], totalCount: count ?? 0 };
}

export async function getById(
  supabase: Client,
  id: string,
): Promise<Ejecutado | null> {
  const { data, error } = await supabase
    .from("ejecutados")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listArchived(supabase: Client): Promise<Ejecutado[]> {
  const { data, error } = await supabase
    .from("ejecutados")
    .select("*")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function create(
  supabase: Client,
  input: {
    estudioId: string;
    userId: string;
    isDraft: boolean;
    assignedToUserId: string | null;
    fields: EjecutadoFormFields;
  },
): Promise<Ejecutado> {
  const { data, error } = await supabase
    .from("ejecutados")
    .insert({
      estudio_id: input.estudioId,
      created_by_user_id: input.userId,
      assigned_to_user_id: input.assignedToUserId,
      is_draft: input.isDraft,
      ...input.fields,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Head-only delegation (RLS enforces this; the caller also gates on role for a
// clean error). Pass null to make a case head-only ("Sin delegar").
export async function delegate(
  supabase: Client,
  id: string,
  assignedToUserId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("ejecutados")
    .update({ assigned_to_user_id: assignedToUserId })
    .eq("id", id);
  if (error) throw error;
}

export async function update(
  supabase: Client,
  id: string,
  fields: EjecutadoFormFields,
): Promise<void> {
  const { error } = await supabase
    .from("ejecutados")
    .update(fields)
    .eq("id", id);
  if (error) throw error;
}

export async function archive(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase
    .from("ejecutados")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function unarchive(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase
    .from("ejecutados")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) throw error;
}
