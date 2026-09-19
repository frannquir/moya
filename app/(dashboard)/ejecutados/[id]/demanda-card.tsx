"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelConInfo } from "@/components/label-info";
import { DateField } from "@/components/date-field";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type FaltanteEscrito } from "./escritos-actions";
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
 * Shown only when origen = 'demanda'. Surfaces exactly the fields the rest of the
 * detail page does not.
 */
export function DemandaCard({
  initial,
  updateAction,
  regenerarAction,
  revisarAction,
  ultimaDemanda,
  avisos = [],
  juezRecusado = "",
  tieneJuzgado = false,
  isHead = false,
}: {
  initial: DemandadoExtraFields;
  updateAction: Action;
  /** "Generar de nuevo": recomposes section VII from the current party list. */
  regenerarAction: Action;
  /**
   * Renders the demanda without writing it and returns what it would print as a
   * [MARCADOR]. Runs on click, never on mount — this is the heaviest page in the
   * app and the answer is only needed when somebody is about to generate.
   */
  revisarAction: () => Promise<FaltanteEscrito[]>;
  /** The most recent generated demanda, if there is one. */
  ultimaDemanda?: { id: string; contenido: string } | null;
  /** Parties missing a CUIL or a domicilio — they render as holes in section VII. */
  avisos?: string[];
  /**
   * The judge this case's court is recused before, or "" when the court is not on
   * the estudio's list. Empty is a deliberate "no recusación", not missing data —
   * the section is simply omitted and the numbering closes over it.
   */
  juezRecusado?: string;
  /** False when the case has no court linked, so recusación cannot be decided. */
  tieneJuzgado?: boolean;
  /** Members cannot edit estudio config; they get told who can instead. */
  isHead?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [extra, setExtra] = useState<DemandadoExtraFields>(initial);

  // The pre-generation check. `null` = no dialog; a list = the dialog is open,
  // and it is always non-empty because an empty answer generates straight away.
  const [faltantes, setFaltantes] = useState<FaltanteEscrito[] | null>(null);
  const [revisando, startRevision] = useTransition();
  const generarRef = useRef<HTMLFormElement>(null);

  const revisarYGenerar = () => {
    startRevision(async () => {
      const gaps = await revisarAction();
      if (gaps.length === 0) generarRef.current?.requestSubmit();
      else setFaltantes(gaps);
    });
  };

  const generarIgual = () => {
    setFaltantes(null);
    generarRef.current?.requestSubmit();
  };

  const handleCopy = async () => {
    if (!ultimaDemanda) return;
    try {
      await navigator.clipboard.writeText(ultimaDemanda.contenido);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is unavailable (insecure origin, permissions). The escrito
      // page has a textarea the lawyer can select by hand.
    }
  };

  const set = <K extends keyof DemandadoExtraFields>(
    key: K,
    value: DemandadoExtraFields[K],
  ) => setExtra((x) => ({ ...x, [key]: value }));

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span>Demanda</span>
          <Badge variant="outline" className="border-primary/50">
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

        <div className="grid gap-4 sm:grid-cols-3">
          <Dato
            label="Fojas de resúmenes de cuenta"
            value={
              initial.fojas_resumenes !== null ? `${initial.fojas_resumenes} fs.` : ""
            }
          />
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

        <Separator />

        {/* Section XII is printed only when the case's court is on the estudio's
            recusados list. Saying so here is the whole point: a section that is
            silently absent is indistinguishable from one somebody forgot. */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Recusación sin expresión de causa
          </p>
          {!tieneJuzgado ? (
            <p className="text-sm">
              El caso no tiene juzgado cargado, así que la demanda no puede incluir
              la recusación.
            </p>
          ) : juezRecusado !== "" ? (
            <p className="text-sm">
              Se recusa a <span className="font-medium">{juezRecusado}</span>.
            </p>
          ) : (
            <p className="text-sm">
              Este juzgado no está en la lista de jueces recusados, así que la
              demanda no incluye ese apartado.
            </p>
          )}
          {isHead ? (
            <Link
              href="/estudio"
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              Editar jueces recusados
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">
              La lista la carga el dueño del estudio.
            </span>
          )}
        </div>

        {avisos.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              <p className="font-medium">
                La medida cautelar va a salir incompleta.
              </p>
              <p className="text-sm">
                Falta{avisos.length > 1 ? "n" : ""} {avisos.join("; ")}. El escrito
                imprime esos datos para cada parte y, sin ellos, queda un hueco
                marcado en el apartado VII.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* The form is what generates; the button asks first. Kept as a form
              so generation still goes through the server action that redirects
              to the new escrito, exactly as before. */}
          <form action={regenerarAction} ref={generarRef}>
            <Button
              type="button"
              size="sm"
              disabled={revisando}
              onClick={revisarYGenerar}
            >
              {revisando ? "Revisando…" : "Generar de nuevo"}
            </Button>
          </form>
          {ultimaDemanda ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button type="button" size="sm" variant="ghost" asChild>
                <Link href={`/escritos/${ultimaDemanda.id}`}>Ver escrito</Link>
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Todavía no se generó el documento.
            </span>
          )}
        </div>

        {/* Un Dialog y no window.confirm: hay que poder leer la lista y tocar
            el link que lleva al campo que falta. */}
        <Dialog
          open={faltantes !== null}
          onOpenChange={(abierto) => !abierto && setFaltantes(null)}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                La demanda va a salir con{" "}
                {faltantes?.length === 1 ? "un dato" : `${faltantes?.length ?? 0} datos`}{" "}
                sin completar
              </DialogTitle>
              <DialogDescription>
                Se imprimen entre corchetes, tal cual, en el escrito.
              </DialogDescription>
            </DialogHeader>

            <ul className="space-y-2 text-sm">
              {(faltantes ?? []).map((f) => (
                <li key={f.label} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{f.label}</span>
                  {f.href ? (
                    <Link
                      href={f.href}
                      className="text-xs underline underline-offset-2"
                    >
                      {f.donde === "caso" ? "Cargar en el caso" : "Cargar en el estudio"}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {f.donde === "estudio"
                        ? "Lo carga el dueño del estudio"
                        : "No se puede cargar desde acá"}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFaltantes(null)}
              >
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={generarIgual}>
                Generar igual
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                  <DateField
                    id="dc-fecha_contrato"
                    name="fecha_contrato"
                    value={extra.fecha_contrato ?? ""}
                    onValueChange={(iso) => set("fecha_contrato", iso || null)}
                  />
                </div>
                <div className="space-y-2">
                  <LabelConInfo htmlFor="dc-cuenta_cliper" campo="cuenta_cliper">Cuenta Cliper</LabelConInfo>
                  <Input
                    id="dc-cuenta_cliper"
                    name="cuenta_cliper"
                    value={extra.cuenta_cliper}
                    onChange={(e) => set("cuenta_cliper", onlyDigits(e.target.value))}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <LabelConInfo htmlFor="dc-tarjeta_cabal" campo="tarjeta_cabal">Tarjeta Cabal</LabelConInfo>
                  <Input
                    id="dc-tarjeta_cabal"
                    name="tarjeta_cabal"
                    value={extra.tarjeta_cabal}
                    onChange={(e) => set("tarjeta_cabal", onlyDigits(e.target.value))}
                    inputMode="numeric"
                  />
                </div>
                {/* Editable here as well as on the create form: "Generar de
                    nuevo" recomposes the DOCUMENTAL block from current data, so
                    the count has to be correctable after the case exists. */}
                <div className="space-y-2">
                  <LabelConInfo htmlFor="dc-fojas_resumenes" campo="fojas_resumenes">Fojas de resúmenes</LabelConInfo>
                  <Input
                    id="dc-fojas_resumenes"
                    name="fojas_resumenes"
                    type="number"
                    min={1}
                    max={30}
                    value={extra.fojas_resumenes ?? ""}
                    onChange={(e) =>
                      set(
                        "fojas_resumenes",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
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
