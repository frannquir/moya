"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArsInput } from "@/components/ars-input";
import { DateField } from "@/components/date-field";
import {
  IVA_RATE,
  APORTES_RATE,
  formatArsExacto,
  formatJus,
  arsToBaseJus,
  baseJusToArs,
  splitGross,
} from "@/lib/domain/honorarios";
import { addPago } from "./honorarios-actions";

export function HonorariosAddPagoForm({
  honorarioId,
  jusValue,
  pendienteArs,
}: {
  honorarioId: string;
  jusValue: number;
  pendienteArs: number;
}) {
  // Pesos first: a payment arrives as a bank transfer, not as a number of JUS.
  const [unidad, setUnidad] = useState<"jus" | "ars">("ars");
  const [monto, setMonto] = useState("");

  const n = Number(monto || 0);
  // The two fields are reciprocal with the 1.31 inside: ARS is what the juzgado
  // transfers, JUS is the fee that reaches the account. Whichever was typed, the
  // gross pesos are what gets posted — one format on the wire, one conversion,
  // no base -> gross -> JUS -> pesos round trip to lose a centavo the trigger
  // would then reject.
  const montoArs = unidad === "ars" ? n : baseJusToArs(n, jusValue);
  const excede = montoArs > pendienteArs;

  // What the lawyer is actually charging vs. what is tax the juzgado withholds
  // and remits. In pesos: an IVA expressed in JUS is the figure that means
  // nothing, and this way the parts reconcile to the amount actually banked.
  const split = splitGross(montoArs > 0 ? montoArs : 0);

  return (
    <form
      action={addPago.bind(null, honorarioId)}
      className="space-y-3 rounded-md border p-4"
    >
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

      <div className="@container grid grid-cols-1 gap-3 @xs:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="monto">
            {unidad === "ars" ? "Monto transferido (ARS)" : "Honorario (JUS)"}
          </Label>
          {/* Dual-unit field, so the peso mask applies only in ARS mode: a JUS
              figure is a small decimal like 3,06 and thousands grouping plus a
              "$" would misread it as pesos. Only the ARS branch posts what was
              typed; the JUS branch types a fee and posts the gross pesos it
              comes to, through a hidden sibling (same shape as DateField). */}
          {unidad === "ars" ? (
            <ArsInput
              id="monto"
              name="monto_ars"
              min={0}
              value={monto === "" ? null : Number(monto)}
              onValueChange={(v) => setMonto(v === null ? "" : String(v))}
            />
          ) : (
            <>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <input
                type="hidden"
                name="monto_ars"
                value={montoArs > 0 ? String(montoArs) : ""}
              />
            </>
          )}
        </div>
        <div className="space-y-2">
          <Label>{unidad === "ars" ? "Honorario" : "Monto transferido"}</Label>
          <div className="h-9 rounded-md border bg-muted px-3 flex items-center text-sm tabular-nums">
            {unidad === "ars"
              ? `≈ ${formatJus(arsToBaseJus(n, jusValue))}`
              : `≈ ${formatArsExacto(montoArs)}`}
          </div>
        </div>
      </div>

      {/* The point of the tax model: how much of this is fee, how much is tax. */}
      {montoArs > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs">
          <div className="mb-1 text-muted-foreground">De este pago:</div>
          <div className="@container grid grid-cols-1 gap-2 tabular-nums @xs:grid-cols-3">
            <SplitCell label="Honorario" ars={split.base} />
            <SplitCell label={`IVA ${Math.round(IVA_RATE * 100)}%`} ars={split.iva} />
            <SplitCell
              label={`Aportes ${Math.round(APORTES_RATE * 100)}%`}
              ars={split.aportes}
            />
          </div>
          {excede && (
            <p className="mt-2 text-destructive">
              Excede lo pendiente ({formatArsExacto(pendienteArs)}).
            </p>
          )}
        </div>
      )}

      <div className="@container grid grid-cols-1 gap-3 @xs:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha</Label>
          <DateField
            id="fecha"
            name="fecha"
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
          Saldar ({formatArsExacto(pendienteArs)})
        </Button>
      </div>
    </form>
  );
}

function SplitCell({ label, ars }: { label: string; ars: number }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{formatArsExacto(ars)}</div>
    </div>
  );
}
