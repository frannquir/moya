"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Archive, ChevronDown, ChevronUp, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CarpetaDot, CarpetaEtiqueta } from "@/components/carpeta-color";
import { cn } from "@/lib/utils";
import { type CarpetaVista } from "@/lib/data/carpetas";
import {
  CARPETA_COLORES,
  CARPETA_COLOR_DEFAULT,
  CARPETA_COLOR_LABEL,
  CARPETA_NOMBRE_MAX,
  carpetaColorOf,
  textoCompartir,
  type CarpetaColor,
} from "@/lib/domain/carpetas";
import {
  archivarCarpetaAction,
  compartirCarpetaAction,
  crearCarpetaAction,
  dejarDeCompartirAction,
  moverCarpetaAction,
  recolorearCarpetaAction,
  renombrarCarpetaAction,
  type CarpetaResult,
} from "./carpetas-actions";

export type MiembroCarpeta = {
  user_id: string;
  nombre: string;
  email: string;
  role: string;
};

export function nombreDeMiembro(
  members: MiembroCarpeta[],
  userId: string | null,
): string | null {
  const m = members.find((x) => x.user_id === userId);
  if (!m) return null;
  return m.nombre?.trim() ? m.nombre : m.email;
}

/**
 * Everything about the folders themselves: create, rename, recolour, reorder,
 * archive and, for the head, share. Filing cases into them happens elsewhere
 * (CarpetasMenu, on each row and on the detail page).
 *
 * Reordering is up/down buttons: dragging would be nicer and would bring a new
 * dependency for five folders.
 *
 * Layout inside is container queries (gotcha #43): each row stacks in a narrow
 * dialog and lays out in one line once there is room.
 */
export function CarpetasDialog({
  open,
  onOpenChange,
  carpetas,
  currentUserId,
  isHead,
  members,
  onCambio,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every folder the user can see, in display order. */
  carpetas: CarpetaVista[];
  currentUserId: string;
  isHead: boolean;
  members: MiembroCarpeta[];
  onCambio?: () => Promise<unknown> | void;
}) {
  const [pending, startTransition] = useTransition();
  const propias = carpetas.filter((c) => c.created_by_user_id === currentUserId);
  const compartidas = carpetas.filter((c) => c.created_by_user_id !== currentUserId);

  /** Runs an action, reports its error, and refreshes the caller on success. */
  function correr(accion: () => Promise<CarpetaResult>, onOk?: () => void) {
    startTransition(async () => {
      const r = await accion();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      onOk?.();
      await onCambio?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Carpetas</DialogTitle>
          <DialogDescription>Un ejecutado puede estar en varias.</DialogDescription>
        </DialogHeader>

        <div className="@container space-y-2" aria-busy={pending}>
          {propias.map((c, i) => (
            <CarpetaFila
              key={c.id}
              carpeta={c}
              primera={i === 0}
              ultima={i === propias.length - 1}
              isHead={isHead}
              members={members}
              currentUserId={currentUserId}
              pending={pending}
              correr={correr}
            />
          ))}
        </div>

        {compartidas.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Compartidas con vos</p>
            <ul className="flex flex-wrap gap-1.5">
              {compartidas.map((c) => (
                <li key={c.id} className="min-w-0">
                  <CarpetaEtiqueta
                    nombre={c.nombre}
                    color={c.color}
                    compartida
                    className="text-sm"
                  />
                  <span className="sr-only">
                    , de {nombreDeMiembro(members, c.created_by_user_id) ?? "otro miembro"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <NuevaCarpeta pending={pending} correr={correr} />
      </DialogContent>
    </Dialog>
  );
}

function NuevaCarpeta({
  pending,
  correr,
}: {
  pending: boolean;
  correr: (accion: () => Promise<CarpetaResult>, onOk?: () => void) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState<CarpetaColor>(CARPETA_COLOR_DEFAULT);

  return (
    <form
      className="@container space-y-2 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        correr(
          () => crearCarpetaAction(nombre, color),
          () => {
            setNombre("");
            setColor(CARPETA_COLOR_DEFAULT);
          },
        );
      }}
    >
      <label htmlFor="carpeta-nueva" className="text-sm font-medium">
        Nueva carpeta
      </label>
      <div className="flex flex-col gap-2 @md:flex-row @md:items-center">
        <Input
          id="carpeta-nueva"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={CARPETA_NOMBRE_MAX}
          autoComplete="off"
          className="@md:flex-1"
        />
        <Button type="submit" disabled={pending || nombre.trim() === ""}>
          Crear
        </Button>
      </div>
      <PaletaColores valor={color} onElegir={setColor} />
    </form>
  );
}

function PaletaColores({
  valor,
  onElegir,
}: {
  valor: string;
  onElegir: (c: CarpetaColor) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1.5">
      {CARPETA_COLORES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={valor === c}
          aria-label={CARPETA_COLOR_LABEL[c]}
          title={CARPETA_COLOR_LABEL[c]}
          onClick={() => onElegir(c)}
          className={cn(
            "grid size-8 place-items-center rounded-full border outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            valor === c ? "border-foreground" : "border-transparent hover:border-border",
          )}
        >
          <CarpetaDot color={c} className="size-4" />
        </button>
      ))}
    </div>
  );
}

function CarpetaFila({
  carpeta,
  primera,
  ultima,
  isHead,
  members,
  currentUserId,
  pending,
  correr,
}: {
  carpeta: CarpetaVista;
  primera: boolean;
  ultima: boolean;
  isHead: boolean;
  members: MiembroCarpeta[];
  currentUserId: string;
  pending: boolean;
  correr: (accion: () => Promise<CarpetaResult>, onOk?: () => void) => void;
}) {
  const [nombre, setNombre] = useState(carpeta.nombre);
  const [colorAbierto, setColorAbierto] = useState(false);
  const [compartirAbierto, setCompartirAbierto] = useState(false);
  const [confirmarArchivo, setConfirmarArchivo] = useState(false);
  const compartida = carpeta.shares.length > 0;

  function guardarNombre() {
    if (nombre.trim() === carpeta.nombre) return;
    correr(() => renombrarCarpetaAction(carpeta.id, nombre));
  }

  return (
    <div className="rounded-lg border p-2">
      <div className="flex flex-col gap-2 @md:flex-row @md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Popover open={colorAbierto} onOpenChange={setColorAbierto}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Color: ${CARPETA_COLOR_LABEL[carpetaColorOf(carpeta.color)]}. Cambiar`}
              >
                <CarpetaDot color={carpeta.color} className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto">
              <PaletaColores
                valor={carpeta.color}
                onElegir={(c) =>
                  correr(
                    () => recolorearCarpetaAction(carpeta.id, c),
                    () => setColorAbierto(false),
                  )
                }
              />
            </PopoverContent>
          </Popover>
          <Input
            aria-label="Nombre"
            value={nombre}
            maxLength={CARPETA_NOMBRE_MAX}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardarNombre}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") setNombre(carpeta.nombre);
            }}
            className="h-8 min-w-0 flex-1"
          />
          <span
            className="w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
            title="Ejecutados activos en esta carpeta"
          >
            {carpeta.activos}
          </span>
        </div>

        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Subir"
            disabled={pending || primera}
            onClick={() => correr(() => moverCarpetaAction(carpeta.id, "arriba"))}
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Bajar"
            disabled={pending || ultima}
            onClick={() => correr(() => moverCarpetaAction(carpeta.id, "abajo"))}
          >
            <ChevronDown />
          </Button>
          {isHead && (
            <Button
              variant={compartirAbierto ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label={compartida ? "Compartida. Cambiar" : "Compartir"}
              aria-expanded={compartirAbierto}
              onClick={() => setCompartirAbierto((v) => !v)}
              className={cn(compartida && "text-primary")}
            >
              <Users />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Archivar"
            aria-expanded={confirmarArchivo}
            onClick={() => setConfirmarArchivo((v) => !v)}
          >
            <Archive />
          </Button>
        </div>
      </div>

      {confirmarArchivo && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            {compartida ? "¿Archivar? Deja de estar compartida." : "¿Archivar esta carpeta?"}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setConfirmarArchivo(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => correr(() => archivarCarpetaAction(carpeta.id))}
          >
            Archivar
          </Button>
        </div>
      )}

      {isHead && compartirAbierto && (
        <Compartir
          carpeta={carpeta}
          members={members}
          currentUserId={currentUserId}
          pending={pending}
          correr={correr}
        />
      )}
    </div>
  );
}

/**
 * Head only. Says what sharing hands over before it happens, with the count
 * and the fact that later cases go too, because the effect is otherwise
 * invisible.
 */
function Compartir({
  carpeta,
  members,
  currentUserId,
  pending,
  correr,
}: {
  carpeta: CarpetaVista;
  members: MiembroCarpeta[];
  currentUserId: string;
  pending: boolean;
  correr: (accion: () => Promise<CarpetaResult>, onOk?: () => void) => void;
}) {
  const compartidoCon = new Set(carpeta.shares.map((s) => s.user_id));
  const candidatos = members.filter(
    (m) => m.user_id !== currentUserId && !compartidoCon.has(m.user_id),
  );
  const [elegido, setElegido] = useState("");
  // Falls back to the first candidate when nothing is picked yet, or when the
  // one picked has just been shared and left the list.
  const destino = candidatos.some((m) => m.user_id === elegido)
    ? elegido
    : (candidatos[0]?.user_id ?? "");
  const nombreDestino = nombreDeMiembro(members, destino) ?? "";

  return (
    <div className="mt-2 space-y-3 rounded-md bg-muted/50 p-2 text-sm">
      {carpeta.shares.length > 0 && (
        <ul className="space-y-1.5">
          {carpeta.shares.map((s) => (
            <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="font-medium">
                  {nombreDeMiembro(members, s.user_id) ?? "Otro miembro"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {s.puede_editar ? "puede ver y editar" : "puede ver"}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => correr(() => dejarDeCompartirAction(carpeta.id, s.user_id))}
              >
                Dejar de compartir
              </Button>
            </li>
          ))}
        </ul>
      )}

      {candidatos.length === 0 ? (
        carpeta.shares.length === 0 && (
          <p>
            No hay otros miembros.{" "}
            <Link href="/estudio" className="font-medium hover:underline">
              ¡Agregá más miembros!
            </Link>
          </p>
        )
      ) : (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 @md:flex-row @md:items-center">
            <select
              aria-label="Compartir con"
              value={destino}
              onChange={(e) => setElegido(e.target.value)}
              className="h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm @md:flex-1"
            >
              {candidatos.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.nombre?.trim() ? m.nombre : m.email}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={pending || destino === ""}
              onClick={() => correr(() => compartirCarpetaAction(carpeta.id, destino))}
            >
              Compartir
            </Button>
          </div>
          <p className="text-muted-foreground">
            {textoCompartir({ miembro: nombreDestino, cantidad: carpeta.total })}
          </p>
        </div>
      )}
    </div>
  );
}
