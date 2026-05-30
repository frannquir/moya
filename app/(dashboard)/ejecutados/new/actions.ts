"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseEjecutadoFormData } from "@/lib/domain/ejecutado";

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

  const fields = parseEjecutadoFormData(formData);
  if (!fields.nombre) throw new Error("Nombre is required");

  const isDraft = String(formData.get("intent") ?? "activo") === "borrador";

  const { data: created, error } = await supabase
    .from("ejecutados")
    .insert({
      estudio_id: estudio.estudio_id,
      created_by_user_id: user.id,
      is_draft: isDraft,
      ...fields,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/ejecutados");
  revalidatePath("/borradores");
  redirect(`/ejecutados/${created.id}`);
}
