"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data/auth";
import {
  setHonorarioMonto,
  addHonorarioPago,
  archiveHonorarioPago,
  getJusValue,
} from "@/lib/data/honorarios";
import { jusToArs } from "@/lib/domain/honorarios";

export async function setMonto(ejecutadoId: string, formData: FormData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: ej } = await supabase
    .from("ejecutados")
    .select("estudio_id")
    .eq("id", ejecutadoId)
    .single();
  if (!ej) throw new Error("ejecutado not found");

  // The negotiated ceiling is a peso figure — it is what was agreed with the
  // debtor — so pesos are stored as typed. A JUS entry converts here rather than
  // trusting the client's arithmetic.
  const maxOn = String(formData.get("max_on") ?? "") === "1";
  let maxAcordadoArs: number | null = null;
  if (maxOn) {
    const raw = Number(formData.get("max_acordado") ?? 0);
    if (String(formData.get("max_unidad") ?? "ars") === "jus") {
      const jusValue = await getJusValue(supabase);
      if (!(jusValue > 0)) {
        throw new Error("No hay valor JUS configurado para convertir JUS a pesos.");
      }
      maxAcordadoArs = jusToArs(raw, jusValue);
    } else {
      maxAcordadoArs = raw;
    }
  }

  await setHonorarioMonto(supabase, {
    ejecutadoId,
    userId: user.id,
    estudioId: ej.estudio_id,
    montoJus: Number(formData.get("monto_jus") ?? 0),
    maxAcordadoArs,
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
