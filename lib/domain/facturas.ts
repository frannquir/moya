import { type Tables } from "@/lib/supabase/db-helpers";
import { splitGross } from "@/lib/domain/honorarios";

export type Factura = Tables<"facturas">;

export const FACTURA_PORC = 0.15;
export const IVA_RATE = 0.21;

/**
 * The two messages the firm sends its accountant. They are different requests
 * about different money:
 *
 *   cuota-litis — the firm's 15% of what the DEBTOR paid, invoiced to the
 *                 empresa that owns the debt. Comes from a cobro.
 *   factura-b   — the firm's own regulated fees, invoiced to the debtor by DNI,
 *                 with the 10% aportes named separately because they go under
 *                 "otros tributos". Comes from a fee payment.
 */
export type TipoFactura = "cuota-litis" | "factura-b";

export function calcFactura(monto: number) {
  const base = monto * FACTURA_PORC;
  const iva = base * IVA_RATE;
  const total = base + iva;
  return { base, iva, total };
}

/**
 * Money as the message prints it: "$24.000,00".
 *
 * Not formatArs() below — that one puts a space after the symbol ("$ 24.000,00"),
 * which is right in a table and wrong in a sentence pasted into WhatsApp. The
 * previous toFixed(2) produced "$24000.00", an amount in no convention at all.
 */
export function montoMensaje(ars: number): string {
  return `$${ars.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A missing value prints as [TOKEN] — the same marker the escritos engine uses,
 * so the dialog can find it with extractUnresolved() and offer a link to the
 * screen that fills it. Never a plausible-looking placeholder: a factura made
 * out to the wrong DNI is worse than one that visibly refuses to guess.
 */
const marcador = (valor: string | null | undefined, token: string) => {
  const v = (valor ?? "").trim();
  return v === "" ? `[${token}]` : v;
};

export function generateMensajeCuotaLitis(params: {
  demandado: string;
  monto: number;
  empresa?: string | null;
}): string {
  const { base, iva, total } = calcFactura(params.monto);
  return (
    `Buenas tardes, necesito una factura para ${marcador(params.empresa, "EMPRESA")} ` +
    `por el pacto cuota litis, del deudor ${marcador(params.demandado, "DEMANDADO")} ` +
    `${montoMensaje(base)} + ${montoMensaje(iva)} IVA, total: ${montoMensaje(total)}`
  );
}

/**
 * The Factura B request. `montoArs` is the gross fee payment received; the
 * aportes are the 10% inside it, which splitGross() recovers by dividing by the
 * same 1.31 the pago ceiling uses — so the figure named here is exactly the one
 * the honorarios card prints for that payment.
 */
export function generateMensajeFacturaB(params: {
  demandado: string;
  documento?: string | null;
  montoArs: number;
}): string {
  const { aportes } = splitGross(params.montoArs);
  return (
    `Buenos dias, cuando puedas me haces una Fact B a nombre de ` +
    `${marcador(params.demandado, "DEMANDADO")} dni ${marcador(params.documento, "DOCUMENTO")} ` +
    `en concepto de honorarios, el total de ${montoMensaje(params.montoArs)}, ` +
    `en otros tributos el 10% de aportes ${montoMensaje(aportes)}`
  );
}

export function generateMensaje(params: {
  tipo: TipoFactura;
  demandado: string;
  monto: number;
  empresa?: string | null;
  documento?: string | null;
}): string {
  return params.tipo === "factura-b"
    ? generateMensajeFacturaB({
        demandado: params.demandado,
        documento: params.documento,
        montoArs: params.monto,
      })
    : generateMensajeCuotaLitis({
        demandado: params.demandado,
        monto: params.monto,
        empresa: params.empresa,
      });
}

export function formatArs(ars: number): string {
  return ars.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
