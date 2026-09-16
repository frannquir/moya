import type { Metadata } from "next";
import Link from "next/link";
import { PhoneCall } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MovimientoBadge } from "@/components/movimiento-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatArDate } from "@/lib/domain/dates";
import { formatJus } from "@/lib/domain/honorarios";
import { formatMonedaAr } from "@/lib/domain/moneda-ar";
import { textoDeAtraso, urgencia, DIAS_PARA_RECLAMAR } from "@/lib/domain/estadisticas";
import {
  getResumenEstudio,
  listCobrosRecientes,
  listEjecutadosRecientes,
  listMovimientosRecientes,
  listParaReclamar,
} from "@/lib/data/estadisticas";
import { EjecutadosDestacados } from "./ejecutados-destacados";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage() {
  const supabase = await createClient();

  const [resumen, reclamar, recientes, movimientos, cobros] = await Promise.all([
    getResumenEstudio(supabase),
    listParaReclamar(supabase, { limit: 60 }),
    listEjecutadosRecientes(supabase),
    listMovimientosRecientes(supabase),
    listCobrosRecientes(supabase),
  ]);

  // Sixty rows would bury every other panel below the fold.
  const VISIBLES = 12;
  const enCola = reclamar.slice(0, VISIBLES);
  const restantes = reclamar.length - enCola.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Inicio</h1>
        <p className="text-sm text-muted-foreground">
          Qué se movió y a quién hay que llamar.
        </p>
      </div>

      {/* Deuda inicial is what is claimed and stays neutral; only the two
          figures that describe real cash — what came in, what is still owed —
          carry a colour. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figura label="Ejecutados activos" value={String(resumen.ejecutados)} />
        <Figura label="Deuda inicial total" value={`$${formatMonedaAr(resumen.deudaTotal)}`} />
        <Figura
          label="Cobrado"
          value={`$${formatMonedaAr(resumen.cobrado)}`}
          tone={resumen.cobrado > 0 ? "cobrado" : undefined}
        />
        {/* In pesos, like the two figures beside it: what is still owed is the
            fee plus the IVA and aportes the juzgado withholds, and only the fee
            underneath it is a number of JUS. */}
        <Figura
          label="Honorarios pendientes"
          value={`$${formatMonedaAr(resumen.honorariosPendientesArs)}`}
          sub={`${formatJus(resumen.honorariosPendientesBaseJus)} de honorario`}
          tone={resumen.honorariosPendientesArs > 0 ? "pendiente" : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5 xl:items-start">
        {/* ---------------- THE QUEUE ---------------- */}
        <div className="min-w-0 space-y-4 xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="size-4" />
                Para reclamar
              </CardTitle>
              <CardDescription>
                Casos con honorarios pendientes cuyo último pago tiene más de{" "}
                {DIAS_PARA_RECLAMAR} días. Los que nunca pagaron van primero.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reclamar.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay nada para reclamar. Todos los honorarios con saldo se
                  cobraron en el último mes.
                </p>
              ) : (
                <ul className="divide-y">
                  {enCola.map((r) => {
                    const u = urgencia(r.diasDesdeUltimoPago);
                    return (
                      <li
                        key={r.ejecutadoId}
                        className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/ejecutados/${r.ejecutadoId}`}
                            className="font-medium hover:underline"
                          >
                            {r.nombre || "Sin nombre"}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {r.ultimoPago
                              ? `Último pago ${formatArDate(r.ultimoPago)}`
                              : "Sin pagos registrados"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm tabular-nums">
                            {`$${formatMonedaAr(r.pendienteArs)}`}
                          </span>
                          <Badge variant={u === "media" ? "warning" : "destructive"}>
                            {textoDeAtraso(r.diasDesdeUltimoPago)}
                          </Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {restantes > 0 && (
                <p className="pt-3 text-xs text-muted-foreground">
                  Y {restantes} caso{restantes === 1 ? "" : "s"} más para reclamar.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ejecutados recientes</CardTitle>
              <CardDescription>
                Los últimos casos cargados. Usá los puntos para pasar de uno a otro.
              </CardDescription>
            </CardHeader>
            {/* min-w-0: CardContent is a flex item, and min-width:auto lets a wide
                child push the whole page sideways. */}
            <CardContent className="@container min-w-0">
              <EjecutadosDestacados items={recientes} />
            </CardContent>
          </Card>
        </div>

        {/* ---------------- CONTEXT ---------------- */}
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movimientos recientes</CardTitle>
            </CardHeader>
            <CardContent>
              {movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no se registró ningún cambio de etapa. Se empiezan a
                  registrar desde que se guarde el próximo movimiento.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {movimientos.map((m) => (
                    <li key={m.id} className="py-2 first:pt-0">
                      <Link
                        href={`/ejecutados/${m.ejecutadoId}`}
                        className="font-medium hover:underline"
                      >
                        {m.nombre || "Sin nombre"}
                      </Link>
                      {/* The one panel where the ramp is the content: two pills
                          side by side show which way along it the case moved. */}
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <MovimientoBadge movimiento={m.de} className="h-4 px-1.5 text-[10px]" />
                        <span aria-hidden>→</span>
                        <MovimientoBadge movimiento={m.a} className="h-4 px-1.5 text-[10px]" />
                        <span>· {formatArDate(m.createdAt.slice(0, 10))}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cobros</CardTitle>
              <CardDescription>
                Pedido y todavía sin proveer:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  ${formatMonedaAr(resumen.aCobrar)}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cobros.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin cobros registrados.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {cobros.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/ejecutados/${c.ejecutadoId}`}
                          // `block`: an inline <a> ignores overflow, so truncate does nothing.
                          className="block truncate font-medium hover:underline"
                        >
                          {c.nombre || "Sin nombre"}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {c.fecha ? formatArDate(c.fecha) : "Sin fecha"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {/* Green once proveído — that is the point at which the
                            amount stops being a request and becomes money. */}
                        <span
                          className={cn(
                            "tabular-nums",
                            c.estado === "Proveído" && "font-medium text-success",
                          )}
                        >
                          ${formatMonedaAr(c.monto)}
                        </span>
                        <Badge variant={c.estado === "Proveído" ? "success" : "warning"}>
                          {c.estado ?? "—"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            <CardContent className="pt-0">
              <Button variant="outline" size="sm" asChild>
                <Link href="/cobros">Ver todos los cobros</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Figura({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  /** "cobrado" is money in; "pendiente" is money the estudio is still owed. */
  tone?: "cobrado" | "pendiente";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        tone === "cobrado" && "border-success/30 bg-success/5",
        tone === "pendiente" && "border-warning/30 bg-warning/5",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-heading text-xl font-semibold tabular-nums",
          tone === "cobrado" && "text-success",
          tone === "pendiente" && "text-warning",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  );
}
