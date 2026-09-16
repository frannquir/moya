"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArsInput } from "@/components/ars-input";
import {
  composeGross,
  composeGrossArs,
  techoHonorario,
  formatArs,
  formatArsExacto,
  roundCentavos,
  jusToArs,
  arsToBaseJus,
  baseJusToArs,
} from "@/lib/domain/honorarios";
import { setMonto, type MontoState } from "./honorarios-actions";

const EMPTY: MontoState = { ok: null, error: null };

/**
 * Everything that changes a honorario, behind a button.
 *
 * The card itself is read-only now — the regulated fee, the tax on it, the
 * pesos. Both knobs that used to sit on it live here instead: the base (7 JUS
 * unless the case was regulated otherwise) and the ceiling actually settled with
 * the debtor, which is a PESO amount — an agreement is a fixed number of pesos,
 * not a number of JUS that moves when the JUS does.
 *
 * Every JUS field here names the fee, tax excluded, and the ceiling prints in
 * pesos whichever of the two applies. Only that ceiling is previewed while
 * typing; the full breakdown is on the card behind this dialog.
 */
export function HonorariosEditarDialog({
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
  const [open, setOpen] = useState(false);
  // Closing happens inside the action rather than in an effect watching the
  // result: the dialog should shut on a save that worked and stay open, fields
  // intact, on one that did not.
  const [state, action, pending] = useActionState(
    async (prev: MontoState, formData: FormData) => {
      const next = await setMonto(ejecutadoId, prev, formData);
      if (next.ok) setOpen(false);
      return next;
    },
    EMPTY,
  );

  const [monto, setMontoJus] = useState(String(montoJus));
  const [acordadoOn, setAcordadoOn] = useState(maxAcordadoArs != null);
  // Pesos first: that is the unit the agreement is actually in.
  const [unidad, setUnidad] = useState<"jus" | "ars">("ars");

  const base = Number(monto) || 0;
  const comp = composeGross(base);
  // The legal ceiling in pesos, to the centavo, exactly as the card prints it.
  const compArs = composeGrossArs(base, jusValue);

  // Seeded from the legal ceiling in pesos, so switching the override on shows
  // the figure being negotiated away from rather than an empty box.
  const [acordado, setAcordado] = useState(
    maxAcordadoArs != null
      ? String(maxAcordadoArs)
      : String(composeGrossArs(montoJus, jusValue).total),
  );

  const acordadoRaw = Number(acordado) || 0;
  // Centavos, not whole pesos: the action stores the peso figure as typed and
  // techoHonorario() keeps it to the centavo, so rounding here would preview a
  // ceiling one peso off from the one that ends up in the DB. A JUS entry names
  // the fee, so the tax the juzgado withholds is added on the way to pesos.
  const acordadoArs = !acordadoOn
    ? null
    : unidad === "ars"
      ? roundCentavos(acordadoRaw)
      : baseJusToArs(acordadoRaw, jusValue);

  const techo = techoHonorario({
    baseJus: base,
    maxAcordadoArs: acordadoArs,
    pagadoJus,
    pagadoArs,
    jusValue,
  });
  const topeLegalArs = compArs.total;
  const diffArs = techo.capArs - topeLegalArs;
  const quedaCorto =
    techo.tipo === "acordado" ? pagadoArs > techo.capArs : pagadoJus > (techo.capJus ?? 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar honorario</DialogTitle>
          <DialogDescription>
            El honorario regulado y, si hubo acuerdo con el ejecutado, el máximo que
            se le va a cobrar.
          </DialogDescription>
        </DialogHeader>

        <form id="honorario-monto" action={action} className="space-y-4">
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
                    <Label
                      htmlFor="max_acordado"
                      className="text-xs text-muted-foreground"
                    >
                      {unidad === "ars" ? "Monto (ARS)" : "Honorario (JUS)"}
                    </Label>
                    {/* Same dual-unit pattern as the pago form: the peso mask
                        would misread a small JUS decimal as pesos, and a JUS
                        entry names the fee, never the ceiling with its tax
                        inside. Only one of the two is mounted, so
                        name="max_acordado" posts once. */}
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
                          setAcordado(String(arsToBaseJus(acordadoRaw, jusValue)));
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
                          setAcordado(String(baseJusToArs(acordadoRaw, jusValue)));
                        setUnidad("ars");
                      }}
                    >
                      ARS
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground tabular-nums">
                  {/* A JUS entry is a shortcut for typing pesos, so the peso
                      figure that will actually be stored is the one echoed back. */}
                  {unidad === "jus" && `≈ ${formatArs(acordadoArs ?? 0)} · `}
                  {diffArs === 0
                    ? "igual al tope legal"
                    : `${formatArs(Math.abs(diffArs))} ${diffArs < 0 ? "menos" : "más"} que el tope legal`}
                </p>
              </>
            )}

            <div className="flex items-baseline justify-between border-t pt-3">
              <span className="text-xs uppercase text-muted-foreground">
                Máximo a cobrar
              </span>
              <span className="text-right tabular-nums">
                {/* Pesos, to the centavo, whichever ceiling applies: an agreed
                    figure is exact by definition and the legal one is the fee
                    plus the tax the juzgado withholds. The card prints the same
                    number, and neither is a number of JUS anybody perceives. */}
                <span className="text-base font-bold">
                  {formatArsExacto(
                    techo.tipo === "acordado" ? techo.capArs : compArs.total,
                  )}
                </span>
                {techo.tipo === "legal" && (
                  <span className="block text-xs text-muted-foreground">
                    IVA y aportes incluidos
                  </span>
                )}
              </span>
            </div>
          </div>

          {quedaCorto && (
            <Alert variant="destructive">
              <AlertDescription>
                Ya se cobraron {formatArs(pagadoArs)}, más que este máximo.
              </AlertDescription>
            </Alert>
          )}

          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="honorario-monto"
            size="sm"
            disabled={quedaCorto || pending}
          >
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
