import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type TipoFactura } from "@/lib/domain/facturas";

type Client = SupabaseClient<Database>;

export type FacturaRow = {
  mensaje_generado: string;
  confirmada: boolean;
  fecha_generada: string;
};

/**
 * One invoiceable payment, from either side of the ledger.
 *
 * `id` is the payment's own id — a cobros_pagos row for "cuota-litis", a
 * honorarios_pagos row for "factura-b" — and `tipo` says which, because the two
 * are stored in different tables and hang off different columns of facturas.
 */
export type ItemFacturable = {
  tipo: TipoFactura;
  pagoId: string;
  ejecutadoId: string | null;
  demandado: string;
  empresa: string | null;
  documento: string;
  monto: number;
  fecha: string;
  factura: FacturaRow | null;
};

const primeraFactura = (f: unknown): FacturaRow | null =>
  Array.isArray(f) ? ((f[0] as FacturaRow) ?? null) : ((f as FacturaRow) ?? null);

/**
 * Everything the firm could invoice, newest first.
 *
 * Two queries rather than one: the sources are different tables with different
 * shapes, and a view over both would have to invent a common column set that
 * neither side really has. RLS scopes both to the estudio with no delegation
 * clause, so the head — and every member — sees the firm's whole ledger here.
 *
 * The ejecutados join IS delegation-filtered, so a non-head member reading a
 * case that is not theirs gets a null ejecutado; `demandado` falls back to "—"
 * rather than dropping the row, which would silently understate the firm's
 * income for them.
 */
export async function listFacturables(supabase: Client): Promise<ItemFacturable[]> {
  const [cobros, honorarios] = await Promise.all([
    supabase
      .from("cobros_pagos")
      .select(
        "id, monto, fecha, ejecutado:ejecutados(id, nombre, empresa, documento), factura:facturas!facturas_pago_id_fkey(mensaje_generado, confirmada, fecha_generada)",
      )
      .eq("estado", "Proveído")
      .is("archived_at", null),
    supabase
      .from("honorarios_pagos")
      .select(
        "id, monto_ars, fecha, honorario:honorarios(ejecutado:ejecutados(id, nombre, empresa, documento)), factura:facturas!facturas_honorario_pago_id_fkey(mensaje_generado, confirmada, fecha_generada)",
      )
      .is("archived_at", null),
  ]);

  if (cobros.error) throw cobros.error;
  if (honorarios.error) throw honorarios.error;

  const items: ItemFacturable[] = [];

  for (const r of cobros.data ?? []) {
    const ej = r.ejecutado;
    items.push({
      tipo: "cuota-litis",
      pagoId: r.id,
      ejecutadoId: ej?.id ?? null,
      demandado: ej?.nombre ?? "—",
      empresa: ej?.empresa ?? null,
      documento: ej?.documento ?? "",
      monto: Number(r.monto),
      fecha: r.fecha,
      factura: primeraFactura(r.factura),
    });
  }

  for (const r of honorarios.data ?? []) {
    const ej = r.honorario?.ejecutado;
    items.push({
      tipo: "factura-b",
      pagoId: r.id,
      ejecutadoId: ej?.id ?? null,
      demandado: ej?.nombre ?? "—",
      empresa: ej?.empresa ?? null,
      documento: ej?.documento ?? "",
      monto: Number(r.monto_ars),
      fecha: r.fecha,
      factura: primeraFactura(r.factura),
    });
  }

  // Pending first, then newest — the screen is a worklist, not an archive.
  items.sort((a, b) => {
    const ac = a.factura?.confirmada ? 1 : 0;
    const bc = b.factura?.confirmada ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return b.fecha.localeCompare(a.fecha);
  });

  return items;
}
