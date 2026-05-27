"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveFactura(pagoId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: pago } = await supabase
    .from("cobros_pagos")
    .select("estudio_id")
    .eq("id", pagoId)
    .single();
  if (!pago) throw new Error("pago not found");

  const mensaje = String(formData.get("mensaje") ?? "");

  const { error } = await supabase.from("facturas").upsert(
    {
      pago_id: pagoId,
      estudio_id: pago.estudio_id,
      created_by_user_id: user.id,
      mensaje_generado: mensaje,
      fecha_generada: new Date().toISOString(),
    },
    { onConflict: "pago_id" },
  );
  if (error) throw error;

  revalidatePath("/facturas");
}

export async function setFacturaConfirmada(
  pagoId: string,
  confirmada: boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("facturas")
    .update({ confirmada })
    .eq("pago_id", pagoId);
  if (error) throw error;

  revalidatePath("/facturas");
}