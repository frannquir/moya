"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseEjecutadoFormData } from "@/lib/domain/ejecutado";
import {
  calcularLiquidacion,
  sortTasasChronological,
  type TasaRow,
} from "@/lib/domain/liquidaciones";
import { parseLocalDate, formatLocalDate } from "@/lib/domain/dates";

export async function updateEjecutado(id: string, formData: FormData) {
  const supabase = await createClient();

  const fields = parseEjecutadoFormData(formData);
  if (!fields.nombre) throw new Error("Nombre is required");

  const { error } = await supabase
    .from("ejecutados")
    .update(fields)
    .eq("id", id);

  if (error) throw error;

  await recalcLiquidacion(id);

  revalidatePath("/ejecutados");
  revalidatePath(`/ejecutados/${id}`);
  revalidatePath("/liquidaciones");
}

async function recalcLiquidacion(ejecutadoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: ej } = await supabase
    .from("ejecutados")
    .select(
      "estudio_id, nombre, numero_expediente, deuda_inicial, fecha_mora, fecha_deuda, gastos",
    )
    .eq("id", ejecutadoId)
    .single();
  if (!ej) return;

  if (!ej.fecha_mora || !(Number(ej.deuda_inicial) > 0)) return;

  const { data: tasaRows } = await supabase
    .from("bcra_tasas")
    .select("mes, anio, tna");
  const tasas = sortTasasChronological((tasaRows ?? []) as TasaRow[]);
  if (tasas.length === 0) return;

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

    await supabase.from("liquidaciones").upsert(
      {
        ejecutado_id: ejecutadoId,
        estudio_id: ej.estudio_id,
        created_by_user_id: user.id,
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
  } catch {
  }
}

export async function archiveEjecutado(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("ejecutados")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/ejecutados");
  revalidatePath("/ejecutados/archivados");
  revalidatePath("/cobros");
  revalidatePath("/liquidaciones");
  revalidatePath("/escritos");
  redirect("/ejecutados/archivados");
}

export async function unarchiveEjecutado(id: string) {
  const supabase = await createClient();

  await supabase
    .from("liquidaciones")
    .update({ archived_at: null })
    .eq("ejecutado_id", id);

  const { error } = await supabase
    .from("ejecutados")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/ejecutados");
  revalidatePath("/ejecutados/archivados");
  revalidatePath("/cobros");
  revalidatePath("/liquidaciones");
  revalidatePath("/escritos");
  revalidatePath(`/ejecutados/${id}`);
}