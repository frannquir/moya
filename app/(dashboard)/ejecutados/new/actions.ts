"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MOVIMIENTO_OPTIONS, type Movimiento } from "@/lib/domain/ejecutado";

export async function createEjecutado(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: estudio } = await supabase
    .from("estudio_members")
    .select("estudio_id")
    .eq("user_id", user.id)
    .single();
  if (!estudio) throw new Error("No estudio for user");

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("Nombre is required");

  const movRaw = String(formData.get("movimiento") ?? "");
  const movimiento =
    (MOVIMIENTO_OPTIONS as readonly string[]).includes(movRaw)
      ? (movRaw as Movimiento)
      : null;

  const deuda_inicial = Number(formData.get("deuda_inicial") ?? 0) || 0;
  const isDraft = String(formData.get("intent") ?? "activo") === "borrador";

  const { data: created, error } = await supabase
    .from("ejecutados")
    .insert({
      estudio_id: estudio.estudio_id,
      created_by_user_id: user.id,
      nombre,
      juzgado: String(formData.get("juzgado") ?? ""),
      departamento: String(formData.get("departamento") ?? ""),
      numero_expediente: String(formData.get("numero_expediente") ?? ""),
      deuda_inicial,
      movimiento,
      observaciones: String(formData.get("observaciones") ?? ""),
      is_draft: isDraft,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/ejecutados");
  revalidatePath("/borradores");
  redirect(`/ejecutados/${created.id}`);
}