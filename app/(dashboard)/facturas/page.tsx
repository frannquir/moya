import type { Metadata } from "next";
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
import { splitGross } from "@/lib/domain/honorarios";
import { formatArDate } from "@/lib/domain/dates";
import { listFacturables } from "@/lib/data/facturas";
import { FacturaDialog } from "./factura-dialog";

export const metadata: Metadata = { title: "Facturas" };

export default async function FacturasPage() {
  const supabase = await createClient();
  const items = await listFacturables(supabase);

  const pendientes = items.filter((i) => !i.factura?.confirmada).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Facturas</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} pagos facturables · {pendientes} facturas pendientes ·
          cobros del deudor (pacto cuota litis) y honorarios cobrados (Factura B)
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deudor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Total factura</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.map((it) => {
                // What the accountant is asked to invoice: the firm's 15% cut on
                // a cobro, the whole fee payment on a Factura B.
                const total =
                  it.tipo === "factura-b"
                    ? it.monto
                    : calcFactura(it.monto).total;
                const aportes =
                  it.tipo === "factura-b" ? splitGross(it.monto).aportes : null;
                const status = !it.factura
                  ? { label: "Sin generar", variant: "outline" as const }
                  : it.factura.confirmada
                    ? { label: "Confirmada", variant: "ok" as const }
                    : { label: "Generada", variant: "warn" as const };
                return (
                  <TableRow
                    key={`${it.tipo}:${it.pagoId}`}
                    className={it.factura?.confirmada ? "opacity-60" : ""}
                  >
                    <TableCell className="font-medium">{it.demandado}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {it.tipo === "factura-b" ? "Factura B" : "Cuota litis"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatArs(it.monto)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatArs(total)}
                      {aportes !== null && (
                        <div className="text-xs text-muted-foreground">
                          aportes {formatArs(aportes)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{formatArDate(it.fecha)}</TableCell>
                    <TableCell>
                      {status.variant === "ok" ? (
                        <Badge variant="success">{status.label}</Badge>
                      ) : status.variant === "warn" ? (
                        <Badge variant="warning">{status.label}</Badge>
                      ) : (
                        <Badge variant="outline">{status.label}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <FacturaDialog
                        tipo={it.tipo}
                        pagoId={it.pagoId}
                        ejecutadoId={it.ejecutadoId}
                        demandado={it.demandado}
                        empresa={it.empresa}
                        documento={it.documento}
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
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  Aún no hay pagos para facturar. Marcá un cobro como
                  &quot;Proveído&quot; o registrá un pago de honorarios.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
