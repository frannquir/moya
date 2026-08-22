"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { renderTemplate } from "@/lib/domain/template-engine";
import { buildEscritoScope, generarDemanda, insertEscrito } from "@/lib/data/escrito-render";

export async function generarEscrito(ejecutadoId: string, formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "");
  if (!templateId) throw new Error("template_id is required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: template } = await supabase
    .from("escritos_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  if (!template) throw new Error("template not found");

  // A fragmento is a piece of another document and the demanda has its own
  // entry point; neither is generable from the library. The queries that feed
  // the UI already filter these out, so reaching here means a hand-made request.
  if (template.tipo !== "escrito") {
    throw new Error("Ese tipo de plantilla no se genera desde la biblioteca");
  }

  const { scope, ejecutado } = await buildEscritoScope(supabase, {
    ejecutadoId,
    esDemanda: false,
  });

  const created = await insertEscrito(supabase, {
    estudioId: ejecutado.estudio_id,
    ejecutadoId,
    templateId: template.id,
    userId: user.id,
    titulo: template.titulo,
    contenido: renderTemplate(template.contenido, scope),
  });

  revalidatePath("/escritos");
  revalidatePath(`/ejecutados/${ejecutadoId}`);
  redirect(`/escritos/${created.id}`);
}

/**
 * "Generar de nuevo" on the Demanda card. The party list or the employment of a
 * party may have changed since the case was created, so this recomposes section
 * VII from current data. It always writes a NEW escrito row — an earlier one may
 * already have been filed and must not be overwritten.
 */
export async function regenerarDemanda(ejecutadoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const created = await generarDemanda(supabase, { ejecutadoId, userId: user.id });

  revalidatePath("/escritos");
  revalidatePath(`/ejecutados/${ejecutadoId}`);
  redirect(`/escritos/${created.id}`);
}
