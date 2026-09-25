import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type CarpetaOrdenable } from "@/lib/domain/carpetas";

type Client = SupabaseClient<Database>;

/**
 * Carpetas de ejecutados (G2). Context-agnostic like the rest of lib/data: the
 * board reads through the browser client, and the server actions write through
 * the server one.
 *
 * RLS decides everything here (20260925120000). A user reads their own folders
 * plus the ones shared with them, and writes only their own. Every write below
 * takes `.select("id")` and treats an empty result as a refusal, because a
 * filtered-out UPDATE returns no error (gotcha #45).
 */

export type CarpetaVista = {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  created_by_user_id: string | null;
  /** Active shares. The owner sees all of them; a recipient sees only their own. */
  shares: { user_id: string; puede_editar: boolean }[];
  /** Cases the /ejecutados list shows for this folder: active and not drafts. */
  activos: number;
  /**
   * Every case filed in it, drafts and archived included. This is what a share
   * hands over, so it is the number the share dialog quotes.
   */
  total: number;
};

/** ejecutado id -> the folders it is filed in (active links only). */
export type VinculosPorEjecutado = Record<string, string[]>;

/**
 * All active links the user can see, joined to the case so a case the user
 * cannot read drops out (`!inner`, gotcha #57). One query for the whole
 * estudio: it feeds both the chip counts and the per-row folder dots.
 *
 * PostgREST caps a response at 1000 rows on this project. Past a thousand
 * filed cases this would need paging, like FOLDER_FETCH_SIZE on the board.
 */
async function listVinculos(supabase: Client) {
  const { data, error } = await supabase
    .from("carpeta_ejecutados")
    .select("carpeta_id, ejecutado_id, ejecutado:ejecutados!inner(archived_at, is_draft)")
    .is("archived_at", null);
  if (error) throw error;
  return data ?? [];
}

export async function listCarpetas(
  supabase: Client,
): Promise<{ carpetas: CarpetaVista[]; vinculos: VinculosPorEjecutado }> {
  const [carpetasRes, vinculos] = await Promise.all([
    supabase
      .from("carpetas")
      .select(
        "id, nombre, color, orden, created_by_user_id, carpeta_shares(user_id, puede_editar, archived_at)",
      )
      .is("archived_at", null)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    listVinculos(supabase),
  ]);
  if (carpetasRes.error) throw carpetasRes.error;

  const activos = new Map<string, number>();
  const total = new Map<string, number>();
  const porEjecutado: VinculosPorEjecutado = {};
  for (const v of vinculos) {
    total.set(v.carpeta_id, (total.get(v.carpeta_id) ?? 0) + 1);
    if (v.ejecutado.archived_at === null && !v.ejecutado.is_draft) {
      activos.set(v.carpeta_id, (activos.get(v.carpeta_id) ?? 0) + 1);
    }
    (porEjecutado[v.ejecutado_id] ??= []).push(v.carpeta_id);
  }

  const carpetas = (carpetasRes.data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    color: c.color,
    orden: c.orden,
    created_by_user_id: c.created_by_user_id,
    shares: c.carpeta_shares
      .filter((s) => s.archived_at === null)
      .map((s) => ({ user_id: s.user_id, puede_editar: s.puede_editar })),
    activos: activos.get(c.id) ?? 0,
    total: total.get(c.id) ?? 0,
  }));

  return { carpetas, vinculos: porEjecutado };
}

/** The folders one case is filed in, among those the user can see. */
export async function carpetasDeEjecutado(
  supabase: Client,
  ejecutadoId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("carpeta_ejecutados")
    .select("carpeta_id")
    .eq("ejecutado_id", ejecutadoId)
    .is("archived_at", null);
  if (error) throw error;
  return (data ?? []).map((r) => r.carpeta_id);
}

/** Thrown when RLS filtered the target out: not the owner, or not visible. */
export class CarpetaRechazada extends Error {}

/** Postgres unique_violation on idx_carpetas_nombre_unico. */
export class CarpetaNombreRepetido extends Error {}

function rechazarSiVacio(data: unknown[] | null) {
  if (!data || data.length === 0) throw new CarpetaRechazada("carpeta write filtered out by RLS");
}

export async function crearCarpeta(
  supabase: Client,
  input: { estudioId: string; userId: string; nombre: string; color: string; orden: number },
): Promise<string> {
  const { data, error } = await supabase
    .from("carpetas")
    .insert({
      estudio_id: input.estudioId,
      created_by_user_id: input.userId,
      nombre: input.nombre,
      color: input.color,
      orden: input.orden,
    })
    .select("id")
    .single();
  if (error?.code === "23505") throw new CarpetaNombreRepetido(error.message);
  if (error) throw error;
  return data.id;
}

export async function actualizarCarpeta(
  supabase: Client,
  id: string,
  fields: { nombre?: string; color?: string },
): Promise<void> {
  const { data, error } = await supabase.from("carpetas").update(fields).eq("id", id).select("id");
  if (error?.code === "23505") throw new CarpetaNombreRepetido(error.message);
  if (error) throw error;
  rechazarSiVacio(data);
}

export async function archivarCarpeta(supabase: Client, id: string): Promise<void> {
  const { data, error } = await supabase
    .from("carpetas")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  rechazarSiVacio(data);
}

/** Writes the `orden` values moverCarpeta() computed. Two rows for a swap. */
export async function reordenarCarpetas(
  supabase: Client,
  cambios: CarpetaOrdenable[],
): Promise<void> {
  for (const c of cambios) {
    const { data, error } = await supabase
      .from("carpetas")
      .update({ orden: c.orden })
      .eq("id", c.id)
      .select("id");
    if (error) throw error;
    rechazarSiVacio(data);
  }
}

/**
 * Files a case, or brings back a link that was taken out: the UNIQUE on
 * (carpeta_id, ejecutado_id) covers archived rows, so this is an upsert that
 * clears archived_at.
 */
export async function archivarEnCarpeta(
  supabase: Client,
  input: { estudioId: string; userId: string; carpetaId: string; ejecutadoId: string },
): Promise<void> {
  const { data, error } = await supabase
    .from("carpeta_ejecutados")
    .upsert(
      {
        estudio_id: input.estudioId,
        carpeta_id: input.carpetaId,
        ejecutado_id: input.ejecutadoId,
        created_by_user_id: input.userId,
        archived_at: null,
      },
      { onConflict: "carpeta_id,ejecutado_id" },
    )
    .select("id");
  if (error) throw error;
  rechazarSiVacio(data);
}

export async function sacarDeCarpeta(
  supabase: Client,
  carpetaId: string,
  ejecutadoId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("carpeta_ejecutados")
    .update({ archived_at: new Date().toISOString() })
    .eq("carpeta_id", carpetaId)
    .eq("ejecutado_id", ejecutadoId)
    .is("archived_at", null)
    .select("id");
  if (error) throw error;
  rechazarSiVacio(data);
}

/** Head only (RLS). Sharing again after unsharing brings the same row back. */
export async function compartirCarpeta(
  supabase: Client,
  input: { estudioId: string; headId: string; carpetaId: string; userId: string },
): Promise<void> {
  const { data, error } = await supabase
    .from("carpeta_shares")
    .upsert(
      {
        estudio_id: input.estudioId,
        carpeta_id: input.carpetaId,
        user_id: input.userId,
        created_by_user_id: input.headId,
        puede_editar: true,
        archived_at: null,
      },
      { onConflict: "carpeta_id,user_id" },
    )
    .select("id");
  if (error) throw error;
  rechazarSiVacio(data);
}

export async function dejarDeCompartir(
  supabase: Client,
  carpetaId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("carpeta_shares")
    .update({ archived_at: new Date().toISOString() })
    .eq("carpeta_id", carpetaId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .select("id");
  if (error) throw error;
  rechazarSiVacio(data);
}
