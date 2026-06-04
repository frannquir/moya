import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type Tables } from "@/lib/supabase/db-helpers";
import {
  HONORARIO_TIPOS,
  type HonorarioTipo,
  arsToJus,
  jusToArs,
  remainingJus,
} from "@/lib/domain/honorarios";

type Client = SupabaseClient<Database>;
export type HonorarioPago = Tables<"honorarios_pagos">;
export type HonorarioWithBalance =
  Database["public"]["Views"]["honorarios_with_balance"]["Row"];

// Current JUS value from system_config.jus_config (stored as { value: number }).
export async function getJusValue(supabase: Client): Promise<number> {
  const { data, error } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", "jus_config")
    .maybeSingle();
  if (error) throw error;
  return (data?.value as { value: number } | null)?.value ?? 0;
}

export async function getHonorarioWithBalance(
  supabase: Client,
  ejecutadoId: string,
): Promise<HonorarioWithBalance | null> {
  const { data, error } = await supabase
    .from("honorarios_with_balance")
    .select("*")
    .eq("ejecutado_id", ejecutadoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Set/replace the honorario type (3.5 or 7 JUS), one per ejecutado.
export async function setHonorarioTipo(
  supabase: Client,
  input: { ejecutadoId: string; userId: string; estudioId: string; tipoJus: number },
): Promise<void> {
  if (!HONORARIO_TIPOS.includes(input.tipoJus as HonorarioTipo)) {
    throw new Error(`Tipo de honorario inválido: ${input.tipoJus} (debe ser 3.5 o 7 JUS).`);
  }

  // Lowering the type below what's already been paid would strand the balance. The DB
  // only caps pagos, not the total, so fence it here with a clean message.
  const existing = await getHonorarioWithBalance(supabase, input.ejecutadoId);
  if (existing && (existing.pagado_jus ?? 0) > input.tipoJus) {
    throw new Error(
      `No se puede fijar el honorario en ${input.tipoJus} JUS: ya se pagaron ${existing.pagado_jus} JUS.`,
    );
  }

  const { error } = await supabase.from("honorarios").upsert(
    {
      ejecutado_id: input.ejecutadoId,
      estudio_id: input.estudioId,
      created_by_user_id: input.userId,
      monto_total_jus: input.tipoJus,
    },
    { onConflict: "ejecutado_id" },
  );
  if (error) throw error;
}

export async function listHonorarioPagos(
  supabase: Client,
  honorarioId: string,
): Promise<HonorarioPago[]> {
  const { data, error } = await supabase
    .from("honorarios_pagos")
    .select("*")
    .eq("honorario_id", honorarioId)
    .is("archived_at", null)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Add a pago entered in JUS, in ARS, or via "saldar" (fill exact remaining). JUS is
// canonical (the cap is JUS); ARS converts at the current jus value. Both are stored.
export async function addHonorarioPago(
  supabase: Client,
  input: {
    honorarioId: string;
    userId: string;
    estudioId: string;
    fecha: string;
    nota: string;
    montoJus?: number;
    montoArs?: number;
    saldar?: boolean;
  },
): Promise<void> {
  const jusValue = await getJusValue(supabase);

  const { data: hon, error: honError } = await supabase
    .from("honorarios_with_balance")
    .select("monto_total_jus, pagado_jus")
    .eq("id", input.honorarioId)
    .maybeSingle();
  if (honError) throw honError;
  if (!hon) throw new Error("Honorario no encontrado.");

  const remaining = remainingJus(hon.monto_total_jus ?? 0, hon.pagado_jus ?? 0);

  // Resolve the (JUS, ARS) pair from whichever unit the caller provided.
  let montoJus: number;
  let montoArs: number;
  if (input.saldar) {
    montoJus = remaining; // exact remaining — kills ARS-conversion rounding residue
    montoArs = jusToArs(remaining, jusValue);
  } else if (input.montoJus != null) {
    montoJus = input.montoJus;
    montoArs = jusToArs(montoJus, jusValue);
  } else if (input.montoArs != null) {
    if (!(jusValue > 0)) throw new Error("No hay valor JUS configurado para convertir ARS.");
    montoArs = input.montoArs;
    montoJus = arsToJus(montoArs, jusValue);
  } else {
    throw new Error("Ingresá un monto en JUS o en ARS.");
  }

  // Friendly fence; the DB trigger is the hard one.
  if (!(montoJus > 0)) throw new Error("El monto del pago debe ser mayor a 0.");
  if (montoJus > remaining) {
    throw new Error(`El pago de ${montoJus} JUS excede lo pendiente (${remaining} JUS).`);
  }

  const { error } = await supabase.from("honorarios_pagos").insert({
    honorario_id: input.honorarioId,
    estudio_id: input.estudioId,
    created_by_user_id: input.userId,
    monto_jus: montoJus,
    monto_ars: montoArs,
    fecha: input.fecha,
    nota: input.nota,
  });
  if (error) throw error;
}

export async function archiveHonorarioPago(
  supabase: Client,
  pagoId: string,
): Promise<void> {
  const { error } = await supabase
    .from("honorarios_pagos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", pagoId);
  if (error) throw error;
}
