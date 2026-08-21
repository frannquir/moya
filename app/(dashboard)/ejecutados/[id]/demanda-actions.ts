"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateDemandado } from "@/lib/data/ejecutados";
import {
  parseDemandadoExtraFormData,
  validateDemandadoExtra,
} from "@/lib/domain/demanda";

/**
 * The demanda-only columns on the ejecutado, edited from the Demanda card.
 * Identity (nombre, cuil, domicilio, telefono) stays in the main "Datos" form so
 * the two never write the same column.
 */
export async function updateDemandaDatos(id: string, formData: FormData) {
  const supabase = await createClient();

  const extra = parseDemandadoExtraFormData(formData);
  const error = validateDemandadoExtra(extra);
  if (error) throw new Error(error);

  await updateDemandado(supabase, id, extra);

  revalidatePath(`/ejecutados/${id}`);
  redirect(`/ejecutados/${id}?toast=ejecutado_guardado`);
}
