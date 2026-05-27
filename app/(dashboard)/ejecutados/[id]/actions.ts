"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MOVIMIENTO_OPTIONS, type Movimiento } from "@/lib/domain/ejecutado";

export async function updateEjecutado(id: string, formData: FormData) {
  const supabase = await createClient();

  const movRaw = String(formData.get("movimiento") ?? "");
  const movimiento =
    movRaw === "" || movRaw === "__none__"
      ? null
      : (MOVIMIENTO_OPTIONS as readonly string[]).includes(movRaw)
        ? (movRaw as Movimiento)
        : null;

  const { error } = await supabase
    .from("ejecutados")
    .update({
      nombre: String(formData.get("nombre") ?? "").trim(),
      juzgado: String(formData.get("juzgado") ?? ""),
      departamento: String(formData.get("departamento") ?? ""),
      numero_expediente: String(formData.get("numero_expediente") ?? ""),
      deuda_inicial: Number(formData.get("deuda_inicial") ?? 0) || 0,
      movimiento,
      observaciones: String(formData.get("observaciones") ?? ""),
    })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/ejecutados");
  revalidatePath(`/ejecutados/${id}`);
}

export async function archiveEjecutado(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("ejecutados")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/ejecutados");
  redirect("/ejecutados");
}