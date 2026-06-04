import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import {
  calcularLiquidacion,
  sortTasasChronological,
  type TasaRow,
} from "@/lib/domain/liquidaciones";
import { parseLocalDate, formatLocalDate } from "@/lib/domain/dates";

type Client = SupabaseClient<Database>;

export async function generateLiquidacion(
  supabase: Client,
  ejecutadoId: string,
): Promise<"generated" | "skipped"> {
  const { data: ej, error } = await supabase
    .from("ejecutados")
    .select(
      "id, estudio_id, created_by_user_id, numero_expediente, nombre, fecha_mora, fecha_deuda, deuda_inicial, gastos",
    )
    .eq("id", ejecutadoId)
    .maybeSingle();
  if (error) throw error;
  if (!ej) return "skipped";

  if (!ej.fecha_mora || !(Number(ej.deuda_inicial) > 0)) return "skipped";

  const { data: tasaRows, error: tasaError } = await supabase
    .from("bcra_tasas")
    .select("mes, anio, tna");
  if (tasaError) throw tasaError;
  const tasas = sortTasasChronological((tasaRows ?? []) as TasaRow[]);
  if (tasas.length === 0) return "skipped";

  const fechaDesde = parseLocalDate(ej.fecha_mora);
  const fechaHasta = ej.fecha_deuda ? parseLocalDate(ej.fecha_deuda) : new Date();

  try {
    const result = calcularLiquidacion(
      {
        cuenta: ej.numero_expediente ?? "",
        apynom: ej.nombre ?? "",
        ultVenc: fechaDesde,
        fechaHasta,
        capital: Number(ej.deuda_inicial),
        gastos: Number(ej.gastos ?? 0),
      },
      tasas,
    );

    const { error: upsertError } = await supabase.from("liquidaciones").upsert(
      {
        ejecutado_id: ej.id,
        estudio_id: ej.estudio_id,
        created_by_user_id: ej.created_by_user_id,
        cuenta: ej.numero_expediente ?? "",
        apellido_nombre: ej.nombre ?? "",
        fecha_desde: ej.fecha_mora,
        fecha_hasta: formatLocalDate(fechaHasta),
        capital: result.capital,
        total_intereses: result.totalIntereses,
        iva: result.iva,
        gastos: result.gastos,
        monto_adeudado: result.total,
      },
      { onConflict: "ejecutado_id" },
    );
    if (upsertError) throw upsertError;
    return "generated";
  } catch (err) {
    console.error(`generateLiquidacion failed for ejecutado ${ejecutadoId}:`, err);
    return "skipped";
  }
}
