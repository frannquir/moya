import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database, type Json } from "@/lib/supabase/types";
import {
  getConfiguredDepartamentos,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";

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

/**
 * Los departamentos con casos activos que todavía no tienen domicilio procesal
 * cargado, de mayor a menor por cantidad de casos.
 *
 * El domicilio procesal se constituye POR departamento judicial, así que no hay
 * uno solo que sirva para todos: un departamento sin cargar hace que todo escrito
 * de esos casos imprima [DOMICILIO_PROCESAL]. Es el único faltante de config que
 * no se puede ver mirando el JSONB, porque depende de dónde tiene casos el
 * estudio.
 *
 * El recorte por estudio lo hace la RLS de `ejecutados`, igual que en
 * contarCasosPorEmpresa. Se llama solo para el head, así que ve los casos de
 * todo el estudio y no solo los suyos. Ojo al leer esto desde un script con la
 * service role: ahí no hay RLS y los números salen de todos los estudios juntos.
 */
export async function departamentosSinDomicilio(
  supabase: Client,
  config: EstudioEscritosConfig | null | undefined,
): Promise<{ departamento: string; casos: number }[]> {
  const { data, error } = await supabase
    .from("ejecutados")
    .select("departamento")
    .is("archived_at", null);
  if (error) throw error;

  const cargados = new Set(
    getConfiguredDepartamentos(config).map((d) => d.toLowerCase()),
  );
  const cuenta = new Map<string, number>();
  for (const row of data ?? []) {
    const dep = (row.departamento ?? "").trim();
    // Un caso sin departamento es un faltante del caso, no de la configuración.
    if (dep === "" || cargados.has(dep.toLowerCase())) continue;
    cuenta.set(dep, (cuenta.get(dep) ?? 0) + 1);
  }

  return [...cuenta]
    .map(([departamento, casos]) => ({ departamento, casos }))
    .sort((a, b) => b.casos - a.casos || a.departamento.localeCompare(b.departamento, "es"));
}
