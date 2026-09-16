"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { destinoDe, hrefDe } from "@/lib/domain/token-destino";
import { extractUnresolved } from "@/lib/domain/template-engine";
import { type EscritoState, type RestaurarResult } from "./actions";

/**
 * One entry per distinct label, keeping the first token that carries it. Every
 * badge links to the same place a duplicate would, so dropping the duplicate
 * loses nothing.
 */
function dedupePorLabel(tokens: string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const clave = destinoDe(t)?.label ?? t;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(t);
  }
  return out;
}

export function EscritoEditor({
  ejecutadoId = null,
  isHead = false,
  initialTitulo,
  initialContenido,
  saveAction,
  restaurarAction,
  puedeRestaurar,
}: {
  /** For linking a per-case gap straight to the field that fixes it. */
  ejecutadoId?: string | null;
  isHead?: boolean;
  initialTitulo: string;
  initialContenido: string;
  saveAction: (prev: EscritoState, formData: FormData) => Promise<EscritoState>;
  restaurarAction: () => Promise<RestaurarResult>;
  /** false when template_id is NULL: there is nothing to re-render from. */
  puedeRestaurar: boolean;
}) {
  const [titulo, setTitulo] = useState(initialTitulo);
  const [contenido, setContenido] = useState(initialContenido);
  const [copied, setCopied] = useState(false);

  // Errors are RETURNED by the action and shown here. Before this the form just
  // posted and the page looked identical either way — and because `contenido`
  // is controlled state, React kept showing what the user typed whether or not
  // a single byte reached the database.
  const [state, formAction, guardando] = useActionState<EscritoState, FormData>(
    saveAction,
    null,
  );

  const [confirmando, setConfirmando] = useState(false);
  const [restaurando, startRestaurar] = useTransition();
  const [restauracion, setRestauracion] = useState<RestaurarResult | null>(null);

  // Which action ran last. `state` from useActionState outlives later actions,
  // so without this an old save error kept showing after a successful restore
  // and hid the restore's own confirmation.
  const [ultima, setUltima] = useState<"guardar" | "restaurar" | null>(null);

  // What the last submit actually sent. "Escrito guardado." is only true while
  // the fields still hold exactly that — otherwise the alert kept vouching for
  // text typed after the save, which is the very confusion this editor exists
  // to remove.
  const [enviado, setEnviado] = useState<{ titulo: string; contenido: string } | null>(
    null,
  );

  // Collapsed by LABEL, not by token: ABOGADO_CUIT and ABOGADO_DNI both go
  // missing the moment the encargado has no CUIT, and two identical badges read
  // as two separate problems.
  const pending = dedupePorLabel(extractUnresolved(contenido));

  const error =
    ultima === "guardar" && state !== null && "error" in state
      ? state.error
      : ultima === "restaurar" && restauracion !== null && "error" in restauracion
        ? restauracion.error
        : null;
  const guardado =
    ultima === "guardar" &&
    !guardando &&
    state !== null &&
    "ok" in state &&
    enviado !== null &&
    enviado.titulo === titulo &&
    enviado.contenido === contenido;
  // Same rule for the restore: the confirmation goes away once the text moves.
  const restaurado =
    ultima === "restaurar" &&
    restauracion !== null &&
    "contenido" in restauracion &&
    restauracion.contenido === contenido;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contenido);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.getElementById("contenido") as HTMLTextAreaElement | null;
      ta?.select();
    }
  };

  // The action hands the re-rendered text back and the editor adopts it, rather
  // than relying on revalidatePath: React does not reset useState when a prop
  // changes, so a restore that only refreshed the server tree would leave the
  // textarea showing the old edited text over a database that no longer has it.
  const handleRestaurar = () =>
    startRestaurar(async () => {
      setUltima("restaurar");
      const resultado = await restaurarAction();
      setRestauracion(resultado);
      if ("contenido" in resultado) setContenido(resultado.contenido);
      setConfirmando(false);
    });

  return (
    <form
      action={formAction}
      onSubmit={() => {
        setUltima("guardar");
        setEnviado({ titulo, contenido });
        setRestauracion(null);
      }}
      className="space-y-4"
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {guardado && (
        <Alert>
          <AlertDescription>Escrito guardado.</AlertDescription>
        </Alert>
      )}

      {restaurado && (
        <Alert>
          <AlertDescription>
            Texto restaurado desde la plantilla. El título no cambió.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input
          id="titulo"
          name="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>

      {pending.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <div className="mb-1 font-medium">
            Faltan completar {pending.length} dato(s) antes de presentar:
          </div>
          {/* The encabezado no longer invents a plausible value for an
              unconfigured encargado, so these badges are the only thing standing
              between an empty config and a filed document. */}
          {/* Each gap links to the screen that fixes it. Printing the raw token
              name was the single most common false "bug" in Week 2 testing — it
              read as broken software rather than as unfilled config. */}
          <ul className="flex flex-wrap gap-1.5">
            {pending.map((p) => {
              const destino = destinoDe(p);
              const href = destino ? hrefDe(destino, { ejecutadoId, isHead }) : null;
              const label = destino?.label ?? p;

              if (href) {
                return (
                  <li key={p}>
                    <Badge variant="outline" asChild>
                      <Link href={href} className="hover:bg-warning/20">
                        {label} →
                      </Link>
                    </Badge>
                  </li>
                );
              }
              return (
                <li key={p}>
                  <Badge variant="outline">
                    {label}
                    {/* A member cannot edit escritos_config, so sending them to
                        /estudio would only show them a refusal. */}
                    {destino?.donde === "estudio" && " · lo carga el dueño del estudio"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="contenido">Contenido</Label>
        <Textarea
          id="contenido"
          name="contenido"
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          rows={24}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="outline" onClick={handleCopy}>
          {copied ? "Copiado" : "Copiar texto"}
        </Button>
        {/* Destructive, so it asks first — but never with window.confirm, which
            blocks the whole browser. Disabled instead of hidden when there is no
            template, with the reason in the title. */}
        <Button
          type="button"
          variant="outline"
          disabled={!puedeRestaurar || restaurando}
          title={
            puedeRestaurar
              ? undefined
              : "Este escrito no tiene plantilla asociada."
          }
          onClick={() => setConfirmando(true)}
        >
          {restaurando ? "Restaurando…" : "Restaurar original"}
        </Button>
      </div>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar el texto original</DialogTitle>
            <DialogDescription>
              Se reemplaza todo el contenido por el de la plantilla y se pierden
              los cambios que hayas hecho. El título no cambia.
            </DialogDescription>
          </DialogHeader>
          {/* Said out loud because a lawyer who expects a byte-for-byte undo and
              gets a different document will report it as a bug. */}
          <p className="text-sm text-muted-foreground">
            Se genera con los datos de hoy, así que puede no ser idéntico al
            texto original si desde entonces cambiaron el caso o la configuración
            del estudio.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleRestaurar} disabled={restaurando}>
              {restaurando ? "Restaurando…" : "Restaurar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
