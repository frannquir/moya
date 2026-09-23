import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  IVA_RATE,
  APORTES_RATE,
  formatJus,
  formatArs,
  jusToArs,
  saldoHonorario,
} from "@/lib/domain/honorarios";
import {
  BORRADORES_DEFAULT,
  ESTADO_LABELS,
  borradoresFiltroDe,
  estadoDe,
  estadoFiltroDe,
} from "@/lib/domain/honorarios-lista";
import { getJusValue, listHonorarios } from "@/lib/data/honorarios";
import { HonorariosFiltros } from "./honorarios-filtros";

export const metadata: Metadata = { title: "Honorarios" };

const PAGE_SIZE = 25;

export default async function HonorariosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    estado?: string;
    borradores?: string;
  }>;
}) {
  const { q, page, estado: estadoRaw, borradores: borradoresRaw } = await searchParams;
  const term = (q ?? "").trim().slice(0, 100);
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  // Anything unrecognised falls back rather than 500ing on a hand-typed URL.
  const estado = estadoFiltroDe(estadoRaw);
  const borradores = borradoresFiltroDe(borradoresRaw);

  const supabase = await createClient();

  const [{ items, totalCount, pendientesCount }, jusValue] = await Promise.all([
    listHonorarios(supabase, {
      q: term,
      estado,
      borradores,
      page: pageNum,
      pageSize: PAGE_SIZE,
    }),
    getJusValue(supabase),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (pageNum > totalPages) {
    redirect(hrefFor(totalPages));
  }

  function hrefFor(target: number) {
    const p = new URLSearchParams();
    if (term) p.set("q", term);
    if (estado) p.set("estado", estado);
    if (borradores !== BORRADORES_DEFAULT) p.set("borradores", borradores);
    if (target > 1) p.set("page", String(target));
    const qs = p.toString();
    return qs ? `?${qs}` : "?";
  }

  const filtrando = term !== "" || estado !== "" || borradores !== BORRADORES_DEFAULT;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Honorarios</h1>
        <p className="text-sm text-muted-foreground">
          {totalCount} honorarios · {pendientesCount} pendientes · Valor JUS:{" "}
          {formatArs(jusValue)} · Máximo a cobrar = honorario + IVA{" "}
          {Math.round(IVA_RATE * 100)}% + aportes {Math.round(APORTES_RATE * 100)}%, o
          lo acordado con el ejecutado
        </p>
      </div>

      <HonorariosFiltros q={term} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ejecutado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Honorario</TableHead>
              <TableHead className="text-right">Máximo a cobrar</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Restante</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.map((h) => {
                const techo = saldoHonorario(h, jusValue);
                // One rule for the badge and for the Estado filter, so the list
                // can never say "Pendiente" next to a row the filter calls
                // saldada (lib/domain/honorarios-lista.ts).
                const estadoFila = estadoDe(h);
                // A name is never expected to be missing — no ejecutado in the
                // base has a blank one — but a row that renders blank is a bug
                // nobody can see. This one says so out loud and still leads
                // somewhere useful.
                const nombre = (h.ejecutado?.nombre ?? "").trim();
                const expediente = (h.ejecutado?.numero_expediente ?? "").trim();
                return (
                  <TableRow
                    key={h.id}
                    className={estadoFila === "pagado" ? "opacity-60" : ""}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/ejecutados/${h.ejecutado_id}`}
                          className={nombre ? "hover:underline" : "hover:underline italic text-muted-foreground"}
                        >
                          {nombre || "(sin nombre)"}
                        </Link>
                        {h.ejecutado?.is_draft && (
                          <Badge variant="outline" className="font-normal">
                            Borrador
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {expediente ? `Expte. ${expediente}` : "Sin expediente"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={estadoFila === "pagado" ? "success" : "outline"}>
                        {ESTADO_LABELS[estadoFila]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatJus(h.monto_total_jus ?? 0)}
                      <div className="text-xs text-muted-foreground">
                        {formatArs(jusToArs(h.monto_total_jus ?? 0, jusValue))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatArs(techo.capArs)}
                      <div className="text-xs text-muted-foreground">
                        {h.max_acordado_ars != null
                          ? "acordado"
                          : `honorario + IVA + aportes`}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatArs(h.pagado_ars ?? 0)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        techo.pendienteArs > 0 ? "text-warning font-medium" : ""
                      }`}
                    >
                      {formatArs(techo.pendienteArs)}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {filtrando
                    ? "Ningún honorario coincide con la búsqueda."
                    : "Aún no hay honorarios. Creá el primero desde un ejecutado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {pageNum} de {totalPages}
          </span>
          <div className="space-x-2">
            {pageNum <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Anterior
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={hrefFor(pageNum - 1)}>Anterior</Link>
              </Button>
            )}
            {pageNum >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Siguiente
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={hrefFor(pageNum + 1)}>Siguiente</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
