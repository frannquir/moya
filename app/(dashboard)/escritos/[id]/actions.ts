"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { renderEscritoBody } from "@/lib/data/escrito-render";

/**
 * What the escrito editor gets back. Problems are RETURNED, never thrown: a
 * throw escapes to the dashboard error boundary, which unmounts the form,
 * replaces the page with "Algo salió mal" and buries the message in a collapsed
 * <details> — costing the user everything they typed into a document they were
 * about to file. Same pattern and same reason as `updateLawyerProfile` and
 * `updateEstudioEscritosConfig`.
 */
export type EscritoState = { ok: true } | { error: string } | null;

/** "Restaurar original" hands the re-rendered text back so the editor can show it. */
export type RestaurarResult = { contenido: string } | { error: string };

export async function updateEscrito(
  id: string,
  _prev: EscritoState,
  formData: FormData,
): Promise<EscritoState> {
  const supabase = await createClient();

  // `.select()` is the whole point of this shape. PostgREST returns no error
  // and zero rows when RLS filters the target row out, so without it an UPDATE
  // that wrote nothing is indistinguishable from one that worked — and the
  // editor's controlled state keeps showing the typed text either way, so the
  // screen agrees with the user right up until they come back to the page.
  const { data, error } = await supabase
    .from("escritos")
    .update({
      titulo: String(formData.get("titulo") ?? "").trim(),
      contenido: String(formData.get("contenido") ?? ""),
    })
    .eq("id", id)
    .select("id");

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  if (!data || data.length === 0) {
    return {
      error:
        "No se guardó nada: el escrito ya no existe o no tenés permiso para " +
        "editarlo. Copiá el texto antes de salir de esta página.",
    };
  }

  revalidatePath("/escritos");
  revalidatePath(`/escritos/${id}`);
  return { ok: true };
}

export async function archiveEscrito(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("escritos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");

  if (error) throw error;
  // Same zero-row check as updateEscrito. This one throws rather than returning:
  // nothing the user typed is at risk here, and a silent redirect to /escritos
  // with the escrito still sitting in the list is worse than the error boundary.
  if (!data || data.length === 0) {
    throw new Error("No se archivó el escrito: no existe o no tenés permiso.");
  }

  revalidatePath("/escritos");
  redirect("/escritos");
}

/**
 * Put a hand-edited escrito back to what the template produces.
 *
 * "Original" means re-rendered from TODAY's data, not the bytes generated last
 * month — the estudio's config and the case may both have changed since, so the
 * result can legitimately differ from what was first generated. The confirm
 * dialog says so.
 *
 * Overwrites in place rather than inserting, which is what separates it from
 * "Generar de nuevo" on the Demanda card: that one deliberately keeps the old
 * escrito because it may already have been filed.
 */
export async function restaurarEscrito(id: string): Promise<RestaurarResult> {
  const supabase = await createClient();

  const { data: escrito } = await supabase
    .from("escritos")
    .select("id, ejecutado_id, template_id")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (!escrito) return { error: "No se encontró el escrito." };

  // template_id is ON DELETE SET NULL, so a template retired from the library
  // leaves nothing to re-render from. The button is disabled in that case; this
  // is the guard for a request that arrives anyway.
  if (!escrito.template_id) {
    return {
      error:
        "Este escrito ya no tiene plantilla asociada, así que no se puede restaurar.",
    };
  }

  const { data: template } = await supabase
    .from("escritos_templates")
    .select("clave, contenido")
    .eq("id", escrito.template_id)
    .maybeSingle();
  if (!template) {
    return { error: "No se encontró la plantilla original de este escrito." };
  }

  const { contenido } = await renderEscritoBody(supabase, {
    ejecutadoId: escrito.ejecutado_id,
    template,
  });

  const { data, error } = await supabase
    .from("escritos")
    .update({ contenido })
    .eq("id", id)
    .select("id");

  if (error) return { error: `No se pudo restaurar: ${error.message}` };
  if (!data || data.length === 0) {
    return {
      error: "No se restauró nada: no tenés permiso para editar este escrito.",
    };
  }

  revalidatePath("/escritos");
  revalidatePath(`/escritos/${id}`);
  return { contenido };
}
