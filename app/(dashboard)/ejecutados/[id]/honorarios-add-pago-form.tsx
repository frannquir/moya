"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatArs, jusToArs } from "@/lib/domain/honorarios";
import { addHonorarioPago } from "./honorarios-actions";

export function HonorariosAddPagoForm({
  honorarioId,
  jusValue,
}: {
  honorarioId: string;
  jusValue: number;
}) {
  const [jus, setJus] = useState("");
  const arsPreview = jusToArs(Number(jus || 0), jusValue);

  return (
    <form
      action={addHonorarioPago.bind(null, honorarioId)}
      className="space-y-3 rounded-md border p-4"
    >
      <h3 className="text-sm font-medium">Registrar pago</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="monto_jus">JUS *</Label>
          <Input
            id="monto_jus"
            name="monto_jus"
            type="number"
            step="0.01"
            min="0"
            value={jus}
            onChange={(e) => setJus(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Equivalente en ARS</Label>
          <div className="h-9 rounded-md border bg-muted px-3 flex items-center text-sm tabular-nums">
            {formatArs(arsPreview)}
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
      <Button type="submit" size="sm">
        Agregar pago
      </Button>
    </form>
  );
}