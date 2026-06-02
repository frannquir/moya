import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type Tables } from "@/lib/supabase/db-helpers";

type Client = SupabaseClient<Database>;
export type Cobro = Tables<"cobros_pagos">;

type CobrosTotals = {
  total_solicitado: number | null;
  total_proveido: number | null;
  pagos_count: number | null;
};

// Pagos for a single ejecutado, newest first. archived_at filter is baked in.
export async function listCobros(
  supabase: Client,
  ejecutadoId: string,
): Promise<Cobro[]> {
  const { data, error } = await supabase
    .from("cobros_pagos")
    .select("*")
    .eq("ejecutado_id", ejecutadoId)
    .is("archived_at", null)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// cobros_totals view row for a single ejecutado (null when no pagos yet).
export async function getCobrosTotals(
  supabase: Client,
  ejecutadoId: string,
): Promise<CobrosTotals | null> {
  const { data, error } = await supabase
    .from("cobros_totals")
    .select("total_solicitado, total_proveido, pagos_count")
    .eq("ejecutado_id", ejecutadoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// All non-archived pagos across the estudio, with their ejecutado embedded
// (so callers can hide pagos whose ejecutado is archived).
export async function listAllCobrosWithEjecutado(supabase: Client) {
  const { data, error } = await supabase
    .from("cobros_pagos")
    .select("*, ejecutado:ejecutados(id, nombre, archived_at)")
    .is("archived_at", null)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Every cobros_totals view row (one per ejecutado) for the across-estudio sum.
export async function listAllCobrosTotals(
  supabase: Client,
): Promise<CobrosTotals[]> {
  const { data, error } = await supabase
    .from("cobros_totals")
    .select("total_solicitado, total_proveido, pagos_count");
  if (error) throw error;
  return data ?? [];
}

export async function addCobro(
  supabase: Client,
  input: {
    ejecutadoId: string;
    userId: string;
    estudioId: string;
    monto: number;
    fecha: string;
    nota: string;
  },
): Promise<void> {
  const { error } = await supabase.from("cobros_pagos").insert({
    ejecutado_id: input.ejecutadoId,
    created_by_user_id: input.userId,
    estudio_id: input.estudioId,
    monto: input.monto,
    fecha: input.fecha,
    nota: input.nota,
    estado: "Solicitado",
  });
  if (error) throw error;
}

export async function confirmCobro(
  supabase: Client,
  cobroId: string,
): Promise<void> {
  const { error } = await supabase
    .from("cobros_pagos")
    .update({ estado: "Proveído" })
    .eq("id", cobroId);
  if (error) throw error;
}

export async function archiveCobro(
  supabase: Client,
  cobroId: string,
): Promise<void> {
  const { error } = await supabase
    .from("cobros_pagos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", cobroId);
  if (error) throw error;
}
