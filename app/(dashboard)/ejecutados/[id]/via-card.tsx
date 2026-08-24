"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/date-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CUOTAS_OPTIONS, type Cuotas, type Via } from "@/lib/domain/ejecutado";
import { cuotasTexto, montosCuotas, vencimientos } from "@/lib/domain/convenio";
import { formatArDate } from "@/lib/domain/dates";
import { formatCurrency } from "@/lib/domain/liquidaciones";

type Action = (formData: FormData) => void | Promise<void>;

export type ViaCardProps = {
  via: Via;
  montoAcuerdo: number | null;
  cuotas: number | null;
  fechaVencimiento: string | null;
  action: Action;
};

/**
 * The via switch — "Pasar a extrajudicial" and back.
 *
 * via is an axis parallel to movimiento (locked decision #15), so this is its
 * own card rather than a field in the "Datos" form: the case keeps whatever
 * procedural stage it was at when the debtor called.
 *
 * The schedule shown here is derived, exactly as the convenio derives it — the
 * three inputs are all that is ever stored (Fran, 2026-08-18). Seeing the dates
 * before generating is the point: it is the lawyer's check that the agreement
 * they typed is the agreement the document will say.
 */
export function ViaCard({
  via,
  montoAcuerdo,
  cuotas,
  fechaVencimiento,
  action,
}: ViaCardProps) {
  const esExtrajudicial = via === "extrajudicial";

  // Open by default on an extrajudicial case: the terms ARE the card's content
  // there, not something hidden behind a button.
  const [open, setOpen] = useState(esExtrajudicial);
  const [monto, setMonto] = useState(montoAcuerdo !== null ? String(montoAcuerdo) : "");
  const [nCuotas, setNCuotas] = useState<string>(String(cuotas ?? 1));
  const [vencimiento, setVencimiento] = useState(fechaVencimiento ?? "");

  const montoNum = Number(monto) || 0;
  const cuotasNum = Number(nCuotas) || 1;
  const previewable = montoNum > 0 && vencimiento !== "";
  const fechas = previewable ? vencimientos(vencimiento, cuotasNum) : [];
  const importes = previewable ? montosCuotas(montoNum, cuotasNum) : [];

  return (
    <Card
      className={esExtrajudicial ? "border-success/40 bg-success/5" : undefined}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span>Vía</span>
          <Badge variant={esExtrajudicial ? "default" : "outline"}>
            {esExtrajudicial ? "Extrajudicial" : "Judicial"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {esExtrajudicial
            ? "El deudor tomó contacto y acordó pagar. La causa sigue en su etapa procesal; esto es un eje aparte."
            : "Pasá el caso a extrajudicial cuando el deudor tome contacto y acuerde pagar."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {esExtrajudicial && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Dato
              label="Monto del acuerdo"
              value={montoAcuerdo !== null ? `$${formatCurrency(montoAcuerdo)}` : "—"}
            />
            <Dato label="Cuotas" value={cuotas !== null ? String(cuotas) : "—"} />
            <Dato
              label="Primer vencimiento"
              value={fechaVencimiento ? formatArDate(fechaVencimiento) : "—"}
            />
          </div>
        )}

        {!open ? (
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            Pasar a extrajudicial
          </Button>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="via" value="extrajudicial" />
            <input type="hidden" name="via_actual" value={via} />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="via-monto">Monto del acuerdo</Label>
                <Input
                  id="via-monto"
                  name="monto_acuerdo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="via-cuotas">Cuotas</Label>
                <Select value={nCuotas} onValueChange={setNCuotas}>
                  <SelectTrigger id="via-cuotas" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUOTAS_OPTIONS.map((c: Cuotas) => (
                      <SelectItem key={c} value={String(c)}>
                        {c === 1 ? "1 pago" : `${c} cuotas`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Radix Select is not a form control; the value travels here. */}
                <input type="hidden" name="cuotas" value={nCuotas} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="via-vencimiento">Vencimiento de la primera</Label>
                <DateField
                  id="via-vencimiento"
                  name="fecha_vencimiento"
                  value={vencimiento}
                  onValueChange={setVencimiento}
                  required
                />
              </div>
            </div>

            {previewable && (
              <div className="rounded-md border bg-background p-3 text-sm">
                <p className="font-medium">
                  El convenio va a decir: en {cuotasTexto(montoNum, cuotasNum)}.
                </p>
                <ul className="mt-2 space-y-0.5 text-muted-foreground">
                  {fechas.map((f, i) => (
                    <li key={f + String(i)} className="tabular-nums">
                      Cuota {i + 1}: ${formatCurrency(importes[i])} — {formatArDate(f)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Si un vencimiento cae en día inhábil o feriado, el convenio ya
                  prevé que el pago se hace el día hábil posterior.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm">
                {esExtrajudicial ? "Guardar acuerdo" : "Pasar a extrajudicial"}
              </Button>
              {!esExtrajudicial && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        )}

        {esExtrajudicial && (
          <form action={action} className="border-t pt-3">
            <input type="hidden" name="via" value="judicial" />
            <input type="hidden" name="via_actual" value={via} />
            <Button type="submit" size="sm" variant="outline">
              Volver a judicial
            </Button>
            <p className="pt-1 text-xs text-muted-foreground">
              Se borran el monto, las cuotas y el vencimiento — solo tienen sentido
              bajo un acuerdo.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
