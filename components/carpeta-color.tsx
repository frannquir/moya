import { cn } from "@/lib/utils";
import { carpetaColorOf } from "@/lib/domain/carpetas";
import { Users } from "lucide-react";

/**
 * A folder's colour, in the two shapes it takes: a dot, and the tint of a
 * selected chip. The stored value is a palette key (lib/domain/carpetas.ts);
 * the colour is a --carpeta-* token, with its own dark-mode value.
 *
 * Two callers (the /ejecutados board and the detail page), hence components/.
 * No "use client": no state, so server components render it directly.
 */

// Full class strings, never interpolated: Tailwind scans source text, so a
// class name assembled at runtime from the key would compile to nothing.
const DOT = {
  gris: "bg-carpeta-gris",
  azul: "bg-carpeta-azul",
  turquesa: "bg-carpeta-turquesa",
  verde: "bg-carpeta-verde",
  ambar: "bg-carpeta-ambar",
  naranja: "bg-carpeta-naranja",
  rojo: "bg-carpeta-rojo",
  violeta: "bg-carpeta-violeta",
} as const;

const ACTIVA = {
  gris: "border-carpeta-gris/70 bg-carpeta-gris/15",
  azul: "border-carpeta-azul/70 bg-carpeta-azul/15",
  turquesa: "border-carpeta-turquesa/70 bg-carpeta-turquesa/15",
  verde: "border-carpeta-verde/70 bg-carpeta-verde/15",
  ambar: "border-carpeta-ambar/70 bg-carpeta-ambar/20",
  naranja: "border-carpeta-naranja/70 bg-carpeta-naranja/15",
  rojo: "border-carpeta-rojo/70 bg-carpeta-rojo/15",
  violeta: "border-carpeta-violeta/70 bg-carpeta-violeta/15",
} as const;

export function CarpetaDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", DOT[carpetaColorOf(color)], className)}
    />
  );
}

/** Border and tint of a selected folder chip, in the folder's own hue. */
export function carpetaActivaClass(color: string): string {
  return ACTIVA[carpetaColorOf(color)];
}

/** A folder named inline: the dot, the name, and a mark if it is shared. */
export function CarpetaEtiqueta({
  nombre,
  color,
  compartida = false,
  className,
}: {
  nombre: string;
  color: string;
  /** Shared with me by someone else, or shared by me: either way, not private. */
  compartida?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs",
        className,
      )}
    >
      <CarpetaDot color={color} className="size-2" />
      <span className="truncate">{nombre}</span>
      {compartida && <Users className="size-3 shrink-0 text-muted-foreground" aria-label="Compartida" />}
    </span>
  );
}
