"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function activarBorrador(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ejecutados")
    .update({ is_draft: false })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/borradores");
  revalidatePath("/ejecutados");
  revalidatePath(`/ejecutados/${id}`);
}

export async function moverABorrador(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ejecutados")
    .update({ is_draft: true })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/borradores");
  revalidatePath("/ejecutados");
  revalidatePath(`/ejecutados/${id}`);
}