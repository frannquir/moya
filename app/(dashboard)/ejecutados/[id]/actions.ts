"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseEjecutadoFormData } from "@/lib/domain/ejecutado";
import { generateLiquidacion } from "@/lib/data/liquidaciones";
import { update, archive, unarchive, delegate } from "@/lib/data/ejecutados";
import { requireUser } from "@/lib/data/auth";

export async function updateEjecutado(id: string, formData: FormData) {
  const supabase = await createClient();

  const fields = parseEjecutadoFormData(formData);
  if (!fields.nombre) throw new Error("Nombre is required");

  await update(supabase, id, fields);

  await generateLiquidacion(supabase, id);

  revalidatePath("/ejecutados");
  revalidatePath(`/ejecutados/${id}`);
  revalidatePath("/liquidaciones");
  redirect(`/ejecutados/${id}?toast=ejecutado_guardado`);
}

export async function delegateEjecutado(id: string, formData: FormData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  // Head only — same gate as the other head-restricted flows. RLS is the real
  // boundary; this gives a clean error instead of a silent no-op.
  const { data: membership } = await supabase
    .from("estudio_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.role !== "head") {
    throw new Error("Only the head can delegate ejecutados");
  }

  // Empty value = "Sin delegar" (head-only).
  const raw = String(formData.get("assigned_to") ?? "");
  const assignedToUserId = raw === "" ? null : raw;

  await delegate(supabase, id, assignedToUserId);

  revalidatePath("/ejecutados");
  revalidatePath(`/ejecutados/${id}`);
}

export async function archiveEjecutado(id: string) {
  const supabase = await createClient();

  await archive(supabase, id);

  revalidatePath("/ejecutados");
  revalidatePath("/ejecutados/archivados");
  revalidatePath("/cobros");
  revalidatePath("/liquidaciones");
  revalidatePath("/escritos");
  redirect("/ejecutados/archivados");
}

export async function unarchiveEjecutado(id: string) {
  const supabase = await createClient();

  // Liquidaciones is a separate (not-yet-extracted) domain; restore its rows
  // inline here, and route the ejecutado row through the data module.
  await supabase
    .from("liquidaciones")
    .update({ archived_at: null })
    .eq("ejecutado_id", id);

  await unarchive(supabase, id);

  revalidatePath("/ejecutados");
  revalidatePath("/ejecutados/archivados");
  revalidatePath("/cobros");
  revalidatePath("/liquidaciones");
  revalidatePath("/escritos");
  revalidatePath(`/ejecutados/${id}`);
}