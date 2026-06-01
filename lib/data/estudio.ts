import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database, type Json } from "@/lib/supabase/types";
import { type EstudioEscritosConfig } from "@/lib/domain/escritos-config";

type Client = SupabaseClient<Database>;

export async function getMembership(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("estudio_members")
    .select("role, estudio:estudios(id, nombre, escritos_config)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMembers(supabase: Client) {
  const { data, error } = await supabase.rpc("get_estudio_members");
  if (error) throw error;
  return data ?? [];
}

export async function getEscritosConfig(
  supabase: Client,
  estudioId: string,
): Promise<EstudioEscritosConfig> {
  const { data, error } = await supabase
    .from("estudios")
    .select("escritos_config")
    .eq("id", estudioId)
    .maybeSingle();
  if (error) throw error;
  return (data?.escritos_config ?? {}) as EstudioEscritosConfig;
}

export async function updateEscritosConfig(
  supabase: Client,
  estudioId: string,
  config: EstudioEscritosConfig,
): Promise<void> {
  const { error } = await supabase
    .from("estudios")
    .update({ escritos_config: config as unknown as Json })
    .eq("id", estudioId);
  if (error) throw error;
}
