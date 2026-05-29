"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { extractUnresolved } from "@/lib/domain/template-engine";

export function EscritoEditor({
  initialTitulo,
  initialContenido,
  saveAction,
}: {
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
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <div className="mb-1 font-medium">
            Faltan completar {pending.length} dato(s) antes de presentar:
          </div>
          <div className="flex flex-wrap gap-1">
            {pending.map((p) => (
              <Badge key={p} variant="outline">
                {p}
              </Badge>
            ))}
          </div>
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
