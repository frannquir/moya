"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MOVIMIENTO_OPTIONS, type Movimiento } from "@/lib/domain/ejecutado";
import {
  calcularLiquidacion,
  sortTasasChronological,
  type TasaRow,
} from "@/lib/domain/liquidaciones";
import { parseLocalDate, formatLocalDate } from "@/lib/domain/dates";

export async function updateEjecutado(id: string, formData: FormData) {
  const supabase = await createClient();

  const movRaw = String(formData.get("movimiento") ?? "");
  const movimiento =
    movRaw === "" || movRaw === "__none__"
      ? null
      : (MOVIMIENTO_OPTIONS as readonly string[]).includes(movRaw)
        ? (movRaw as Movimiento)
        : null;

  const fechaDesdeRaw = String(formData.get("fecha_desde") ?? "").trim();
  const fechaHastaRaw = String(formData.get("fecha_hasta") ?? "").trim();

  const medidaRaw = String(formData.get("medida_cautelar") ?? "");
  const medida_cautelar =
    medidaRaw === "embargo" || medidaRaw === "igb" ? medidaRaw : null;

  const diligRaw = String(formData.get("diligenciada") ?? "");
  const diligenciada = diligRaw === "si" ? true : diligRaw === "no" ? false : null;

  const empresaRaw = String(formData.get("empresa") ?? "").trim();
  const empresa = empresaRaw && empresaRaw !== "__none__" ? empresaRaw : null;

  const deptoRaw = String(formData.get("departamento") ?? "").trim();
  const departamento = deptoRaw === "__none__" ? "" : deptoRaw;

  const { error } = await supabase
    .from("ejecutados")
    .update({
      nombre: String(formData.get("nombre") ?? "").trim(),
      juzgado: String(formData.get("juzgado") ?? ""),
      departamento,
      numero_expediente: String(formData.get("numero_expediente") ?? ""),
      deuda_inicial: Number(formData.get("deuda_inicial") ?? 0) || 0,
      fecha_desde: fechaDesdeRaw || null,
      fecha_hasta: fechaHastaRaw || null,
      gastos: Number(formData.get("gastos") ?? 0) || 0,
      movimiento,
      medida_cautelar,
      diligenciada,
      empresa,
      observaciones: String(formData.get("observaciones") ?? ""),
    })
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
      "estudio_id, nombre, numero_expediente, deuda_inicial, fecha_desde, fecha_hasta, gastos",
    )
    .eq("id", ejecutadoId)
    .single();
  if (!ej) return;

  if (!ej.fecha_desde || !(Number(ej.deuda_inicial) > 0)) return;

  const { data: tasaRows } = await supabase
    .from("bcra_tasas")
    .select("mes, anio, tna");
  const tasas = sortTasasChronological((tasaRows ?? []) as TasaRow[]);
  if (tasas.length === 0) return;

  const fechaDesde = parseLocalDate(ej.fecha_desde);
  const fechaHasta = ej.fecha_hasta ? parseLocalDate(ej.fecha_hasta) : new Date();

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
        fecha_desde: ej.fecha_desde,
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