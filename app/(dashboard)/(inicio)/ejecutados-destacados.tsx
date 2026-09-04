"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MovimientoBadge } from "@/components/movimiento-badge";
import { formatArDate } from "@/lib/domain/dates";
import { formatJus } from "@/lib/domain/honorarios";
import { formatMonedaAr } from "@/lib/domain/moneda-ar";
import { type EjecutadoReciente } from "@/lib/data/estadisticas";

/** Recent cases, one at a time, stepped with dots. */
export function EjecutadosDestacados({ items }: { items: EjecutadoReciente[] }) {
  const [i, setI] = React.useState(0);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay casos.</p>;
  }

  const n = items.length;
  const e = items[Math.min(i, n - 1)];
  const go = (delta: number) => setI((prev) => (prev + delta + n) % n);

  return (
    <div
      className="space-y-3"
      role="group"
      aria-roledescription="carrusel"
      aria-label="Ejecutados recientes"
      onKeyDown={(ev) => {
        if (ev.key === "ArrowRight") go(1);
        if (ev.key === "ArrowLeft") go(-1);
      }}
      tabIndex={0}
    >
      <div className="flex gap-4 rounded-lg border p-4">
        {/* Avatar hard-codes rounded-full in three places, so the plate is local. */}
        <div
          aria-hidden
          className="hidden size-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-heading text-lg font-semibold text-primary sm:flex"
        >
          {iniciales(e.nombre)}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link
              href={`/ejecutados/${e.id}`}
              className="font-heading text-base font-semibold hover:underline"
            >
              {e.nombre || "Sin nombre"}
            </Link>
            <div className="flex flex-wrap gap-1">
              {e.movimiento && (
                <MovimientoBadge movimiento={e.movimiento} diligenciada={e.diligenciada} />
              )}
              {e.via === "extrajudicial" && <Badge variant="accent">Extrajudicial</Badge>}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs @md:grid-cols-3">
            <Dato label="Deuda inicial" value={`$${formatMonedaAr(e.deudaInicial)}`} />
            <Dato
              label="Demanda"
              value={e.ultimaDemanda ? formatArDate(e.ultimaDemanda.slice(0, 10)) : "Sin generar"}
              muted={!e.ultimaDemanda}
            />
            <Dato
              label="Honorarios"
              value={
                e.honorarioPendienteJus === null
                  ? "Sin cargar"
                  : e.honorarioPendienteJus === 0
                    ? "Cobrado"
                    : `${formatJus(e.honorarioPendienteJus)} pend.`
              }
              muted={e.honorarioPendienteJus === null}
              tone={e.honorarioPendienteJus === 0 ? "cobrado" : undefined}
            />
            <Dato
              label="Último pago"
              value={e.ultimoPagoHonorario ? formatArDate(e.ultimoPagoHonorario) : "Nunca"}
              muted={!e.ultimoPagoHonorario}
            />
            <Dato label="Alta" value={formatArDate(e.createdAt.slice(0, 10))} />
          </dl>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {items.map((it, idx) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Ver ${it.nombre || "caso sin nombre"}`}
              aria-current={idx === i ? "true" : undefined}
              className={cn(
                "size-2 rounded-full transition-colors",
                idx === i ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/60",
              )}
            />
          ))}
          <span className="ml-2 text-xs text-muted-foreground tabular-nums">
            {i + 1}/{n}
          </span>
        </div>

        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => go(-1)} aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => go(1)} aria-label="Siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Dato({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  /** Green, and only for a fee that has been fully collected. */
  tone?: "cobrado";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "truncate font-medium tabular-nums",
          muted && "font-normal text-muted-foreground",
          !muted && tone === "cobrado" && "text-success",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** "Herrera, Verónica" -> "HV". */
function iniciales(nombre: string): string {
  const partes = nombre
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (partes.length === 0) return "—";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
