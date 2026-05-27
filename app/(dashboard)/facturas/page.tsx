import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { calcFactura, formatArs } from "@/lib/domain/facturas";
import { FacturaDialog } from "./factura-dialog";

export default async function FacturasPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("cobros_pagos")
    .select(
      "id, monto, fecha, ejecutado:ejecutados(id, nombre), factura:facturas(mensaje_generado, confirmada, fecha_generada)",
    )
    .eq("estado", "Proveído")
    .is("archived_at", null)
    .order("fecha", { ascending: false });

  const items = (rows ?? []).map((r) => ({
    pagoId: r.id,
    monto: Number(r.monto),
    fecha: r.fecha,
    demandado: r.ejecutado?.nombre ?? "—",
    factura: Array.isArray(r.factura)
      ? (r.factura[0] ?? null)
      : (r.factura ?? null),
  }));
  items.sort((a, b) => {
    const aConf = a.factura?.confirmada ? 1 : 0;
    const bConf = b.factura?.confirmada ? 1 : 0;
    return aConf - bConf;
  });

  const pendientes = items.filter((i) => !i.factura?.confirmada).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Facturas</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} pagos cobrados · {pendientes} facturas pendientes
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deudor</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Total factura</TableHead>
              <TableHead>Fecha pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.map((it) => {
                const { total } = calcFactura(it.monto);
                const status = !it.factura
                  ? { label: "Sin generar", variant: "outline" as const }
                  : it.factura.confirmada
                    ? { label: "Confirmada", variant: "ok" as const }
                    : { label: "Generada", variant: "warn" as const };
                return (
                  <TableRow
                    key={it.pagoId}
                    className={it.factura?.confirmada ? "opacity-60" : ""}
                  >
                    <TableCell className="font-medium">{it.demandado}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatArs(it.monto)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatArs(total)}
                    </TableCell>
                    <TableCell>
                      {new Date(it.fecha).toLocaleDateString("es-AR")}
                    </TableCell>
                    <TableCell>
                      {status.variant === "ok" ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          {status.label}
                        </Badge>
                      ) : status.variant === "warn" ? (
                        <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                          {status.label}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{status.label}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <FacturaDialog
                        pagoId={it.pagoId}
                        demandado={it.demandado}
                        monto={it.monto}
                        fecha={it.fecha}
                        factura={it.factura}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  Aún no hay pagos confirmados. Marcá un cobro como "Proveído"
                  para que aparezca acá.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}