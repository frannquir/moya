import { type Tables } from "@/lib/supabase/db-helpers";

export type Factura = Tables<"facturas">;

export const FACTURA_PORC = 0.15;
export const IVA_RATE = 0.21;

export function calcFactura(monto: number) {
  const base = monto * FACTURA_PORC;
  const iva = base * IVA_RATE;
  const total = base + iva;
  return { base, iva, total };
}

export function generateMensaje(params: {
  demandado: string;
  monto: number;
  empresa?: string | null;
}): string {
  const { base, iva, total } = calcFactura(params.monto);
  const empresa = params.empresa ?? "[empresa]";
  return `Buenas tardes, necesito una factura para ${empresa} por el pacto cuota litis, del deudor ${params.demandado} $${base.toFixed(2)} + $${iva.toFixed(2)} IVA, total: $${total.toFixed(2)}`;
}

export function formatArs(ars: number): string {
  return ars.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}