"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data/auth";
import {
  setHonorarioTipo,
  addHonorarioPago,
  archiveHonorarioPago,
} from "@/lib/data/honorarios";

export async function setTipo(ejecutadoId: string, formData: FormData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: ej } = await supabase
    .from("ejecutados")
    .select("estudio_id")
    .eq("id", ejecutadoId)
    .single();
  if (!ej) throw new Error("ejecutado not found");

  await setHonorarioTipo(supabase, {
    ejecutadoId,
    userId: user.id,
    estudioId: ej.estudio_id,
    tipoJus: Number(formData.get("tipo_jus") ?? 0),
  });

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/honorarios");
}

export async function addPago(honorarioId: string, formData: FormData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: hon } = await supabase
    .from("honorarios")
    .select("estudio_id, ejecutado_id")
    .eq("id", honorarioId)
    .single();
  if (!hon) throw new Error("honorario not found");

  const unidad = String(formData.get("unidad") ?? "jus");
  const saldar = String(formData.get("intent") ?? "") === "saldar";
  const monto = Number(formData.get("monto") ?? 0);

  await addHonorarioPago(supabase, {
    honorarioId,
    userId: user.id,
    estudioId: hon.estudio_id,
    fecha: String(formData.get("fecha") || new Date().toISOString().slice(0, 10)),
    nota: String(formData.get("nota") ?? ""),
    saldar,
    montoJus: !saldar && unidad === "jus" ? monto : undefined,
    montoArs: !saldar && unidad === "ars" ? monto : undefined,
  });

  revalidatePath(`/ejecutados/${hon.ejecutado_id}`);
  revalidatePath("/honorarios");
}

export async function archivePago(pagoId: string, ejecutadoId: string) {
  const supabase = await createClient();
  await archiveHonorarioPago(supabase, pagoId);

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/honorarios");
}
