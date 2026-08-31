import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MEDIDA_CAUTELAR_OPTIONS } from "@/lib/domain/ejecutado";

const LABEL: Record<string, string> = Object.fromEntries(
  MEDIDA_CAUTELAR_OPTIONS.map((o) => [o.value, o.label]),
);

/**
 * The medida cautelar and how far it has got.
 *
 * Solicitada/Proveída take the same amber/green pair Cobros already uses for
 * Solicitado/Proveído — the same two words in the same two states should not
 * look different in two places. Green here is the request being granted, which
 * is what puts money in the account; it does not stretch the "green means money"
 * rule so much as sit at its head.
 */
export function CautelarBadge({
  medida,
  estado,
  diligenciada,
  className,
}: {
  medida: string | null | undefined;
  estado: string | null | undefined;
  /** Whether the measure came back served. Only ever shown once granted. */
  diligenciada?: boolean | null;
  className?: string;
}) {
  // No measure is not a state worth a badge — the case simply has none.
  if (!medida) return null;

  const proveida = estado === "Proveída";
  const nombre = LABEL[medida] ?? medida;

  return (
    <Badge
      variant={proveida ? "success" : estado ? "warning" : "outline"}
      className={cn("gap-1", className)}
    >
      {nombre}
      {estado ? ` · ${estado}` : ""}
      {/* The tick is the "and it came back" half, and only means anything on a
          measure the court already granted. */}
      {proveida && diligenciada === true && (
        <Check aria-label="diligenciada" className="size-3" />
      )}
    </Badge>
  );
}
