"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseEjecutadoFormData } from "@/lib/domain/ejecutado";
import { requireUser, getCurrentEstudioId } from "@/lib/data/auth";
import { create } from "@/lib/data/ejecutados";
import { generateLiquidacion } from "@/lib/data/liquidaciones";

export async function createEjecutado(formData: FormData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const estudioId = await getCurrentEstudioId(supabase);

  const fields = parseEjecutadoFormData(formData);
  if (!fields.nombre) throw new Error("Nombre is required");

  const isDraft = String(formData.get("intent") ?? "activo") === "borrador";

  // New cases are delegated to their creator: a member's case is theirs (and
  // satisfies the INSERT RLS check); a head's case is the head's (head sees all).
  const created = await create(supabase, {
    estudioId,
    userId: user.id,
    isDraft,
    assignedToUserId: user.id,
    fields,
  });

  // Same generator the update action and the migration use: a brand-new case with
  // fecha_mora + deuda_inicial gets its liquidación immediately, not only once edited.
  await generateLiquidacion(supabase, created.id);

  revalidatePath("/ejecutados");
  revalidatePath("/borradores");
  revalidatePath("/liquidaciones");
  redirect(`/ejecutados/${created.id}?toast=ejecutado_creado`);
}
