"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/date-field";
import { ArsInput } from "@/components/ars-input";
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
  interesGastos: number;
};

export function LiquidacionCalculator({ tasas }: { tasas: TasaRow[] }) {
  const today = new Date().toISOString().slice(0, 10);

  const [cuenta, setCuenta] = useState("");
  const [apynom, setApynom] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState(today);
  // Numbers, not strings. These used to be free text run through
  // parseSpanishNumber, which reads a grouped amount with no decimals wrongly:
  // "10.000" came back as 10 and "1.234.567" as 1.234, because parseFloat stops
  // at the second dot. ArsInput parses through lib/domain/moneda-ar instead.
  const [capital, setCapital] = useState<number | null>(null);
  const [gastos, setGastos] = useState<number | null>(0);
  const [interesGastos, setInteresGastos] = useState<number | null>(0);

  const [result, setResult] = useState<LiquidacionResult | null>(null);
  const [computed, setComputed] = useState<ComputedInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalcular = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cap = capital;
    const gas = gastos ?? 0;
    const intGas = interesGastos ?? 0;
    if (!fechaDesde) return setError("Ingresá la fecha desde.");
    if (cap === null) return setError("Ingresá el capital.");

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
          interesGastos: intGas,
        },
        tasas,
      );
      setResult(res);
      setComputed({
        cuenta,
        apynom,
        fechaDesde,
        fechaHasta: end,
        capital: cap,
        gastos: gas,
        interesGastos: intGas,
      });
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
              <DateField name="fecha_desde" value={fechaDesde} onValueChange={setFechaDesde} />
            </Field>
            <Field label="Fecha hasta">
              <DateField name="fecha_hasta" value={fechaHasta} onValueChange={setFechaHasta} />
            </Field>
            <Field label="Capital">
              <ArsInput name="capital" value={capital} onValueChange={setCapital} min={0} placeholder="10.000,00" />
            </Field>
            <Field label="Gastos">
              <ArsInput name="gastos" value={gastos} onValueChange={setGastos} min={0} />
            </Field>
            <Field label="Interés s/ gastos">
              <ArsInput
                name="interes_gastos"
                value={interesGastos}
                onValueChange={setInteresGastos}
                min={0}
              />
            </Field>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit">Calcular</Button>
        </form>

        {result && computed && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 rounded-md border p-4 bg-muted/30">
              <Money label="Capital" value={result.capital} />
              <Money label="Intereses" value={result.totalIntereses} />
              <Money label="IVA (21%)" value={result.iva} />
              <Money label="Gastos" value={result.gastos} />
              <Money label="Interés s/ gastos" value={result.interesGastos} />
              <Money label="Monto adeudado" value={result.total} highlight />
            </div>

            {clamped && ultima && (
              <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
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