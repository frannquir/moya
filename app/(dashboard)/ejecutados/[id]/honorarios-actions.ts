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
import { baseJusToArs } from "@/lib/domain/honorarios";

export type MontoState = { ok: string | null; error: string | null };

export async function setMonto(
  ejecutadoId: string,
  _prev: MontoState,
  formData: FormData,
): Promise<MontoState> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: ej } = await supabase
    .from("ejecutados")
    .select("estudio_id")
    .eq("id", ejecutadoId)
    .single();
  if (!ej) return { ok: null, error: "No se encontró el ejecutado." };

  // The negotiated ceiling is a peso figure — it is what was agreed with the
  // debtor — so pesos are stored as typed. A JUS entry names the fee, tax
  // excluded, and converts here rather than trusting the client's arithmetic.
  const maxOn = String(formData.get("max_on") ?? "") === "1";
  let maxAcordadoArs: number | null = null;
  if (maxOn) {
    const raw = Number(formData.get("max_acordado") ?? 0);
    if (String(formData.get("max_unidad") ?? "ars") === "jus") {
      const jusValue = await getJusValue(supabase);
      if (!(jusValue > 0)) {
        return {
          ok: null,
          error: "No hay valor JUS configurado para convertir JUS a pesos.",
        };
      }
      maxAcordadoArs = baseJusToArs(raw, jusValue);
    } else {
      maxAcordadoArs = raw;
    }
  }

  // Returned, not thrown: this action backs a dialog whose fields the lawyer
  // just typed, and a thrown error unmounts the form along with them.
  try {
    await setHonorarioMonto(supabase, {
      ejecutadoId,
      userId: user.id,
      estudioId: ej.estudio_id,
      montoJus: Number(formData.get("monto_jus") ?? 0),
      maxAcordadoArs,
    });
  } catch (e) {
    return { ok: null, error: e instanceof Error ? e.message : "No se pudo guardar." };
  }

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/honorarios");
  return { ok: "Honorario actualizado.", error: null };
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

  const saldar = String(formData.get("intent") ?? "") === "saldar";
  // Always the gross pesos. The form's JUS field holds the fee the lawyer
  // perceives and the client converts it before posting, so a pago crosses
  // units once, here, and no round trip can lose the centavo the trigger would
  // then reject.
  const montoArs = Number(formData.get("monto_ars") ?? 0);

  await addHonorarioPago(supabase, {
    honorarioId,
    userId: user.id,
    estudioId: hon.estudio_id,
    fecha: String(formData.get("fecha") || new Date().toISOString().slice(0, 10)),
    nota: String(formData.get("nota") ?? ""),
    saldar,
    montoArs: saldar ? undefined : montoArs,
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
