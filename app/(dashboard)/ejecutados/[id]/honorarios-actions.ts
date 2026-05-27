"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function upsertHonorario(ejecutadoId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: ej } = await supabase
    .from("ejecutados")
    .select("estudio_id")
    .eq("id", ejecutadoId)
    .single();
  if (!ej) throw new Error("ejecutado not found");

  const { error } = await supabase
    .from("honorarios")
    .upsert(
      {
        ejecutado_id: ejecutadoId,
        estudio_id: ej.estudio_id,
        created_by_user_id: user.id,
        monto_total_jus: Number(formData.get("monto_total_jus") ?? 0),
        observaciones: String(formData.get("observaciones") ?? ""),
      },
      { onConflict: "ejecutado_id" },
    );
  if (error) throw error;

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/honorarios");
}

export async function addHonorarioPago(honorarioId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: hon } = await supabase
    .from("honorarios")
    .select("estudio_id, ejecutado_id")
    .eq("id", honorarioId)
    .single();
  if (!hon) throw new Error("honorario not found");

  const { data: jusRow } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", "jus_config")
    .single();
  const jusValue = (jusRow?.value as { value: number })?.value ?? 0;

  const monto_jus = Number(formData.get("monto_jus") ?? 0);
  const monto_ars = Math.round(monto_jus * jusValue);

  const { error } = await supabase.from("honorarios_pagos").insert({
    honorario_id: honorarioId,
    estudio_id: hon.estudio_id,
    created_by_user_id: user.id,
    monto_jus,
    monto_ars,
    fecha: String(formData.get("fecha") ?? new Date().toISOString().slice(0, 10)),
    nota: String(formData.get("nota") ?? ""),
  });
  if (error) throw error;

  revalidatePath(`/ejecutados/${hon.ejecutado_id}`);
  revalidatePath("/honorarios");
}

export async function archiveHonorarioPago(pagoId: string, ejecutadoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("honorarios_pagos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", pagoId);
  if (error) throw error;

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/honorarios");
}