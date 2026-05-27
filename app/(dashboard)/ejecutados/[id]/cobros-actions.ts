"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addCobro(ejecutadoId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: ej } = await supabase
    .from("ejecutados")
    .select("estudio_id")
    .eq("id", ejecutadoId)
    .single();
  if (!ej) throw new Error("ejecutado not found");

  const { error } = await supabase.from("cobros_pagos").insert({
    estudio_id: ej.estudio_id,
    ejecutado_id: ejecutadoId,
    created_by_user_id: user.id,
    monto: Number(formData.get("monto") ?? 0),
    estado: "Solicitado",
    nota: String(formData.get("nota") ?? ""),
    fecha: String(
      formData.get("fecha") ?? new Date().toISOString().slice(0, 10),
    ),
  });
  if (error) throw error;

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/cobros");
}

export async function confirmCobro(cobroId: string, ejecutadoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cobros_pagos")
    .update({ estado: "Proveído" })
    .eq("id", cobroId);
  if (error) throw error;

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/cobros");
}

export async function archiveCobro(cobroId: string, ejecutadoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cobros_pagos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", cobroId);
  if (error) throw error;

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/cobros");
}