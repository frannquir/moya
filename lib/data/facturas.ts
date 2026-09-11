import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type TipoFactura } from "@/lib/domain/facturas";

type Client = SupabaseClient<Database>;

export type FacturaRow = {
  mensaje_generado: string;
  confirmada: boolean;
  fecha_generada: string;
  tipo: TipoFactura;
};

/** Every payment opens on this one; the dialog flips it when it is the other. */
export const TIPO_POR_DEFECTO: TipoFactura = "cuota-litis";

/**
 * One invoiceable payment, from either side of the ledger.
 *
 * `origen` says which table the money is in — that is fixed by where it was
 * recorded. `tipo` says which of the two messages was written about it, which is
 * the lawyer's choice and defaults to cuota litis for everything. The two are
 * deliberately independent: a cobro can carry a Factura B.
 */
export type ItemFacturable = {
  origen: "cobro" | "honorario";
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
        "id, monto, fecha, ejecutado:ejecutados(id, nombre, empresa, documento), factura:facturas!facturas_pago_id_fkey(mensaje_generado, confirmada, fecha_generada, tipo)",
      )
      .eq("estado", "Proveído")
      .is("archived_at", null),
    supabase
      .from("honorarios_pagos")
      .select(
        "id, monto_ars, fecha, honorario:honorarios(ejecutado:ejecutados(id, nombre, empresa, documento)), factura:facturas!facturas_honorario_pago_id_fkey(mensaje_generado, confirmada, fecha_generada, tipo)",
      )
      .is("archived_at", null),
  ]);

  if (cobros.error) throw cobros.error;
  if (honorarios.error) throw honorarios.error;

  const items: ItemFacturable[] = [];

  for (const r of cobros.data ?? []) {
    const ej = r.ejecutado;
    const factura = primeraFactura(r.factura);
    items.push({
      origen: "cobro",
      tipo: factura?.tipo ?? TIPO_POR_DEFECTO,
      pagoId: r.id,
      ejecutadoId: ej?.id ?? null,
      demandado: ej?.nombre ?? "—",
      empresa: ej?.empresa ?? null,
      documento: ej?.documento ?? "",
      monto: Number(r.monto),
      fecha: r.fecha,
      factura,
    });
  }

  for (const r of honorarios.data ?? []) {
    const ej = r.honorario?.ejecutado;
    const factura = primeraFactura(r.factura);
    items.push({
      origen: "honorario",
      tipo: factura?.tipo ?? TIPO_POR_DEFECTO,
      pagoId: r.id,
      ejecutadoId: ej?.id ?? null,
      demandado: ej?.nombre ?? "—",
      empresa: ej?.empresa ?? null,
      documento: ej?.documento ?? "",
      monto: Number(r.monto_ars),
      fecha: r.fecha,
      factura,
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
