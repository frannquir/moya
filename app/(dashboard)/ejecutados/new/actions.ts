"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseEjecutadoFormData } from "@/lib/domain/ejecutado";
import { requireUser, getCurrentEstudioId } from "@/lib/data/auth";
import { create } from "@/lib/data/ejecutados";

export async function createEjecutado(formData: FormData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const estudioId = await getCurrentEstudioId(supabase);

  const fields = parseEjecutadoFormData(formData);
  if (!fields.nombre) throw new Error("Nombre is required");

  const isDraft = String(formData.get("intent") ?? "activo") === "borrador";

  const created = await create(supabase, {
    estudioId,
    userId: user.id,
    isDraft,
    fields,
  });

  revalidatePath("/ejecutados");
  revalidatePath("/borradores");
  redirect(`/ejecutados/${created.id}?toast=ejecutado_creado`);
}
