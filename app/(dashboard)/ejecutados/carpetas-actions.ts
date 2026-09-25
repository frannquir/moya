"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/auth";
import {
  actualizarCarpeta,
  archivarCarpeta,
  archivarEnCarpeta,
  CarpetaNombreRepetido,
  compartirCarpeta,
  crearCarpeta,
  dejarDeCompartir,
  reordenarCarpetas,
  sacarDeCarpeta,
} from "@/lib/data/carpetas";
import {
  carpetaColorOf,
  moverCarpeta,
  siguienteOrden,
  validarNombreCarpeta,
} from "@/lib/domain/carpetas";

/**
 * Carpetas (G2). Two surfaces call these: the /ejecutados board through
 * useMutation, and the detail page's folder control. Each returns its error
 * instead of throwing, so a dialog keeps what the user typed. RLS is the
 * boundary; the role checks here only turn a refusal into a sentence.
 */

export type CarpetaResult = { error: string | null };

const OK: CarpetaResult = { error: null };

async function contexto() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const { data: membership, error } = await supabase
    .from("estudio_members")
    .select("estudio_id, role")
    .eq("user_id", user.id)
    .single();
  if (error || !membership) throw new Error("no estudio membership");
  return { supabase, user, estudioId: membership.estudio_id, isHead: membership.role === "head" };
}

function mensaje(e: unknown, fallback: string): string {
  if (e instanceof CarpetaNombreRepetido) return "Ya tenés una carpeta con ese nombre.";
  return fallback;
}

function revalidar(ejecutadoId?: string) {
  revalidatePath("/ejecutados");
  if (ejecutadoId) revalidatePath(`/ejecutados/${ejecutadoId}`);
}

export async function crearCarpetaAction(
  nombreRaw: string,
  colorRaw: string,
): Promise<CarpetaResult> {
  const nombre = validarNombreCarpeta(nombreRaw);
  if (!nombre.ok) return { error: nombre.error };
  const { supabase, user, estudioId } = await contexto();

  try {
    const { data: propias, error } = await supabase
      .from("carpetas")
      .select("id, orden")
      .eq("created_by_user_id", user.id)
      .is("archived_at", null);
    if (error) throw error;
    await crearCarpeta(supabase, {
      estudioId,
      userId: user.id,
      nombre: nombre.nombre,
      color: carpetaColorOf(colorRaw),
      orden: siguienteOrden(propias ?? []),
    });
  } catch (e) {
    return { error: mensaje(e, "No se pudo crear la carpeta.") };
  }
  revalidar();
  return OK;
}

export async function renombrarCarpetaAction(
  id: string,
  nombreRaw: string,
): Promise<CarpetaResult> {
  const nombre = validarNombreCarpeta(nombreRaw);
  if (!nombre.ok) return { error: nombre.error };
  const { supabase } = await contexto();
  try {
    await actualizarCarpeta(supabase, id, { nombre: nombre.nombre });
  } catch (e) {
    return { error: mensaje(e, "No se pudo renombrar.") };
  }
  revalidar();
  return OK;
}

export async function recolorearCarpetaAction(
  id: string,
  colorRaw: string,
): Promise<CarpetaResult> {
  const { supabase } = await contexto();
  try {
    await actualizarCarpeta(supabase, id, { color: carpetaColorOf(colorRaw) });
  } catch (e) {
    return { error: mensaje(e, "No se pudo cambiar el color.") };
  }
  revalidar();
  return OK;
}

export async function moverCarpetaAction(
  id: string,
  direccion: "arriba" | "abajo",
): Promise<CarpetaResult> {
  const { supabase, user } = await contexto();
  try {
    // Recomputed from the stored order, not from what the client last saw, so
    // two quick clicks cannot write a stale permutation.
    const { data: propias, error } = await supabase
      .from("carpetas")
      .select("id, orden")
      .eq("created_by_user_id", user.id)
      .is("archived_at", null)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    await reordenarCarpetas(
      supabase,
      moverCarpeta(propias ?? [], id, direccion === "arriba" ? "arriba" : "abajo"),
    );
  } catch (e) {
    return { error: mensaje(e, "No se pudo mover.") };
  }
  revalidar();
  return OK;
}

export async function archivarCarpetaAction(id: string): Promise<CarpetaResult> {
  const { supabase } = await contexto();
  try {
    await archivarCarpeta(supabase, id);
  } catch (e) {
    return { error: mensaje(e, "No se pudo archivar la carpeta.") };
  }
  revalidar();
  return OK;
}

/** Files the case in the folder, or takes it out. The row and the detail page share it. */
export async function ponerEnCarpetaAction(
  carpetaId: string,
  ejecutadoId: string,
  poner: boolean,
): Promise<CarpetaResult> {
  const { supabase, user, estudioId } = await contexto();
  try {
    if (poner) {
      await archivarEnCarpeta(supabase, { estudioId, userId: user.id, carpetaId, ejecutadoId });
    } else {
      await sacarDeCarpeta(supabase, carpetaId, ejecutadoId);
    }
  } catch (e) {
    return { error: mensaje(e, poner ? "No se pudo agregar." : "No se pudo sacar.") };
  }
  revalidar(ejecutadoId);
  return OK;
}

export async function compartirCarpetaAction(
  carpetaId: string,
  userId: string,
): Promise<CarpetaResult> {
  const { supabase, user, estudioId, isHead } = await contexto();
  if (!isHead) return { error: "Solo el dueño del estudio comparte carpetas." };
  if (userId === user.id) return { error: "Elegí a otro miembro." };
  try {
    await compartirCarpeta(supabase, { estudioId, headId: user.id, carpetaId, userId });
  } catch (e) {
    return { error: mensaje(e, "No se pudo compartir.") };
  }
  revalidar();
  return OK;
}

export async function dejarDeCompartirAction(
  carpetaId: string,
  userId: string,
): Promise<CarpetaResult> {
  const { supabase, isHead } = await contexto();
  if (!isHead) return { error: "Solo el dueño del estudio comparte carpetas." };
  try {
    await dejarDeCompartir(supabase, carpetaId, userId);
  } catch (e) {
    return { error: mensaje(e, "No se pudo dejar de compartir.") };
  }
  revalidar();
  return OK;
}
