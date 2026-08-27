"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseCasoFormData,
  parseCautelarFormData,
  parseMontosFormData,
  validateCasoFields,
  validateMontosFields,
} from "@/lib/domain/ejecutado";
import { generateLiquidacion } from "@/lib/data/liquidaciones";
import {
  updateCaso,
  updateCautelar,
  updateMontos,
  archive,
  unarchive,
  delegate,
} from "@/lib/data/ejecutados";
import { requireUser } from "@/lib/data/auth";

/**
 * The LEFT column ("el caso"): identity, expediente, cautelar, notas.
 *
 * Does NOT regenerate the liquidación — every input it reads
 * (fecha_mora, deuda_inicial, gastos, fecha_deuda, interes_gastos) belongs to
 * the right column now, so nothing this form writes can change the result.
 */
export async function updateEjecutadoCaso(id: string, formData: FormData) {
  const supabase = await createClient();

  const fields = parseCasoFormData(formData);
  const validationError = validateCasoFields(fields);
  if (validationError) throw new Error(validationError);

  await updateCaso(supabase, id, fields);

  revalidatePath("/ejecutados");
  revalidatePath(`/ejecutados/${id}`);
  redirect(`/ejecutados/${id}?toast=ejecutado_guardado`);
}

/** The medida cautelar card. Its own disjoint set; see gotcha #41. */
export async function updateEjecutadoCautelar(id: string, formData: FormData) {
  const supabase = await createClient();
  await updateCautelar(supabase, id, parseCautelarFormData(formData));
  revalidatePath(`/ejecutados/${id}`);
  redirect(`/ejecutados/${id}?toast=ejecutado_guardado`);
}

/**
 * The RIGHT column ("el dinero"): the liquidación's inputs. This one DOES
 * regenerate, because that is exactly what it changed.
 */
export async function updateEjecutadoMontos(id: string, formData: FormData) {
  const supabase = await createClient();

  const fields = parseMontosFormData(formData);
  const validationError = validateMontosFields(fields);
  if (validationError) throw new Error(validationError);

  await updateMontos(supabase, id, fields);
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