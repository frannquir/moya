"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, getCurrentEstudioId } from "@/lib/data/auth";
import { archive, createMany, nextOrden, update } from "@/lib/data/codemandados";
import { parsePartyFormData, validateParty } from "@/lib/domain/demanda";

// Defined here rather than re-exported from the sibling actions file: a
// "use server" module that re-exports ends up with zero exports (gotcha #26).

export async function createCodemandado(ejecutadoId: string, formData: FormData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const estudioId = await getCurrentEstudioId(supabase);

  const party = parsePartyFormData(formData);
  const error = validateParty(party, "El codemandado");
  if (error) throw new Error(error);

  await createMany(supabase, {
    estudioId,
    userId: user.id,
    ejecutadoId,
    parties: [party],
    ordenFrom: await nextOrden(supabase, ejecutadoId),
  });

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  redirect(`/ejecutados/${ejecutadoId}?toast=codemandado_agregado`);
}

export async function updateCodemandado(
  ejecutadoId: string,
  codemandadoId: string,
  formData: FormData,
) {
  const supabase = await createClient();

  const party = parsePartyFormData(formData);
  const error = validateParty(party, "El codemandado");
  if (error) throw new Error(error);

  await update(supabase, codemandadoId, party);

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  redirect(`/ejecutados/${ejecutadoId}?toast=codemandado_guardado`);
}

/** "Eliminar" in the UI: sets archived_at. There is no DELETE policy. */
export async function archiveCodemandado(ejecutadoId: string, codemandadoId: string) {
  const supabase = await createClient();
  await archive(supabase, codemandadoId);

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  redirect(`/ejecutados/${ejecutadoId}?toast=codemandado_archivado`);
}
