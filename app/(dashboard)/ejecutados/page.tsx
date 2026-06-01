import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EjecutadosSearch } from "./search";
import { listActive } from "@/lib/data/ejecutados";

const PAGE_SIZE = 25;

export default async function EjecutadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const term = (q ?? "").trim().slice(0, 100);

  const supabase = await createClient();

  const { items: ejecutados, totalCount: count } = await listActive(supabase, {
    q: term,
    page: pageNum,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // Past the last page (e.g. a stale ?page= after the set shrank): snap to the
  // last real page instead of rendering an empty "no results" table.
  if (pageNum > totalPages) {
    const params = new URLSearchParams({
      ...(term ? { q: term } : {}),
      page: String(totalPages),
    });
    redirect(`?${params}`);
  }

  const hrefFor = (target: number) =>
    `?${new URLSearchParams({ ...(term ? { q: term } : {}), page: String(target) })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ejecutados</h1>
          <p className="text-sm text-muted-foreground">
            {count ?? 0} ejecutados activos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/ejecutados/archivados">Archivados</Link>
          </Button>
          <Button asChild>
            <Link href="/ejecutados/new">Nuevo ejecutado</Link>
          </Button>
        </div>
      </div>

      <EjecutadosSearch defaultValue={q ?? ""} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Expediente</TableHead>
              <TableHead>Juzgado</TableHead>
              <TableHead className="text-right">Deuda inicial</TableHead>
              <TableHead>Movimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ejecutados && ejecutados.length > 0 ? (
              ejecutados.map((e) => (
                <TableRow key={e.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/ejecutados/${e.id}`} className="hover:underline">
                      {e.nombre}
                    </Link>
                  </TableCell>
                  <TableCell>{e.numero_expediente || "—"}</TableCell>
                  <TableCell>{e.juzgado || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.deuda_inicial.toLocaleString("es-AR", {
                      style: "currency",
                      currency: "ARS",
                    })}
                  </TableCell>
                  <TableCell>
                    {e.movimiento ? (
                      <Badge variant="outline">{e.movimiento}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {term ? "No se encontraron ejecutados." : "Aún no hay ejecutados. Creá el primero."}
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
