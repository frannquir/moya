"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getCurrentEstudioId } from "@/lib/data/auth";
import { create } from "@/lib/data/ejecutados";
import { createMany } from "@/lib/data/codemandados";
import { generateLiquidacion } from "@/lib/data/liquidaciones";
import { parseEjecutadoFormData, validateEjecutadoFields } from "@/lib/domain/ejecutado";
import {
  labelForCodemandado,
  parseDemandadoExtraFormData,
  parsePartiesJson,
  parsePartyFormData,
  validateParty,
} from "@/lib/domain/demanda";

export type DemandaState = { error: string } | null;

/**
 * "Iniciar demanda": creates the ejecutado and its codemandados in one pass.
 *
 * Returns an error instead of throwing so the client keeps the form it just
 * filled in (and can restore its autosaved draft); the client runs the same pure
 * validators first, so a rejection here means something got past the UI.
 */
export async function createDemanda(
  _prev: DemandaState,
  formData: FormData,
): Promise<DemandaState> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const estudioId = await getCurrentEstudioId(supabase);

  // The demandado block posts unprefixed, so both parsers read the same inputs:
  // parseEjecutadoFormData for the shared columns, parsePartyFormData for the
  // employment block the party validator needs.
  const fields = parseEjecutadoFormData(formData);
  const demandado = parsePartyFormData(formData);
  const extra = parseDemandadoExtraFormData(formData);
  const codemandados = parsePartiesJson(String(formData.get("codemandados_json") ?? ""));

  const fieldsError = validateEjecutadoFields(fields);
  if (fieldsError) return { error: fieldsError };

  const demandadoError = validateParty(demandado, "El demandado");
  if (demandadoError) return { error: demandadoError };

  for (let i = 0; i < codemandados.length; i++) {
    const error = validateParty(codemandados[i], labelForCodemandado(i));
    if (error) return { error };
  }

  const created = await create(supabase, {
    estudioId,
    userId: user.id,
    isDraft: false,
    // New cases are delegated to their creator, which is also what the INSERT
    // RLS check requires of a non-head member.
    assignedToUserId: user.id,
    fields,
    origen: "demanda",
    demandado: extra,
  });

  await createMany(supabase, {
    estudioId,
    userId: user.id,
    ejecutadoId: created.id,
    parties: codemandados,
  });

  // Same generator the create/update actions and the migration use.
  await generateLiquidacion(supabase, created.id);

  revalidatePath("/ejecutados");
  revalidatePath("/liquidaciones");

  // HANDOFF 2B: session 2B generates the demanda escrito here and redirects to
  // it instead of to the detail page. Everything above (ejecutado + codemandados
  // + liquidación) is the input that generation needs; nothing else changes.
  redirect(`/ejecutados/${created.id}?toast=demanda_creada`);
}
