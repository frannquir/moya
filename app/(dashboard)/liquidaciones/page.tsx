import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  sortTasasChronological,
  type TasaRow,
} from "@/lib/domain/liquidaciones";
import { parseLocalDate } from "@/lib/domain/dates";
import { LiquidacionCalculator } from "./calculator";
import { LiquidacionDownloadButton } from "@/components/liquidacion-download-button";

export default async function LiquidacionesPage() {
  const supabase = await createClient();

  const [{ data: liquidaciones }, { data: tasaRows }] = await Promise.all([
    supabase
      .from("liquidaciones")
      .select("*, ejecutado:ejecutados(id, nombre, archived_at)")
      .order("monto_adeudado", { ascending: false }),
    supabase.from("bcra_tasas").select("mes, anio, tna"),
  ]);

  const tasas = sortTasasChronological((tasaRows ?? []) as TasaRow[]);
  // Hide liquidaciones whose ejecutado is archived.
  const items = (liquidaciones ?? []).filter((l) => !l.ejecutado?.archived_at);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Liquidaciones</h1>
        <p className="text-sm text-muted-foreground">
          Calculadora de intereses y liquidaciones guardadas por caso.
        </p>
      </div>

      <LiquidacionCalculator tasas={tasas} />

      <div className="space-y-2">
        <h2 className="text-sm font-medium">
          Liquidaciones por ejecutado ({items.length})
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ejecutado</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">Monto adeudado</TableHead>
                <TableHead className="text-right">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length > 0 ? (
                items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/ejecutados/${l.ejecutado_id}`}
                        className="hover:underline"
                      >
                        {l.ejecutado?.nombre ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(l.fecha_desde)} → {fmtDate(l.fecha_hasta)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${formatCurrency(Number(l.capital))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      ${formatCurrency(Number(l.monto_adeudado))}
                    </TableCell>
                    <TableCell className="text-right">
                      <LiquidacionDownloadButton
                        input={{
                          cuenta: l.cuenta,
                          apynom: l.apellido_nombre,
                          fechaDesde: l.fecha_desde,
                          fechaHasta: l.fecha_hasta,
                          capital: Number(l.capital),
                          gastos: Number(l.gastos),
                        }}
                        tasas={tasas}
                        label="PDF"
                        variant="outline"
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aún no hay liquidaciones. Se generan al guardar un ejecutado con fecha desde y deuda inicial.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function fmtDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("es-AR");
}