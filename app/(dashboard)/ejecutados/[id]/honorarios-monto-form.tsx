"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArsInput } from "@/components/ars-input";
import {
  IVA_RATE,
  APORTES_RATE,
  composeGross,
  techoHonorario,
  formatArs,
  formatJus,
  jusToArs,
  arsToJus,
} from "@/lib/domain/honorarios";
import { setMonto } from "./honorarios-actions";

/**
 * The honorario and its ceiling, in one form that recalculates as you type.
 *
 * Two figures, deliberately kept apart on screen: the regulated fee (7 JUS by
 * default) and the tax charged on top of it. They used to arrive as a single
 * "máximo a cobrar" that read like the firm was charging 9,17 JUS, which is not
 * what the arancel says. The breakdown now spells out 7 + IVA + aportes = 9,17.
 *
 * The third figure is new: what was actually settled with the debtor. When it is
 * on, it replaces the legal ceiling — including below it, which is the common
 * case (a quita). It is a PESO amount: an agreement is a fixed number of pesos,
 * not a number of JUS that moves when the JUS does. The DB trigger enforces
 * whichever ceiling applies, each in its own unit.
 */
export function HonorariosMontoForm({
  ejecutadoId,
  montoJus,
  maxAcordadoArs,
  jusValue,
  pagadoJus,
  pagadoArs,
}: {
  ejecutadoId: string;
  montoJus: number;
  maxAcordadoArs: number | null;
  jusValue: number;
  pagadoJus: number;
  pagadoArs: number;
}) {
  const [monto, setMontoJus] = useState(String(montoJus));
  const [acordadoOn, setAcordadoOn] = useState(maxAcordadoArs != null);
  // Pesos first: that is the unit the agreement is actually in.
  const [unidad, setUnidad] = useState<"jus" | "ars">("ars");

  const base = Number(monto) || 0;
  const comp = composeGross(base);

  // Seeded from the legal ceiling in pesos, so switching the override on shows
  // the figure being negotiated away from rather than an empty box.
  const [acordado, setAcordado] = useState(
    maxAcordadoArs != null
      ? String(maxAcordadoArs)
      : String(jusToArs(comp.total, jusValue)),
  );

  const acordadoRaw = Number(acordado) || 0;
  const acordadoArs = !acordadoOn
    ? null
    : unidad === "ars"
      ? Math.round(acordadoRaw)
      : jusToArs(acordadoRaw, jusValue);

  const techo = techoHonorario({
    baseJus: base,
    maxAcordadoArs: acordadoArs,
    pagadoJus,
    pagadoArs,
    jusValue,
  });
  const topeLegalArs = jusToArs(comp.total, jusValue);
  const diffArs = techo.capArs - topeLegalArs;
  const quedaCorto =
    techo.tipo === "acordado" ? pagadoArs > techo.capArs : pagadoJus > (techo.capJus ?? 0);

  return (
    <form action={setMonto.bind(null, ejecutadoId)} className="space-y-4">
      <input type="hidden" name="max_on" value={acordadoOn ? "1" : ""} />
      <input type="hidden" name="max_unidad" value={unidad} />

      <div className="space-y-2">
        <Label htmlFor="monto_jus">Honorario regulado (JUS)</Label>
        <div className="flex items-center gap-3">
          <Input
            id="monto_jus"
            name="monto_jus"
            type="number"
            step="0.5"
            min="0.5"
            required
            className="w-28"
            value={monto}
            onChange={(e) => setMontoJus(e.target.value)}
          />
          <span className="text-sm text-muted-foreground tabular-nums">
            ≈ {formatArs(jusToArs(comp.base, jusValue))}
          </span>
        </div>
      </div>

      {/* The fee and the tax on it, one line each. */}
      <dl className="rounded-md border bg-muted/30 text-sm">
        <Row label="Honorario" jus={comp.base} jusValue={jusValue} />
        <Row
          label={`IVA ${Math.round(IVA_RATE * 100)}%`}
          jus={comp.iva}
          jusValue={jusValue}
          sign="+"
        />
        <Row
          label={`Aportes ${Math.round(APORTES_RATE * 100)}%`}
          jus={comp.aportes}
          jusValue={jusValue}
          sign="+"
        />
        <Row
          label="Tope legal"
          jus={comp.total}
          jusValue={jusValue}
          sign="="
          strong
          borderTop
        />
      </dl>

      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="max_on_switch" className="font-normal">
            Máximo acordado con el ejecutado
          </Label>
          <Switch
            id="max_on_switch"
            checked={acordadoOn}
            onCheckedChange={setAcordadoOn}
          />
        </div>

        {acordadoOn && (
          <>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="max_acordado" className="text-xs text-muted-foreground">
                  Monto ({unidad.toUpperCase()})
                </Label>
                {/* Same dual-unit pattern as the pago form: the peso mask would
                    misread a small JUS decimal like 9,17 as pesos. Only one of
                    the two is mounted, so name="max_acordado" posts once. */}
                {unidad === "ars" ? (
                  <ArsInput
                    id="max_acordado"
                    name="max_acordado"
                    min={0}
                    value={acordado === "" ? null : Number(acordado)}
                    onValueChange={(v) => setAcordado(v === null ? "" : String(v))}
                  />
                ) : (
                  <Input
                    id="max_acordado"
                    name="max_acordado"
                    type="number"
                    step="0.01"
                    min="0"
                    value={acordado}
                    onChange={(e) => setAcordado(e.target.value)}
                  />
                )}
              </div>
              <div className="flex gap-1 pb-px">
                <Button
                  type="button"
                  size="sm"
                  variant={unidad === "jus" ? "default" : "outline"}
                  onClick={() => {
                    if (unidad === "ars")
                      setAcordado(String(arsToJus(acordadoRaw, jusValue)));
                    setUnidad("jus");
                  }}
                >
                  JUS
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={unidad === "ars" ? "default" : "outline"}
                  onClick={() => {
                    if (unidad === "jus")
                      setAcordado(String(jusToArs(acordadoRaw, jusValue)));
                    setUnidad("ars");
                  }}
                >
                  ARS
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground tabular-nums">
              {/* A JUS entry is a shortcut for typing pesos, so the peso figure
                  that will actually be stored is the one echoed back. */}
              {unidad === "jus" && `≈ ${formatArs(acordadoArs ?? 0)} · `}
              {diffArs === 0
                ? "igual al tope legal"
                : `${formatArs(Math.abs(diffArs))} ${diffArs < 0 ? "menos" : "más"} que el tope legal`}
            </p>
          </>
        )}

        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-xs uppercase text-muted-foreground">Máximo a cobrar</span>
          <span className="text-right tabular-nums">
            <span className="text-base font-bold">{formatArs(techo.capArs)}</span>
            {techo.capJus !== null && (
              <span className="block text-xs text-muted-foreground">
                {formatJus(techo.capJus)}
              </span>
            )}
          </span>
        </div>

        {quedaCorto && (
          <p className="text-xs text-destructive">
            Ya se cobraron {formatArs(pagadoArs)}, más que este máximo.
          </p>
        )}
      </div>

      <Button type="submit" size="sm" disabled={quedaCorto}>
        Guardar
      </Button>
    </form>
  );
}

function Row({
  label,
  jus,
  jusValue,
  sign,
  strong,
  borderTop,
}: {
  label: string;
  jus: number;
  jusValue: number;
  sign?: string;
  strong?: boolean;
  borderTop?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 px-3 py-2 ${
        borderTop ? "border-t" : ""
      }`}
    >
      <dt className={`flex gap-1.5 ${strong ? "font-medium" : "text-muted-foreground"}`}>
        <span className="w-3 text-muted-foreground">{sign ?? ""}</span>
        {label}
      </dt>
      <dd className="text-right tabular-nums">
        <span className={strong ? "font-bold" : "font-medium"}>{formatJus(jus)}</span>
        <span className="block text-xs text-muted-foreground">
          {formatArs(jusToArs(jus, jusValue))}
        </span>
      </dd>
    </div>
  );
}
