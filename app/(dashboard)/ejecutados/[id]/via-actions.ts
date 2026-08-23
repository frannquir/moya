"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseViaFormData, validateViaFields } from "@/lib/domain/ejecutado";
import { updateVia } from "@/lib/data/ejecutados";

/**
 * "Pasar a extrajudicial" and "Volver a judicial", both through one action —
 * the form posts the target via, and reverting simply posts judicial, which
 * parseViaFormData answers with three NULLs.
 *
 * Separate from updateEjecutado on purpose: that action spreads
 * EjecutadoFormFields into the UPDATE and the main "Datos" form does not carry
 * these columns, so routing the switch through it would blank the settlement.
 */
export async function actualizarVia(id: string, formData: FormData) {
  const supabase = await createClient();

  const fields = parseViaFormData(formData);
  const validationError = validateViaFields(fields);
  if (validationError) throw new Error(validationError);

  const previa = String(formData.get("via_actual") ?? "judicial");
  await updateVia(supabase, id, fields);

  revalidatePath("/ejecutados");
  revalidatePath(`/ejecutados/${id}`);
  // The via layer pins the convenio first, so both feeds change shape.
  revalidatePath("/escritos");

  const toast =
    fields.via === "judicial"
      ? "volvio_a_judicial"
      : previa === "extrajudicial"
        ? "acuerdo_guardado"
        : "paso_a_extrajudicial";
  redirect(`/ejecutados/${id}?toast=${toast}`);
}
