"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calcularLiquidacion,
  parseSpanishNumber,
  formatCurrency,
  formatPeriodo,
  isClampedEnd,
  getUltimaTasa,
  type LiquidacionResult,
  type TasaRow,
} from "@/lib/domain/liquidaciones";
import { parseLocalDate } from "@/lib/domain/dates";
import { LiquidacionDownloadButton } from "@/components/liquidacion-download-button";

type ComputedInput = {
  cuenta: string;
  apynom: string;
  fechaDesde: string;
  fechaHasta: string;
  capital: number;
  gastos: number;
};

export function LiquidacionCalculator({ tasas }: { tasas: TasaRow[] }) {
  const today = new Date().toISOString().slice(0, 10);

  const [cuenta, setCuenta] = useState("");
  const [apynom, setApynom] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState(today);
  const [capital, setCapital] = useState("");
  const [gastos, setGastos] = useState("0");

  const [result, setResult] = useState<LiquidacionResult | null>(null);
  const [computed, setComputed] = useState<ComputedInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalcular = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cap = parseSpanishNumber(capital);
    const gas = parseSpanishNumber(gastos || "0");
    if (!fechaDesde) return setError("Ingresá la fecha desde.");
    if (isNaN(cap)) return setError("El capital debe ser un número válido.");
    if (isNaN(gas)) return setError("Los gastos deben ser un número válido.");

    const end = fechaHasta || today;
    try {
      const res = calcularLiquidacion(
        {
          cuenta,
          apynom,
          ultVenc: parseLocalDate(fechaDesde),
          fechaHasta: parseLocalDate(end),
          capital: cap,
          gastos: gas,
        },
        tasas,
      );
      setResult(res);
      setComputed({ cuenta, apynom, fechaDesde, fechaHasta: end, capital: cap, gastos: gas });
    } catch (err) {
      setResult(null);
      setComputed(null);
      setError(err instanceof Error ? err.message : "No se pudo calcular.");
    }
  };

  const clamped = computed
    ? isClampedEnd(parseLocalDate(computed.fechaHasta), tasas)
    : false;
  const ultima = getUltimaTasa(tasas);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculadora</CardTitle>
        <CardDescription>
          Calculá una liquidación de intereses y descargá el PDF. No se guarda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleCalcular} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Cuenta">
              <Input value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder="N° de cuenta" />
            </Field>
            <Field label="Apellido y nombre">
              <Input value={apynom} onChange={(e) => setApynom(e.target.value)} />
            </Field>
            <Field label="Fecha desde (vto.)">
              <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </Field>
            <Field label="Fecha hasta">
              <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </Field>
            <Field label="Capital">
              <Input value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="10.000,00" className="font-mono" />
            </Field>
            <Field label="Gastos">
              <Input value={gastos} onChange={(e) => setGastos(e.target.value)} placeholder="0,00" className="font-mono" />
            </Field>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit">Calcular</Button>
        </form>

        {result && computed && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-md border p-4 bg-muted/30">
              <Money label="Capital" value={result.capital} />
              <Money label="Intereses" value={result.totalIntereses} />
              <Money label="IVA (21%)" value={result.iva} />
              <Money label="Gastos" value={result.gastos} />
              <Money label="Monto adeudado" value={result.total} highlight />
            </div>

            {clamped && ultima && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Faltan tasas posteriores a {ultima.mes.toLowerCase()} {ultima.anio};
                el cálculo usa la última disponible.
              </div>
            )}

            <LiquidacionDownloadButton input={computed} tasas={tasas} />

            <div className="rounded-md border">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Importe deuda</TableHead>
                      <TableHead className="text-right">TNA</TableHead>
                      <TableHead className="text-right">T.E.M.</TableHead>
                      <TableHead className="text-right">Días</TableHead>
                      <TableHead className="text-right">Ints. comp.</TableHead>
                      <TableHead className="text-right">Ints. punit.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{formatPeriodo(row.periodo)}</TableCell>
                        <TableCell className="text-right tabular-nums">${formatCurrency(row.importeDeuda)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.tnaVigente.toFixed(4)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.tem.toFixed(4)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.diasDeMora}</TableCell>
                        <TableCell className="text-right tabular-nums">${formatCurrency(row.intsCompensatorios)}</TableCell>
                        <TableCell className="text-right tabular-nums">${formatCurrency(row.intsPunitorios)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Money({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "text-primary" : ""}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`tabular-nums ${highlight ? "text-lg font-bold" : "font-semibold"}`}>
        ${formatCurrency(Number(value))}
      </div>
    </div>
  );
}