"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatArs, formatJus, jusToArs, arsToJus } from "@/lib/domain/honorarios";
import { addPago } from "./honorarios-actions";

export function HonorariosAddPagoForm({
  honorarioId,
  jusValue,
  pendienteJus,
}: {
  honorarioId: string;
  jusValue: number;
  pendienteJus: number;
}) {
  const [unidad, setUnidad] = useState<"jus" | "ars">("jus");
  const [monto, setMonto] = useState("");

  const n = Number(monto || 0);
  const preview =
    unidad === "jus"
      ? `≈ ${formatArs(jusToArs(n, jusValue))}`
      : `≈ ${formatJus(arsToJus(n, jusValue))}`;

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
          Saldar ({formatJus(pendienteJus)})
        </Button>
      </div>
    </form>
  );
}
