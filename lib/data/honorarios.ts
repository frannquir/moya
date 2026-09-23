import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type Tables } from "@/lib/supabase/db-helpers";
import {
  arsToJus,
  jusToArsExacto,
  techoHonorario,
  formatArs,
} from "@/lib/domain/honorarios";
import {
  BORRADORES_DEFAULT,
  OR_COBRABLE,
  OR_SALDADO,
  orBusquedaEjecutado,
  type BorradoresFiltro,
  type HonorarioEstado,
} from "@/lib/domain/honorarios-lista";

type Client = SupabaseClient<Database>;
export type HonorarioPago = Tables<"honorarios_pagos">;
export type HonorarioWithBalance =
  Database["public"]["Views"]["honorarios_with_balance"]["Row"];

/** The ejecutado columns `/honorarios` needs: who it is, and how to find it. */
export type HonorarioEjecutado = {
  id: string;
  nombre: string;
  numero_expediente: string | null;
  documento: string | null;
  is_draft: boolean;
  archived_at: string | null;
};

export type HonorarioFila = HonorarioWithBalance & {
  ejecutado: HonorarioEjecutado | null;
};

const HONORARIOS_PAGE_SIZE = 25;

/**
 * The list behind `/honorarios`: one row per honorario, searchable by the
 * ejecutado behind it, filtered and paged BY THE SERVER.
 *
 * Two things here are load-bearing:
 *
 * `ejecutados!inner` is an inner join, not decoration. With a plain (left)
 * embed, PostgREST returns the parent row with `ejecutado: null` whenever the
 * embedded row is invisible — and a filter written on that embed nulls the embed
 * instead of dropping the row. That is what used to paint ~100 nameless rows
 * here. With `!inner`, a honorario whose ejecutado the caller cannot read is not
 * in the result at all, and filters on the embed (`archived_at`, `is_draft`, the
 * search) narrow the LIST, which is what they look like they do.
 *
 * The estado filter goes through OR_COBRABLE / OR_SALDADO so it compares in the
 * ceiling's own unit — see `lib/domain/honorarios-lista.ts`, where the same rule
 * is written in TypeScript for the badge and tested against `saldoHonorario()`.
 */
export async function listHonorarios(
  supabase: Client,
  {
    q = "",
    estado = "",
    borradores = BORRADORES_DEFAULT,
    page = 1,
    pageSize = HONORARIOS_PAGE_SIZE,
  }: {
    q?: string;
    estado?: "" | HonorarioEstado;
    borradores?: BorradoresFiltro;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ items: HonorarioFila[]; totalCount: number; pendientesCount: number }> {
  const term = q.trim().slice(0, 100);

  const construir = (
    columnas: string,
    head: boolean,
    filtroEstado: "" | HonorarioEstado,
  ) => {
    let query = supabase
      .from("honorarios_with_balance")
      .select(columnas, { count: "exact", head })
      // An archived case keeps its honorario row until someone archives that
      // too; either way it has no place on this screen.
      .is("ejecutado.archived_at", null);

    if (borradores === "ocultar") query = query.eq("ejecutado.is_draft", false);
    if (borradores === "solo") query = query.eq("ejecutado.is_draft", true);
    if (term) {
      query = query.or(orBusquedaEjecutado(term), { referencedTable: "ejecutado" });
    }

    // The two `or=` arguments in play never collide: this one has no referenced
    // table and the search above is scoped to `ejecutado`, so PostgREST reads
    // them as two separate conditions and ANDs them.
    if (filtroEstado === "pagado") query = query.or(OR_SALDADO);
    if (filtroEstado === "pendiente") query = query.or(OR_COBRABLE).gt("pendiente_jus", 0);
    if (filtroEstado === "cubierto") query = query.or(OR_COBRABLE).lte("pendiente_jus", 0);

    return query;
  };

  const from = (Math.max(1, page) - 1) * pageSize;

  const [listado, pendientes] = await Promise.all([
    construir(
      "*, ejecutado:ejecutados!inner(id, nombre, numero_expediente, documento, is_draft, archived_at)",
      false,
      estado,
    )
      .order("pendiente_jus", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      // Tiebreaker, so paging is stable: pendiente_jus is 7 on every case that
      // never paid, which is most of them, and without this a row can show up
      // on two pages or on none.
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1),
    // The header's second figure, over the same filtered set. head:true so it
    // costs a count and not another page of rows.
    construir("id, ejecutado:ejecutados!inner(id)", true, "pendiente"),
  ]);

  if (listado.error) throw listado.error;
  if (pendientes.error) throw pendientes.error;

  return {
    items: (listado.data ?? []) as unknown as HonorarioFila[],
    totalCount: listado.count ?? 0,
    pendientesCount: pendientes.count ?? 0,
  };
}

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

// Set the honorario base and, optionally, the ceiling settled with the debtor.
// One per ejecutado; a trigger creates it at 7 JUS with every ejecutado, so this
// normally updates rather than inserts — the upsert only covers rows that
// predate the trigger.
//
// `maxAcordadoArs: null` clears the negotiated ceiling and falls back to the
// legal base x 1.31, which is denominated in JUS.
export async function setHonorarioMonto(
  supabase: Client,
  input: {
    ejecutadoId: string;
    userId: string;
    estudioId: string;
    montoJus: number;
    maxAcordadoArs: number | null;
  },
): Promise<void> {
  // Matches the DB's own honorarios_monto_total_jus_positivo. A NaN from an
  // empty field fails this too, which is the point.
  if (!(input.montoJus > 0)) {
    throw new Error("El honorario tiene que ser mayor a 0 JUS.");
  }
  // Matches honorarios_max_acordado_positivo. A ceiling of zero would reject
  // every future pago on a honorario that still reads as open.
  if (input.maxAcordadoArs !== null && !(input.maxAcordadoArs > 0)) {
    throw new Error("El máximo acordado tiene que ser mayor a 0.");
  }

  // Lowering either figure below what's already been collected would strand the
  // balance. The DB only caps pagos, not the total, so fence it here with a
  // clean message — against the EFFECTIVE ceiling, since collections legitimately
  // run past the base by IVA + aportes, and in the unit that ceiling is in.
  const existing = await getHonorarioWithBalance(supabase, input.ejecutadoId);
  if (existing) {
    const techo = techoHonorario({
      baseJus: input.montoJus,
      maxAcordadoArs: input.maxAcordadoArs,
      pagadoJus: existing.pagado_jus ?? 0,
      pagadoArs: existing.pagado_ars ?? 0,
      jusValue: await getJusValue(supabase),
    });
    if (techo.tipo === "acordado" && (existing.pagado_ars ?? 0) > techo.capArs) {
      throw new Error(
        `No se puede fijar el máximo acordado en ${formatArs(techo.capArs)}: ` +
          `ya se cobraron ${formatArs(existing.pagado_ars ?? 0)}.`,
      );
    }
    if (techo.tipo === "legal" && (existing.pagado_jus ?? 0) > (techo.capJus ?? 0)) {
      throw new Error(
        `No se puede fijar el honorario en ${input.montoJus} JUS: ` +
          `el máximo con IVA y aportes queda en ${formatArs(techo.capArs)} ` +
          `y ya se cobraron ${formatArs(existing.pagado_ars ?? 0)}.`,
      );
    }
  }

  const { error } = await supabase.from("honorarios").upsert(
    {
      ejecutado_id: input.ejecutadoId,
      estudio_id: input.estudioId,
      created_by_user_id: input.userId,
      monto_total_jus: input.montoJus,
      max_acordado_ars: input.maxAcordadoArs,
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

// Add a pago in ARS, or via "saldar" (fill the exact remaining), storing both
// units. The amount on the wire is always the GROSS pesos — what the juzgado
// actually transferred, fee plus IVA plus aportes — so the ceiling checked is
// the gross cap and monto_jus stays the gross JUS the trigger compares against.
// The form's JUS field names the fee and is converted client-side: there is
// deliberately no gross-JUS entry point left here, because a figure in JUS with
// tax inside is the defect this layer used to invite.
export async function addHonorarioPago(
  supabase: Client,
  input: {
    honorarioId: string;
    userId: string;
    estudioId: string;
    fecha: string;
    nota: string;
    montoArs?: number;
    saldar?: boolean;
  },
): Promise<void> {
  const jusValue = await getJusValue(supabase);

  const { data: hon, error: honError } = await supabase
    .from("honorarios_with_balance")
    .select("monto_total_jus, max_acordado_ars, pagado_jus, pagado_ars")
    .eq("id", input.honorarioId)
    .maybeSingle();
  if (honError) throw honError;
  if (!hon) throw new Error("Honorario no encontrado.");

  const techo = techoHonorario({
    baseJus: hon.monto_total_jus ?? 0,
    maxAcordadoArs: hon.max_acordado_ars,
    pagadoJus: hon.pagado_jus ?? 0,
    pagadoArs: hon.pagado_ars ?? 0,
    jusValue,
  });

  // Resolve the (JUS, ARS) pair. Gross pesos in, gross JUS derived from them.
  let montoJus: number;
  let montoArs: number;
  if (input.saldar) {
    // "Saldar" fills the remainder exactly, in the unit the ceiling is in —
    // converting the other way would leave a centavo the trigger then rejects.
    if (techo.tipo === "acordado") {
      montoArs = techo.pendienteArs;
      montoJus = arsToJus(montoArs, jusValue);
    } else {
      // Centavos: the JUS side is the one the trigger checks, and the pesos are
      // what the button offered — $488.137,44, not $488.137.
      montoJus = techo.pendienteJus ?? 0;
      montoArs = jusToArsExacto(montoJus, jusValue);
    }
  } else if (input.montoArs != null) {
    if (!(jusValue > 0)) throw new Error("No hay valor JUS configurado para convertir ARS.");
    montoArs = input.montoArs;
    montoJus = arsToJus(montoArs, jusValue);
  } else {
    throw new Error("Ingresá el monto del pago.");
  }

  // A real peso amount under ~$267 converts to 0.00 JUS at a JUS of 53.232, and
  // honorarios_pagos_monto_jus_check would reject the row. Reachable now that
  // pesos are the entry unit: the last instalment of a quita can be small. The
  // pesos are what was received and what the ceiling is checked against, so the
  // JUS side is floored at its own minimum rather than the payment refused.
  if (montoArs > 0 && montoJus <= 0) montoJus = 0.01;

  // Friendly fence; the DB trigger is the hard one. Checked in the ceiling's own
  // unit, exactly as check_honorario_pago_cap() does it.
  if (!(montoJus > 0) || !(montoArs > 0)) {
    throw new Error("El monto del pago debe ser mayor a 0.");
  }
  if (techo.tipo === "acordado") {
    if (montoArs > techo.pendienteArs) {
      throw new Error(
        `El pago de ${formatArs(montoArs)} excede lo pendiente del máximo acordado ` +
          `(${formatArs(techo.pendienteArs)}).`,
      );
    }
  } else if (montoJus > (techo.pendienteJus ?? 0)) {
    // Quoted in pesos, both sides: what is left under the ceiling carries IVA
    // and aportes, and a figure with tax inside is not a number of JUS.
    throw new Error(
      `El pago de ${formatArs(montoArs)} excede lo pendiente con IVA y aportes ` +
        `(${formatArs(techo.pendienteArs)}).`,
    );
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
