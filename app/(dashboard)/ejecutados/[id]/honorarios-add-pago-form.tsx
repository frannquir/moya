"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IVA_RATE,
  APORTES_RATE,
  formatArs,
  formatJus,
  jusToArs,
  arsToJus,
  splitGross,
} from "@/lib/domain/honorarios";
import { addPago } from "./honorarios-actions";

export function HonorariosAddPagoForm({
  honorarioId,
  jusValue,
  pendienteGrossJus,
}: {
  honorarioId: string;
  jusValue: number;
  pendienteGrossJus: number;
}) {
  const [unidad, setUnidad] = useState<"jus" | "ars">("jus");
  const [monto, setMonto] = useState("");

  const n = Number(monto || 0);
  const montoJus = unidad === "jus" ? n : arsToJus(n, jusValue);
  const preview =
    unidad === "jus"
      ? `≈ ${formatArs(jusToArs(n, jusValue))}`
      : `≈ ${formatJus(arsToJus(n, jusValue))}`;

  // What the lawyer is actually charging vs. what is tax they collect and remit.
  const split = splitGross(montoJus > 0 ? montoJus : 0);
  const excede = montoJus > pendienteGrossJus;

  return (
    <form
      action={addPago.bind(null, honorarioId)}
      className="space-y-3 rounded-md border p-4"
    >
      <input type="hidden" name="unidad" value={unidad} />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Registrar pago</h3>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={unidad === "jus" ? "default" : "outline"}
            onClick={() => setUnidad("jus")}
          >
            JUS
          </Button>
          <Button
            type="button"
            size="sm"
            variant={unidad === "ars" ? "default" : "outline"}
            onClick={() => setUnidad("ars")}
          >
            ARS
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="monto">Monto ({unidad.toUpperCase()})</Label>
          <Input
            id="monto"
            name="monto"
            type="number"
            step={unidad === "jus" ? "0.01" : "1"}
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Equivalente</Label>
          <div className="h-9 rounded-md border bg-muted px-3 flex items-center text-sm tabular-nums">
            {preview}
          </div>
        </div>
      </div>

      {/* The point of the tax model: how much of this is fee, how much is tax. */}
      {montoJus > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs">
          <div className="mb-1 text-muted-foreground">De este pago:</div>
          <div className="grid grid-cols-3 gap-2 tabular-nums">
            <SplitCell label="Honorario" jus={split.base} jusValue={jusValue} />
            <SplitCell
              label={`IVA ${Math.round(IVA_RATE * 100)}%`}
              jus={split.iva}
              jusValue={jusValue}
            />
            <SplitCell
              label={`Aportes ${Math.round(APORTES_RATE * 100)}%`}
              jus={split.aportes}
              jusValue={jusValue}
            />
          </div>
          {excede && (
            <p className="mt-2 text-destructive">
              Excede lo pendiente con IVA y aportes ({formatJus(pendienteGrossJus)}).
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nota">Nota</Label>
          <Input id="nota" name="nota" placeholder="Opcional" />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Agregar pago
        </Button>
        <Button
          type="submit"
          name="intent"
          value="saldar"
          size="sm"
          variant="outline"
        >
          Saldar ({formatJus(pendienteGrossJus)})
        </Button>
      </div>
    </form>
  );
}

function SplitCell({
  label,
  jus,
  jusValue,
}: {
  label: string;
  jus: number;
  jusValue: number;
}) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{formatJus(jus)}</div>
      <div className="text-muted-foreground">{formatArs(jusToArs(jus, jusValue))}</div>
    </div>
  );
}
