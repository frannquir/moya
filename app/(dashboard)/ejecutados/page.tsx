import Link from "next/link";
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

const PAGE_SIZE = 25;

export default async function EjecutadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("ejecutados")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q && q.trim()) {
    query = query.ilike("nombre", `%${q.trim()}%`);
  }

  const { data: ejecutados, count, error } = await query;
  if (error) throw error;

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ejecutados</h1>
          <p className="text-sm text-muted-foreground">
            {count ?? 0} ejecutados activos
          </p>
        </div>
        <Button asChild>
          <Link href="/ejecutados/new">Nuevo ejecutado</Link>
        </Button>
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
                  {q ? "No se encontraron ejecutados." : "Aún no hay ejecutados. Creá el primero."}
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
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={pageNum <= 1}
            >
              <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(pageNum - 1) })}`}>
                Anterior
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={pageNum >= totalPages}
            >
              <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(pageNum + 1) })}`}>
                Siguiente
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}