"use client";

import { useEffect, useState, useDeferredValue } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { listActive } from "@/lib/data/ejecutados";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function EjecutadosBoard({
  initialQ,
  initialPage,
  pageSize,
}: {
  initialQ: string;
  initialPage: number;
  pageSize: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const supabase = createBrowserClient();

  const [q, setQ] = useState(initialQ);
  const deferredQ = useDeferredValue(q.trim());

  // URL is the source of truth for the page. When the term changes, reset to
  // page 1 — otherwise a stale ?page= could land on an empty page after the set
  // narrows. This keeps query, URL, and pager hrefs consistent.
  const urlPage = Math.max(1, parseInt(params.get("page") ?? String(initialPage), 10) || 1);
  const urlQ = (params.get("q") ?? "").trim();
  const termChanged = deferredQ !== urlQ;
  const pageNum = termChanged ? 1 : urlPage;

  const { data } = useQuery({
    queryKey: ["ejecutados", { q: deferredQ, page: pageNum }],
    queryFn: () =>
      listActive(supabase, { q: deferredQ, page: pageNum, pageSize }),
    placeholderData: (prev) => prev, // keep the old page visible while the next loads
  });

  const ejecutados = data?.items ?? [];
  const count = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  // Debounced URL sync so the URL stays shareable / back-forward works, without
  // rewriting on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams();
      if (deferredQ) next.set("q", deferredQ);
      if (pageNum > 1) next.set("page", String(pageNum));
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [deferredQ, pageNum, router]);

  // Realtime: any row change invalidates all ejecutados queries.
  useEffect(() => {
    const ch = supabase
      .channel("ejecutados-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ejecutados" },
        () => queryClient.invalidateQueries({ queryKey: ["ejecutados"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hrefFor = (target: number) =>
    `?${new URLSearchParams({ ...(deferredQ ? { q: deferredQ } : {}), page: String(target) })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ejecutados</h1>
          <p className="text-sm text-muted-foreground">
            {count} ejecutados activos
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

      <div className="relative max-w-sm">
        <Input
          placeholder="Buscar por nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

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
            {ejecutados.length > 0 ? (
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
                  {deferredQ ? "No se encontraron ejecutados." : "Aún no hay ejecutados. Creá el primero."}
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
