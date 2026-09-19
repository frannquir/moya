"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  DEMANDA_CLAVE,
  generarDemanda,
  insertEscrito,
  renderEscritoBody,
} from "@/lib/data/escrito-render";
import { extractUnresolved } from "@/lib/domain/template-engine";
import { destinoDe, hrefDe, type TokenDestino } from "@/lib/domain/token-destino";
import { getMembership } from "@/lib/data/estudio";
import { requireUser } from "@/lib/data/auth";

export async function generarEscrito(ejecutadoId: string, formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "");
  if (!templateId) throw new Error("template_id is required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: template } = await supabase
    .from("escritos_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  if (!template) throw new Error("template not found");

  // A fragmento is a piece of another document and the demanda has its own
  // entry point; neither is generable from the library. The queries that feed
  // the UI already filter these out, so reaching here means a hand-made request.
  if (template.tipo !== "escrito") {
    throw new Error("Ese tipo de plantilla no se genera desde la biblioteca");
  }

  // The same render path "Restaurar original" uses, so an escrito restored a
  // month from now is byte-identical to one generated today from the same data.
  const { contenido, ejecutado } = await renderEscritoBody(supabase, {
    ejecutadoId,
    template,
  });

  const created = await insertEscrito(supabase, {
    estudioId: ejecutado.estudio_id,
    ejecutadoId,
    templateId: template.id,
    userId: user.id,
    titulo: template.titulo,
    contenido,
  });

  revalidatePath("/escritos");
  revalidatePath(`/ejecutados/${ejecutadoId}`);
  redirect(`/escritos/${created.id}`);
}

/**
 * "Generar de nuevo" on the Demanda card. The party list or the employment of a
 * party may have changed since the case was created, so this recomposes section
 * VII from current data. It always writes a NEW escrito row — an earlier one may
 * already have been filed and must not be overwritten.
 */
export async function regenerarDemanda(ejecutadoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const created = await generarDemanda(supabase, { ejecutadoId, userId: user.id });

  revalidatePath("/escritos");
  revalidatePath(`/ejecutados/${ejecutadoId}`);
  redirect(`/escritos/${created.id}`);
}

/** One thing the demanda would print as a [MARCADOR], and where it gets filled. */
export type FaltanteEscrito = {
  label: string;
  donde: TokenDestino["donde"];
  /** null when the reader cannot act on it — a member facing estudio config. */
  href: string | null;
};

/**
 * What the demanda would be missing, WITHOUT writing anything.
 *
 * The same render path generation uses — renderEscritoBody, cautelar fragment
 * and all — so the list cannot drift from what would actually print. The escrito
 * editor already badges unresolved tokens, but that is after the fact: by then
 * the lawyer has a document, and the cheapest moment to say "this will print
 * [FOJAS_RESUMENES]" is before they copy it into MEV.
 *
 * Called on click, never on page load: /ejecutados/[id] is the heaviest page in
 * the app and this is a full render plus its queries.
 */
export async function revisarDemanda(ejecutadoId: string): Promise<FaltanteEscrito[]> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: template } = await supabase
    .from("escritos_templates")
    .select("clave, contenido")
    .eq("clave", DEMANDA_CLAVE)
    .maybeSingle();
  if (!template) return [];

  const { contenido } = await renderEscritoBody(supabase, { ejecutadoId, template });

  const membership = await getMembership(supabase, user.id);
  const isHead = membership?.role === "head";

  // Several tokens share a label on purpose — ABOGADO_CUIT and ABOGADO_DNI are
  // the same missing field seen twice, and MONTO / MONTO_LETRAS are one figure.
  // The lawyer is being told what to go and fill in, so the list is of things,
  // not of tokens.
  const porLabel = new Map<string, FaltanteEscrito>();
  for (const token of extractUnresolved(contenido)) {
    const destino = destinoDe(token);
    if (!destino) {
      // A token nothing knows about still has to be visible: an unlisted
      // [MARCADOR] in a filing is the one outcome worth interrupting for.
      porLabel.set(token, { label: token, donde: "caso", href: null });
      continue;
    }
    if (porLabel.has(destino.label)) continue;
    porLabel.set(destino.label, {
      label: destino.label,
      donde: destino.donde,
      href: hrefDe(destino, { ejecutadoId, isHead }),
    });
  }

  // Per-case gaps first: they are the ones the reader can fix without leaving
  // the page they are on.
  return [...porLabel.values()].sort((a, b) =>
    a.donde === b.donde ? a.label.localeCompare(b.label, "es") : a.donde === "caso" ? -1 : 1,
  );
}
