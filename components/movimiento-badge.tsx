import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { etapaDe, type Etapa } from "@/lib/domain/ejecutado";

/**
 * The etapa a case sits on, as a solid pill.
 *
 * One component rather than a `variant="outline"` badge at each call site: the
 * stage is rendered in the list, the detail header, borradores and the
 * estadísticas carousel, and four hand-rolled badges is four chances for them to
 * disagree about what "En Cobro" looks like.
 *
 * No "use client" — it holds no state, so the server components that render most
 * of these lists can use it directly.
 */

// Full class strings, never interpolated: Tailwind scans source text, so a
// `bg-mov-${etapa}` built at runtime would compile to nothing.
const PILL: Record<Etapa, string> = {
  inicio: "bg-mov-inicio text-mov-inicio-foreground",
  cedula: "bg-mov-cedula text-mov-cedula-foreground",
  mandamiento: "bg-mov-mandamiento text-mov-mandamiento-foreground",
  sentencia: "bg-mov-sentencia text-mov-sentencia-foreground",
  cobro: "bg-mov-cobro text-mov-cobro-foreground",
};

/**
 * The row wash behind a case, in the same hue as its pill at a fraction of the
 * alpha. Dark mode carries more, because a translucent light colour over a dark
 * surface lifts less than a translucent dark one over white.
 *
 * The hover step is deliberately the same hue rather than the table's default
 * `hover:bg-muted/50`: hovering a red row should not turn it grey. `cn()` merges
 * these last, so the default drops out.
 */
const ROW: Record<Etapa, string> = {
  inicio: "bg-mov-inicio/7 hover:bg-mov-inicio/15 dark:bg-mov-inicio/12 dark:hover:bg-mov-inicio/20",
  cedula: "bg-mov-cedula/10 hover:bg-mov-cedula/20 dark:bg-mov-cedula/12 dark:hover:bg-mov-cedula/20",
  mandamiento:
    "bg-mov-mandamiento/10 hover:bg-mov-mandamiento/20 dark:bg-mov-mandamiento/12 dark:hover:bg-mov-mandamiento/20",
  sentencia:
    "bg-mov-sentencia/8 hover:bg-mov-sentencia/16 dark:bg-mov-sentencia/14 dark:hover:bg-mov-sentencia/22",
  cobro: "bg-mov-cobro/8 hover:bg-mov-cobro/16 dark:bg-mov-cobro/14 dark:hover:bg-mov-cobro/22",
};

/** Row tint for a stored movimiento. Empty for a case with no stage. */
export function etapaRowClass(movimiento: string | null | undefined): string {
  const etapa = etapaDe(movimiento);
  return etapa ? ROW[etapa] : "";
}

export function MovimientoBadge({
  movimiento,
  diligenciada,
  className,
}: {
  movimiento: string | null | undefined;
  /**
   * Whether the stage came back. Stage and outcome are one fact — read apart,
   * "diligenciada" is a checkbox nobody connects to the stage above it. Omit it
   * (the list does) to render the stage alone.
   */
  diligenciada?: boolean | null;
  className?: string;
}) {
  const etapa = etapaDe(movimiento);

  // An unrecognised value still renders, uncoloured: dropping it would hide a
  // stage the migration left behind rather than surface it.
  if (!etapa) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        {movimiento || "Sin movimiento"}
      </Badge>
    );
  }

  return (
    <Badge className={cn(PILL[etapa], className)}>
      {movimiento}
      {diligenciada === true && " · diligenciada"}
      {diligenciada === false && " · sin diligenciar"}
    </Badge>
  );
}
