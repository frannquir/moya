"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { destinoDe, hrefDe } from "@/lib/domain/token-destino";
import { extractUnresolved } from "@/lib/domain/template-engine";

export function EscritoEditor({
  ejecutadoId = null,
  isHead = false,
  initialTitulo,
  initialContenido,
  saveAction,
}: {
  /** For linking a per-case gap straight to the field that fixes it. */
  ejecutadoId?: string | null;
  isHead?: boolean;
  initialTitulo: string;
  initialContenido: string;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState(initialTitulo);
  const [contenido, setContenido] = useState(initialContenido);
  const [copied, setCopied] = useState(false);

  const pending = extractUnresolved(contenido);

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

  return (
    <form action={saveAction} className="space-y-4">
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

      <div className="flex items-center gap-2">
        <Button type="submit">Guardar</Button>
        <Button type="button" variant="outline" onClick={handleCopy}>
          {copied ? "Copiado" : "Copiar texto"}
        </Button>
      </div>
    </form>
  );
}
