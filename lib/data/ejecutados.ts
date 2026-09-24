import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type Tables } from "@/lib/supabase/db-helpers";
import {
  ORDEN_OPTIONS,
  ORDEN_DEFAULT,
  type EjecutadoCasoFields,
  type EjecutadoCautelarFields,
  type EjecutadoFormFields,
  type EjecutadoMontosFields,
  type EjecutadoMovimientoFields,
  type Orden,
  type Via,
  type ViaFields,
} from "@/lib/domain/ejecutado";
import { type DemandadoExtraFields } from "@/lib/domain/demanda";
import { urgenciaDeCaso } from "@/lib/domain/urgencia";

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
    assignedTo,
    via,
    orden = ORDEN_DEFAULT,
  }: {
    q?: string;
    page?: number;
    pageSize?: number;
    assignedTo?: string;
    via?: Via;
    orden?: Orden;
  } = {},
): Promise<{ items: Ejecutado[]; totalCount: number }> {
  const term = q.trim().slice(0, 100);
  const from = (Math.max(1, page) - 1) * pageSize;
  const to = from + pageSize - 1;

  // The sort column comes from a closed table, never from the query string —
  // .order() interpolates its argument, so an arbitrary value would be injected.
  const sort = ORDEN_OPTIONS.find((o) => o.value === orden) ?? ORDEN_OPTIONS[0];

  let query = supabase
    .from("ejecutados")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .eq("is_draft", false)
    .order(sort.column, { ascending: sort.asc, nullsFirst: false })
    // Tiebreaker, so paging is stable when the sort column repeats — juzgado and
    // deuda both have plenty of ties, and without this a row can appear on two
    // pages or on neither.
    .order("id", { ascending: true })
    .range(from, to);

  // UI scope (e.g. the head's "Miembro" view), not a security boundary — RLS still applies.
  if (assignedTo) {
    query = query.eq("assigned_to_user_id", assignedTo);
  }

  // Also a UI scope, not a boundary: the via filter on /ejecutados.
  if (via) {
    query = query.eq("via", via);
  }

  if (term) {
    query = query.ilike("nombre", `%${escapeLike(term)}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { items: data ?? [], totalCount: count ?? 0 };
}

export type EjecutadosStats = {
  total: number;
  actualizadosHoy: number;
  extrajudiciales: number;
  deudaTotal: number;
  /** Cases nobody has touched in DIAS_URGENTE — the list's red figure. */
  urgentes: number;
};

/**
 * The figures above the list. Scoped exactly like the list itself — same
 * assignedTo, same via filter — so the header always describes the rows you are
 * looking at rather than the whole estudio.
 *
 * `deuda_inicial` is summed client-side over the id/deuda pair rather than in
 * Postgres: there is no aggregate RPC and adding one is a migration, while the
 * estudio is a few hundred rows. Revisit past a few thousand.
 */
export async function getStats(
  supabase: Client,
  { assignedTo, via }: { assignedTo?: string; via?: Via } = {},
): Promise<EjecutadosStats> {
  let query = supabase
    .from("ejecutados")
    .select("deuda_inicial, updated_at, via")
    .is("archived_at", null)
    .eq("is_draft", false);

  if (assignedTo) query = query.eq("assigned_to_user_id", assignedTo);
  if (via) query = query.eq("via", via);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];

  // "Hoy" in the reader's own day, not UTC: a case touched at 21:00 in Buenos
  // Aires is today's work, and comparing against a UTC date boundary would drop
  // it after 21:00 local.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return {
    total: rows.length,
    actualizadosHoy: rows.filter(
      (r) => r.updated_at && new Date(r.updated_at) >= startOfDay,
    ).length,
    extrajudiciales: rows.filter((r) => r.via === "extrajudicial").length,
    deudaTotal: rows.reduce((sum, r) => sum + Number(r.deuda_inicial ?? 0), 0),
    // Same updated_at the rows colour their edge bar from, so the figure and the
    // bars below it can never disagree.
    urgentes: rows.filter((r) => urgenciaDeCaso(r.updated_at) === "urgente").length,
  };
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
    // Set by the "Iniciar demanda" flow; drives the Demanda card on the detail
    // page and tells 2B which cases it owns.
    origen?: "manual" | "demanda" | "migracion";
    demandado?: DemandadoExtraFields;
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
      ...(input.demandado ?? {}),
      ...(input.origen ? { origen: input.origen } : {}),
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

/**
 * The detail page's LEFT column. Its own update path over a disjoint column set:
 * routing it through `update()` would spread the full EjecutadoFormFields shape
 * and blank the money columns the right column owns (gotcha #41).
 */
export async function updateCaso(
  supabase: Client,
  id: string,
  fields: EjecutadoCasoFields,
): Promise<void> {
  const { error } = await supabase.from("ejecutados").update(fields).eq("id", id);
  if (error) throw error;
}

/** The medida cautelar card, its own disjoint column set. */
export async function updateCautelar(
  supabase: Client,
  id: string,
  fields: EjecutadoCautelarFields,
): Promise<void> {
  const { error } = await supabase.from("ejecutados").update(fields).eq("id", id);
  if (error) throw error;
}

/** The detail page's RIGHT column: the liquidación's inputs, beside its result. */
export async function updateMontos(
  supabase: Client,
  id: string,
  fields: EjecutadoMontosFields,
): Promise<void> {
  const { error } = await supabase.from("ejecutados").update(fields).eq("id", id);
  if (error) throw error;
}

/**
 * The header's movimiento dropdown. Its own disjoint column set — see
 * `EjecutadoMovimientoFields` (gotcha #41): the "Datos del demandado" form no
 * longer posts these two columns, so routing them through `updateCaso()`
 * would blank the stage on every save of that form.
 */
export async function updateMovimiento(
  supabase: Client,
  id: string,
  fields: EjecutadoMovimientoFields,
): Promise<void> {
  const { error } = await supabase.from("ejecutados").update(fields).eq("id", id);
  if (error) throw error;
}

/**
 * The extrajudicial switch. Its own update path rather than a field on
 * EjecutadoFormFields: the main "Datos" form does not post these columns, so
 * folding them into that spread would blank the settlement on every save.
 */
export async function updateVia(
  supabase: Client,
  id: string,
  fields: ViaFields,
): Promise<void> {
  const { error } = await supabase.from("ejecutados").update(fields).eq("id", id);
  if (error) throw error;
}

/** The demanda-only columns, edited from the Demanda card on the detail page. */
export async function updateDemandado(
  supabase: Client,
  id: string,
  fields: DemandadoExtraFields,
): Promise<void> {
  const { error } = await supabase.from("ejecutados").update(fields).eq("id", id);
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
