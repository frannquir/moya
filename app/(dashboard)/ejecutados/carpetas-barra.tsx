"use client";

import { FolderPlus, Settings2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CarpetaDot, carpetaActivaClass } from "@/components/carpeta-color";
import { cn } from "@/lib/utils";
import { type CarpetaVista } from "@/lib/data/carpetas";

/**
 * The folder filter above the list: one chip for the default scope, then the
 * user's folders in their own order, then the ones shared with them. It rides
 * the URL (?carpeta=) the way ?via= does.
 *
 * With no folders it says what a folder is and offers to make one. It never
 * suggests a name: the names in the original request were examples of the
 * idea, not content.
 */
export function CarpetasBarra({
  carpetas,
  seleccionada,
  onSeleccionar,
  etiquetaTodos,
  currentUserId,
  onGestionar,
}: {
  /** In display order. */
  carpetas: CarpetaVista[];
  seleccionada: string;
  onSeleccionar: (id: string) => void;
  /** What the list shows with no folder picked ("Mis casos", "Todo el estudio"). */
  etiquetaTodos: string;
  currentUserId: string;
  onGestionar: () => void;
}) {
  if (carpetas.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed px-3 py-2">
        <p className="text-sm text-muted-foreground">
          Agrupá ejecutados en carpetas con el nombre que quieras.
        </p>
        <Button variant="outline" size="sm" onClick={onGestionar}>
          <FolderPlus />
          Nueva carpeta
        </Button>
      </div>
    );
  }

  return (
    <div role="group" aria-label="Carpetas" className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        aria-pressed={seleccionada === ""}
        onClick={() => onSeleccionar("")}
        className={cn(
          "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          seleccionada === "" ? "border-foreground/30 bg-muted font-medium" : "bg-card hover:bg-muted",
        )}
      >
        {etiquetaTodos}
      </button>

      {carpetas.map((c) => {
        const activa = seleccionada === c.id;
        const ajena = c.created_by_user_id !== currentUserId;
        const compartida = ajena || c.shares.length > 0;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={activa}
            onClick={() => onSeleccionar(activa ? "" : c.id)}
            title={ajena ? "Compartida con vos" : compartida ? "Compartida" : undefined}
            className={cn(
              "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              activa ? cn(carpetaActivaClass(c.color), "font-medium") : "bg-card hover:bg-muted",
            )}
          >
            <CarpetaDot color={c.color} />
            <span className="max-w-48 truncate">{c.nombre}</span>
            <span className="tabular-nums text-muted-foreground">{c.activos}</span>
            {compartida && <Users className="size-3.5 text-muted-foreground" aria-label="Compartida" />}
          </button>
        );
      })}

      <Button variant="ghost" size="sm" onClick={onGestionar} className="text-muted-foreground">
        <Settings2 />
        Carpetas
      </Button>
    </div>
  );
}
