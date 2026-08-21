"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CuilInput } from "@/components/cuil-input";
import { onlyDigits, type DemandadoExtraFields } from "@/lib/domain/demanda";
import { formatArDate } from "@/lib/domain/dates";

type Action = (formData: FormData) => void | Promise<void>;

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value !== "" ? value : "—"}</p>
    </div>
  );
}

/**
 * The "Demanda" card - Fran's blue Demanda sign. Shown only when
 * origen = 'demanda', and it surfaces exactly the fields the rest of the detail
 * page does not display.
 */
export function DemandaCard({
  initial,
  updateAction,
}: {
  initial: DemandadoExtraFields;
  updateAction: Action;
}) {
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState<DemandadoExtraFields>(initial);

  const set = <K extends keyof DemandadoExtraFields>(
    key: K,
    value: DemandadoExtraFields[K],
  ) => setExtra((x) => ({ ...x, [key]: value }));

  return (
    <Card className="border-blue-500/40 bg-blue-500/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span>Demanda</span>
          <Badge variant="outline" className="border-blue-500/50">
            Iniciada desde Moya
          </Badge>
        </CardTitle>
        <CardDescription>
          Datos del contrato y de la relación laboral que usa la medida cautelar.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Dato
            label="Fecha del contrato"
            value={initial.fecha_contrato ? formatArDate(initial.fecha_contrato) : ""}
          />
          <Dato label="Cuenta Cliper" value={initial.cuenta_cliper} />
          <Dato label="Tarjeta Cabal" value={initial.tarjeta_cabal} />
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Badge variant={initial.trabaja ? "default" : "secondary"}>
            {initial.trabaja ? "Trabaja" : "No trabaja"}
          </Badge>
          {initial.trabaja && (
            <span className="text-sm text-muted-foreground">
              {initial.empleador_nombre !== ""
                ? initial.empleador_nombre
                : "Empleador sin cargar"}
            </span>
          )}
        </div>

        {initial.trabaja && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Dato label="CUIT del empleador" value={initial.empleador_cuit} />
            <Dato label="Domicilio del empleador" value={initial.empleador_domicilio} />
            <Dato label="Teléfono del empleador" value={initial.empleador_telefono} />
          </div>
        )}

        {/* HANDOFF 2B: "Copiar" and "Generar de nuevo" for the generated demanda
            escrito land here. 2A deliberately does not build them. */}

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              {open ? "Cerrar" : "Editar datos de la demanda"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <form action={updateAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="dc-fecha_contrato">Fecha del contrato</Label>
                  <Input
                    id="dc-fecha_contrato"
                    name="fecha_contrato"
                    type="date"
                    value={extra.fecha_contrato ?? ""}
                    onChange={(e) => set("fecha_contrato", e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dc-cuenta_cliper">Cuenta Cliper</Label>
                  <Input
                    id="dc-cuenta_cliper"
                    name="cuenta_cliper"
                    value={extra.cuenta_cliper}
                    onChange={(e) => set("cuenta_cliper", onlyDigits(e.target.value))}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dc-tarjeta_cabal">Tarjeta Cabal</Label>
                  <Input
                    id="dc-tarjeta_cabal"
                    name="tarjeta_cabal"
                    value={extra.tarjeta_cabal}
                    onChange={(e) => set("tarjeta_cabal", onlyDigits(e.target.value))}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-md border bg-background p-3">
                <Switch
                  id="dc-trabaja"
                  checked={extra.trabaja}
                  onCheckedChange={(checked) => set("trabaja", checked === true)}
                />
                <Label htmlFor="dc-trabaja" className="cursor-pointer">
                  Trabaja en relación de dependencia
                </Label>
                <input type="hidden" name="trabaja" value={extra.trabaja ? "true" : "false"} />
              </div>

              {extra.trabaja && (
                <div className="space-y-4 rounded-md border border-dashed bg-background p-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dc-empleador_nombre">Empleador *</Label>
                      <Input
                        id="dc-empleador_nombre"
                        name="empleador_nombre"
                        value={extra.empleador_nombre}
                        onChange={(e) => set("empleador_nombre", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dc-empleador_cuit">CUIT del empleador *</Label>
                      <CuilInput
                        id="dc-empleador_cuit"
                        name="empleador_cuit"
                        value={extra.empleador_cuit}
                        onValueChange={(next) => set("empleador_cuit", next)}
                        placeholder="30-70123456-8"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dc-empleador_domicilio">Domicilio del empleador</Label>
                      <Input
                        id="dc-empleador_domicilio"
                        name="empleador_domicilio"
                        value={extra.empleador_domicilio}
                        onChange={(e) => set("empleador_domicilio", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dc-empleador_telefono">Teléfono del empleador</Label>
                      <Input
                        id="dc-empleador_telefono"
                        name="empleador_telefono"
                        value={extra.empleador_telefono}
                        onChange={(e) => set("empleador_telefono", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" size="sm">
                Guardar
              </Button>
            </form>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
