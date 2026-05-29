"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateEscrito(id: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("escritos")
    .update({
      titulo: String(formData.get("titulo") ?? "").trim(),
      contenido: String(formData.get("contenido") ?? ""),
    })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/escritos");
  revalidatePath(`/escritos/${id}`);
}

export async function archiveEscrito(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("escritos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/escritos");
  redirect("/escritos");
}
