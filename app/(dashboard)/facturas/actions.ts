"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type TipoFactura } from "@/lib/domain/facturas";

/** Which column of facturas a payment of this kind hangs off. */
const columnaDe = (tipo: TipoFactura) =>
  tipo === "factura-b" ? "honorario_pago_id" : "pago_id";

/**
 * Resolve the estudio from the payment itself rather than trusting the caller:
 * facturas.estudio_id gates RLS, so it has to come from a row the reader was
 * already allowed to see.
 */
async function estudioDelPago(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tipo: TipoFactura,
  pagoId: string,
): Promise<string> {
  const tabla = tipo === "factura-b" ? "honorarios_pagos" : "cobros_pagos";
  const { data } = await supabase
    .from(tabla)
    .select("estudio_id")
    .eq("id", pagoId)
    .maybeSingle();
  if (!data) throw new Error("pago not found");
  return data.estudio_id;
}

export async function saveFactura(
  tipo: TipoFactura,
  pagoId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const estudioId = await estudioDelPago(supabase, tipo, pagoId);
  const mensaje = String(formData.get("mensaje") ?? "");
  const columna = columnaDe(tipo);

  // Select-then-write rather than upsert: uniqueness is now enforced by two
  // PARTIAL indexes (one per source), and PostgREST's on_conflict cannot state
  // an index predicate, so Postgres would not infer either of them.
  const { data: existing, error: readError } = await supabase
    .from("facturas")
    .select("id")
    .eq(columna, pagoId)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const { error } = await supabase
      .from("facturas")
      .update({
        mensaje_generado: mensaje,
        fecha_generada: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    // The two ids are spelled out rather than written as a computed key: a
    // computed key widens the object to a string index signature, which the
    // generated Insert type rejects outright — and losing that check on the one
    // statement that decides which kind of factura this is would be a poor trade.
    const { error } = await supabase.from("facturas").insert({
      pago_id: tipo === "factura-b" ? null : pagoId,
      honorario_pago_id: tipo === "factura-b" ? pagoId : null,
      estudio_id: estudioId,
      created_by_user_id: user.id,
      mensaje_generado: mensaje,
      fecha_generada: new Date().toISOString(),
    });
    if (error) throw error;
  }

  revalidatePath("/facturas");
}

export async function setFacturaConfirmada(
  tipo: TipoFactura,
  pagoId: string,
  confirmada: boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("facturas")
    .update({ confirmada })
    .eq(columnaDe(tipo), pagoId);
  if (error) throw error;

  revalidatePath("/facturas");
}
