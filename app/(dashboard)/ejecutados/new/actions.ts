"use server";

import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseEjecutadoFormData, validateEjecutadoFields } from "@/lib/domain/ejecutado";
import { requireUser, getCurrentEstudioId } from "@/lib/data/auth";
import { create } from "@/lib/data/ejecutados";
import { generateLiquidacion } from "@/lib/data/liquidaciones";
import { listUnassignedEmails } from "@/lib/data/mail";
import { headerOfMail, mailMatchesCluster } from "@/lib/domain/mail-cluster";

export async function createEjecutado(formData: FormData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const estudioId = await getCurrentEstudioId(supabase);

  const fields = parseEjecutadoFormData(formData);
  const validationError = validateEjecutadoFields(fields);
  if (validationError) throw new Error(validationError);

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

  // When this ejecutado was created from an unassigned mail cluster (/mail/sin-asignar),
  // attach that cluster's mail now. We recompute the cluster from the (causa, localidad)
  // passthroughs instead of trusting an email-id list from the URL, which also catches
  // mail that arrived after the page was rendered.
  const clusterCausa = String(formData.get("cluster_causa") ?? "").trim();
  if (clusterCausa) {
    const clusterLocalidad =
      String(formData.get("cluster_localidad") ?? "").trim() || null;
    await attachClusterMail(supabase, estudioId, created.id, clusterCausa, clusterLocalidad);
    revalidatePath("/mail");
  }

  revalidatePath("/ejecutados");
  revalidatePath("/borradores");
  revalidatePath("/liquidaciones");
  redirect(`/ejecutados/${created.id}?toast=ejecutado_creado`);
}

// Pin every unassigned mail of the (causa, localidad) cluster to the new ejecutado:
// manual match so the next sync/re-match never overrides it.
async function attachClusterMail(
  supabase: SupabaseClient<Database>,
  estudioId: string,
  ejecutadoId: string,
  causa: string,
  localidad: string | null,
) {
  const emails = await listUnassignedEmails(supabase, estudioId);
  const ids = emails
    .filter((mail) => mailMatchesCluster(headerOfMail(mail), causa, localidad))
    .map((mail) => mail.id);
  if (ids.length === 0) return;

  const { error } = await supabase
    .from("emails")
    .update({
      ejecutado_id: ejecutadoId,
      candidate_ejecutado_id: null,
      match_manual: true,
    })
    .in("id", ids);
  if (error) throw error;
}
