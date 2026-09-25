"use client";

import { useOptimistic, useTransition } from "react";
import { Folder, FolderPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CarpetaDot } from "@/components/carpeta-color";
import { type CarpetaVista } from "@/lib/data/carpetas";
import { ponerEnCarpetaAction } from "./carpetas-actions";

/**
 * Which folders one case is in, and the control to change it. A case can sit
 * in several folders, so this is a checkbox menu, not a Select. It stays open
 * between ticks.
 *
 * Only the user's own folders can be ticked. A folder shared with them shows
 * as checked or not but is locked: filing into someone else's folder is the
 * owner's call (RLS enforces the same).
 *
 * `onCambio` refreshes the caller's data (the board invalidates its queries,
 * the detail page refreshes the route). It runs inside the transition, so the
 * optimistic tick holds until the fresh data arrives, with no flicker back.
 */
export function CarpetasMenu({
  ejecutadoId,
  carpetas,
  vinculadas,
  currentUserId,
  onCambio,
  onNueva,
  variante = "icono",
}: {
  ejecutadoId: string;
  /** Every folder the user can see, already in display order. */
  carpetas: CarpetaVista[];
  /** The folders this case is filed in. */
  vinculadas: string[];
  currentUserId: string;
  onCambio?: () => Promise<unknown> | void;
  /** Opens the folder manager on "Nueva carpeta". Omitted, the item is not shown. */
  onNueva?: () => void;
  variante?: "icono" | "boton";
}) {
  const [, startTransition] = useTransition();
  const [marcadas, marcar] = useOptimistic(
    vinculadas,
    (actual: string[], cambio: { id: string; poner: boolean }) =>
      cambio.poner ? [...actual, cambio.id] : actual.filter((id) => id !== cambio.id),
  );

  const propias = carpetas.filter((c) => c.created_by_user_id === currentUserId);
  const compartidas = carpetas.filter(
    (c) => c.created_by_user_id !== currentUserId && marcadas.includes(c.id),
  );

  function alternar(carpetaId: string, poner: boolean) {
    startTransition(async () => {
      marcar({ id: carpetaId, poner });
      const r = await ponerEnCarpetaAction(carpetaId, ejecutadoId, poner);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      await onCambio?.();
    });
  }

  const cantidad = marcadas.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variante === "icono" ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              cantidad === 0
                ? "Agregar a una carpeta"
                : cantidad === 1
                  ? "En 1 carpeta. Cambiar"
                  : `En ${cantidad} carpetas. Cambiar`
            }
            title="Carpetas"
            className="text-muted-foreground"
          >
            {cantidad > 0 ? <Folder /> : <FolderPlus />}
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Folder />
            Carpetas
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Carpetas</DropdownMenuLabel>
        {propias.length === 0 ? (
          <DropdownMenuItem disabled>Todavía no tenés carpetas.</DropdownMenuItem>
        ) : (
          propias.map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={marcadas.includes(c.id)}
              // Keep the menu open: a case often goes into more than one.
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(v) => alternar(c.id, v === true)}
            >
              <CarpetaDot color={c.color} />
              <span className="truncate">{c.nombre}</span>
            </DropdownMenuCheckboxItem>
          ))
        )}
        {compartidas.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Compartidas con vos
            </DropdownMenuLabel>
            {compartidas.map((c) => (
              <DropdownMenuCheckboxItem key={c.id} checked disabled>
                <CarpetaDot color={c.color} />
                <span className="truncate">{c.nombre}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
        {onNueva && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onNueva}>
              <FolderPlus />
              Nueva carpeta
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
