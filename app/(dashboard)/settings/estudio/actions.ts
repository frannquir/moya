"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateEstudio(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: estudio } = await supabase
    .from("estudios")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!estudio) throw new Error("Only the head can edit estudio settings");

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("Nombre is required");

  const { error } = await supabase
    .from("estudios")
    .update({ nombre })
    .eq("id", estudio.id);

  if (error) throw error;

  revalidatePath("/settings/estudio");
}