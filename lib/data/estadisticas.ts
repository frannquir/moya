import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type Via } from "@/lib/domain/ejecutado";
import { arsToBaseJus, roundCentavos, saldoHonorario } from "@/lib/domain/honorarios";
import { DIAS_PARA_RECLAMAR, diasDesde } from "@/lib/domain/estadisticas";
import { getJusValue } from "@/lib/data/honorarios";
import { DEMANDA_CLAVE } from "@/lib/data/escrito-render";

type Client = SupabaseClient<Database>;

// Queries behind the home page (ex /estadisticas). Estudio-scoped by RLS. Joins run in TS: the
// estudio is a few hundred rows and there is no aggregate RPC.

export type ParaReclamar = {
  ejecutadoId: string;
  nombre: string;
  /**
   * What is still collectable, in pesos. Deliberately not JUS: the outstanding
   * balance is fee + IVA + aportes, and the JUS denominates the fee alone — a
   * gross figure divided by the JUS value names nothing the firm perceives.
   */
  pendienteArs: number;
  ultimoPago: string | null;
  diasDesdeUltimoPago: number | null;
};

/**
 * Honorarios still owing whose last payment is older than DIAS_PARA_RECLAMAR,
 * never-paid first. Keyed on honorarios pagos, not cobros: those are separate
 * ledgers.
 */
export async function listParaReclamar(
  supabase: Client,
  { limit = 25 }: { limit?: number } = {},
): Promise<ParaReclamar[]> {
  const [{ data: honorarios, error }, jusValue] = await Promise.all([
    supabase
      .from("honorarios_with_balance")
      .select("id, ejecutado_id, monto_total_jus, max_acordado_ars, pagado_jus, pagado_ars")
      .is("archived_at", null),
    getJusValue(supabase),
  ]);
  if (error) throw error;

  // Resolved through saldoHonorario(), never from the view's pendiente_cobrable_ars:
  // that column mixes a ceiling converted at today's JUS with pesos received at
  // the JUS of their own dates, so a settled honorario can read as still owing.
  const owing = (honorarios ?? [])
    .map((h) => ({ ...h, pendienteArs: saldoHonorario(h, jusValue).pendienteArs }))
    .filter((h) => h.pendienteArs > 0);
  if (owing.length === 0) return [];

  const ids = owing.map((h) => h.id!).filter(Boolean);
  const ejIds = owing.map((h) => h.ejecutado_id!).filter(Boolean);

  const [{ data: pagos }, { data: ejecutados }] = await Promise.all([
    supabase
      .from("honorarios_pagos")
      .select("honorario_id, fecha")
      .in("honorario_id", ids)
      .is("archived_at", null),
    supabase
      .from("ejecutados")
      .select("id, nombre")
      .in("id", ejIds)
      .is("archived_at", null),
  ]);

  // Latest pago per honorario. DATE columns, so string compare is chronological.
  const ultimo = new Map<string, string>();
  for (const p of pagos ?? []) {
    if (!p.honorario_id || !p.fecha) continue;
    const cur = ultimo.get(p.honorario_id);
    if (!cur || p.fecha > cur) ultimo.set(p.honorario_id, p.fecha);
  }
  const nombres = new Map((ejecutados ?? []).map((e) => [e.id, e.nombre ?? ""]));

  return owing
    .filter((h) => nombres.has(h.ejecutado_id!)) // drop archived ejecutados
    .map((h) => {
      const fecha = ultimo.get(h.id!) ?? null;
      return {
        ejecutadoId: h.ejecutado_id!,
        nombre: nombres.get(h.ejecutado_id!) ?? "",
        pendienteArs: h.pendienteArs,
        ultimoPago: fecha,
        diasDesdeUltimoPago: fecha ? diasDesde(fecha) : null,
      };
    })
    .filter((r) => r.diasDesdeUltimoPago === null || r.diasDesdeUltimoPago >= DIAS_PARA_RECLAMAR)
    // Never-paid first, then most overdue.
    .sort((a, b) => {
      if (a.diasDesdeUltimoPago === null && b.diasDesdeUltimoPago === null) return 0;
      if (a.diasDesdeUltimoPago === null) return -1;
      if (b.diasDesdeUltimoPago === null) return 1;
      return b.diasDesdeUltimoPago - a.diasDesdeUltimoPago;
    })
    .slice(0, limit);
}

export type EjecutadoReciente = {
  id: string;
  nombre: string;
  movimiento: string | null;
  diligenciada: boolean | null;
  via: Via;
  deudaInicial: number;
  createdAt: string;
  /** Most recent generated demanda. */
  ultimaDemanda: string | null;
  /** Outstanding fee in pesos, tax included; null when the case has no honorario. */
  honorarioPendienteArs: number | null;
  ultimoPagoHonorario: string | null;
};

export async function listEjecutadosRecientes(
  supabase: Client,
  { limit = 6 }: { limit?: number } = {},
): Promise<EjecutadoReciente[]> {
  const { data, error } = await supabase
    .from("ejecutados")
    .select("id, nombre, movimiento, movimiento_diligenciada, via, deuda_inicial, created_at")
    .is("archived_at", null)
    .eq("is_draft", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  // Matched by template clave, never by título (gotcha #31).
  const { data: tpl } = await supabase
    .from("escritos_templates")
    .select("id")
    .eq("clave", DEMANDA_CLAVE)
    .maybeSingle();

  const [{ data: demandas }, { data: honorarios }, jusValue] = await Promise.all([
    tpl
      ? supabase
          .from("escritos")
          .select("ejecutado_id, created_at")
          .eq("template_id", tpl.id)
          .in("ejecutado_id", ids)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { ejecutado_id: string; created_at: string }[] }),
    supabase
      .from("honorarios_with_balance")
      .select("id, ejecutado_id, monto_total_jus, max_acordado_ars, pagado_jus, pagado_ars")
      .in("ejecutado_id", ids)
      .is("archived_at", null),
    getJusValue(supabase),
  ]);

  // Ordered desc, so the first hit per ejecutado is the latest.
  const ultimaDemanda = new Map<string, string>();
  for (const d of demandas ?? []) {
    if (!ultimaDemanda.has(d.ejecutado_id)) ultimaDemanda.set(d.ejecutado_id, d.created_at);
  }

  const honorarioPorEjecutado = new Map(
    (honorarios ?? []).map((h) => [h.ejecutado_id!, h]),
  );
  const { data: pagos } = await supabase
    .from("honorarios_pagos")
    .select("honorario_id, fecha")
    .in("honorario_id", (honorarios ?? []).map((h) => h.id!).filter(Boolean))
    .is("archived_at", null);

  const ultimoPago = new Map<string, string>();
  for (const p of pagos ?? []) {
    if (!p.honorario_id || !p.fecha) continue;
    const cur = ultimoPago.get(p.honorario_id);
    if (!cur || p.fecha > cur) ultimoPago.set(p.honorario_id, p.fecha);
  }

  return rows.map((e) => {
    const h = honorarioPorEjecutado.get(e.id);
    return {
      id: e.id,
      nombre: e.nombre ?? "",
      movimiento: e.movimiento,
      diligenciada: e.movimiento_diligenciada,
      via: e.via === "extrajudicial" ? "extrajudicial" : "judicial",
      deudaInicial: Number(e.deuda_inicial ?? 0),
      createdAt: e.created_at,
      ultimaDemanda: ultimaDemanda.get(e.id) ?? null,
      honorarioPendienteArs: h ? saldoHonorario(h, jusValue).pendienteArs : null,
      ultimoPagoHonorario: h ? (ultimoPago.get(h.id!) ?? null) : null,
    };
  });
}

export type MovimientoReciente = {
  id: string;
  ejecutadoId: string;
  nombre: string;
  de: string | null;
  a: string | null;
  createdAt: string;
};

/**
 * Transitions from movimiento_historial. Nothing exists for cases that have not
 * moved since the table shipped, so an empty result is normal.
 */
export async function listMovimientosRecientes(
  supabase: Client,
  { limit = 8 }: { limit?: number } = {},
): Promise<MovimientoReciente[]> {
  const { data, error } = await supabase
    .from("movimiento_historial")
    .select("id, ejecutado_id, de, a, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: ejecutados } = await supabase
    .from("ejecutados")
    .select("id, nombre")
    .in("id", rows.map((r) => r.ejecutado_id));
  const nombres = new Map((ejecutados ?? []).map((e) => [e.id, e.nombre ?? ""]));

  return rows.map((r) => ({
    id: r.id,
    ejecutadoId: r.ejecutado_id,
    nombre: nombres.get(r.ejecutado_id) ?? "",
    de: r.de,
    a: r.a,
    createdAt: r.created_at,
  }));
}

export type CobroReciente = {
  id: string;
  ejecutadoId: string;
  nombre: string;
  monto: number;
  fecha: string | null;
  estado: string | null;
};

export async function listCobrosRecientes(
  supabase: Client,
  { limit = 8 }: { limit?: number } = {},
): Promise<CobroReciente[]> {
  const { data, error } = await supabase
    .from("cobros_pagos")
    .select("id, ejecutado_id, monto, fecha, estado")
    .is("archived_at", null)
    .order("fecha", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: ejecutados } = await supabase
    .from("ejecutados")
    .select("id, nombre")
    .in("id", rows.map((r) => r.ejecutado_id));
  const nombres = new Map((ejecutados ?? []).map((e) => [e.id, e.nombre ?? ""]));

  return rows.map((r) => ({
    id: r.id,
    ejecutadoId: r.ejecutado_id,
    nombre: nombres.get(r.ejecutado_id) ?? "",
    monto: Number(r.monto ?? 0),
    fecha: r.fecha,
    estado: r.estado,
  }));
}

export type ResumenEstudio = {
  ejecutados: number;
  extrajudiciales: number;
  deudaTotal: number;
  cobrado: number;
  aCobrar: number;
  /** Still collectable across the estudio, in pesos: fee + IVA + aportes. */
  honorariosPendientesArs: number;
  /** The fee inside that, in JUS — the arancel's own unit, tax excluded. */
  honorariosPendientesBaseJus: number;
};

export async function getResumenEstudio(supabase: Client): Promise<ResumenEstudio> {
  const [ejRes, cobrosRes, honRes, jusValue] = await Promise.all([
    supabase
      .from("ejecutados")
      .select("deuda_inicial, via")
      .is("archived_at", null)
      .eq("is_draft", false),
    supabase.from("cobros_pagos").select("monto, estado").is("archived_at", null),
    supabase
      .from("honorarios_with_balance")
      .select("monto_total_jus, max_acordado_ars, pagado_jus, pagado_ars")
      .is("archived_at", null),
    getJusValue(supabase),
  ]);

  // A failed query would otherwise read as an estudio with no cases.
  if (ejRes.error) throw ejRes.error;
  if (cobrosRes.error) throw cobrosRes.error;
  if (honRes.error) throw honRes.error;

  const rows = ejRes.data ?? [];
  const pagos = cobrosRes.data ?? [];
  // Per honorario through saldoHonorario(), then summed — the same figure the
  // ejecutado card shows, so the two screens cannot disagree about whether a
  // case still owes anything.
  const pendienteArs = roundCentavos(
    (honRes.data ?? []).reduce((s, h) => s + saldoHonorario(h, jusValue).pendienteArs, 0),
  );
  return {
    ejecutados: rows.length,
    extrajudiciales: rows.filter((r) => r.via === "extrajudicial").length,
    deudaTotal: rows.reduce((s, r) => s + Number(r.deuda_inicial ?? 0), 0),
    // Proveído is received; Solicitado is only asked for.
    cobrado: pagos
      .filter((p) => p.estado === "Proveído")
      .reduce((s, p) => s + Number(p.monto ?? 0), 0),
    aCobrar: pagos
      .filter((p) => p.estado === "Solicitado")
      .reduce((s, p) => s + Number(p.monto ?? 0), 0),
    honorariosPendientesArs: pendienteArs,
    // Truncated like every JUS figure on screen, and through the one converter.
    honorariosPendientesBaseJus: arsToBaseJus(pendienteArs, jusValue),
  };
}
