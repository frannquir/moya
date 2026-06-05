"use client";

import { useEffect, useState, useDeferredValue } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { listActive, type Ejecutado } from "@/lib/data/ejecutados";
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

export type BoardMember = {
  user_id: string;
  nombre: string;
  email: string;
  role: string;
};

// Upper bound for the folder view's single-fetch grouping. The estudio is far
// below this; if it ever grows past it, the folder view would need paging.
const FOLDER_FETCH_SIZE = 1000;
const NO_ASSIGNEE = "__none__";

export function EjecutadosBoard({
  initialQ,
  initialPage,
  pageSize,
  isHead,
  currentUserId,
  members,
}: {
  initialQ: string;
  initialPage: number;
  pageSize: number;
  isHead: boolean;
  currentUserId: string;
  members: BoardMember[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const supabase = createBrowserClient();

  const [q, setQ] = useState(initialQ);
  const deferredQ = useDeferredValue(q.trim());

  // View is URL-driven (?vista=). Default "miembro" (own cases); "estudio" (firm-wide,
  // grouped by assignee) is head-only — a member is always pinned to their own cases.
  const urlVista = params.get("vista") === "estudio" ? "estudio" : "miembro";
  const vista = isHead && urlVista === "estudio" ? "estudio" : "miembro";
  const showFolders = vista === "estudio";

  // URL is the source of truth for the page. When the term changes, reset to
  // page 1 — otherwise a stale ?page= could land on an empty page after the set
  // narrows. This keeps query, URL, and pager hrefs consistent.
  const urlPage = Math.max(1, parseInt(params.get("page") ?? String(initialPage), 10) || 1);
  const urlQ = (params.get("q") ?? "").trim();
  const termChanged = deferredQ !== urlQ;
  const pageNum = termChanged ? 1 : urlPage;

  const { data } = useQuery({
    queryKey: [
      "ejecutados",
      { q: deferredQ, page: pageNum, view: "miembro", assignedTo: currentUserId },
    ],
    queryFn: () =>
      listActive(supabase, { q: deferredQ, page: pageNum, pageSize, assignedTo: currentUserId }),
    placeholderData: (prev) => prev, // keep the old page visible while the next loads
    enabled: !showFolders,
  });

  // Folder view fetches the full active set once and groups it client-side.
  const { data: folderData } = useQuery({
    queryKey: ["ejecutados", "folders", { q: deferredQ }],
    queryFn: () =>
      listActive(supabase, { q: deferredQ, page: 1, pageSize: FOLDER_FETCH_SIZE }),
    placeholderData: (prev) => prev,
    enabled: showFolders,
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
      if (vista === "estudio") next.set("vista", "estudio");
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [deferredQ, pageNum, vista, router]);

  // Realtime: any row change invalidates all ejecutados queries (both views).
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

  // Switching view drops ?page= so each view starts at page 1.
  function setVista(next: "miembro" | "estudio") {
    if (next === vista) return;
    const p = new URLSearchParams();
    if (deferredQ) p.set("q", deferredQ);
    if (next === "estudio") p.set("vista", "estudio");
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  // Group the folder-view rows by assignee, in directory order (head-first),
  // unassigned last.
  const folders = buildFolders(folderData?.items ?? [], members);
  const headerCount = showFolders ? (folderData?.items.length ?? 0) : count;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ejecutados</h1>
          <p className="text-sm text-muted-foreground">
            {headerCount} ejecutados activos
            {showFolders ? " en el estudio" : isHead ? " asignados a mí" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isHead && (
            <div className="flex rounded-md border p-0.5">
              <Button
                variant={vista === "miembro" ? "default" : "ghost"}
                size="sm"
                onClick={() => setVista("miembro")}
              >
                Miembro
              </Button>
              <Button
                variant={vista === "estudio" ? "default" : "ghost"}
                size="sm"
                onClick={() => setVista("estudio")}
              >
                Estudio
              </Button>
            </div>
          )}
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

      {showFolders ? (
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
              {folders.length > 0 ? (
                folders
                  .flatMap((folder) => folder.items)
                  .map((e) => <EjecutadoRow key={e.id} e={e} />)
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {deferredQ ? "No se encontraron ejecutados." : "Aún no hay ejecutados."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
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
                  ejecutados.map((e) => <EjecutadoRow key={e.id} e={e} />)
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {deferredQ
                        ? "No se encontraron ejecutados."
                        : isHead
                          ? "Aún no tenés ejecutados asignados a tu nombre. Pasá a Estudio para ver los del equipo."
                          : "Aún no hay ejecutados. Creá el primero."}
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
        </>
      )}
    </div>
  );
}

function EjecutadoRow({ e }: { e: Ejecutado }) {
  return (
    <TableRow className="cursor-pointer">
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
        {e.movimiento ? <Badge variant="outline">{e.movimiento}</Badge> : "—"}
      </TableCell>
    </TableRow>
  );
}

interface Folder {
  key: string;
  label: string;
  items: Ejecutado[];
}

function buildFolders(items: Ejecutado[], members: BoardMember[]): Folder[] {
  const groups = new Map<string, Ejecutado[]>();
  for (const e of items) {
    const key = e.assigned_to_user_id ?? NO_ASSIGNEE;
    const bucket = groups.get(key);
    if (bucket) bucket.push(e);
    else groups.set(key, [e]);
  }

  // Every folder is labelled by its assignee (the head included, by name) so the
  // header total is the only firm-wide count — no special "mine" folder.
  const labelFor = (uid: string) => {
    if (uid === NO_ASSIGNEE) return "Sin delegar";
    const m = members.find((x) => x.user_id === uid);
    if (m) return m.nombre?.trim() ? m.nombre : m.email;
    return "Otro miembro";
  };

  // Directory order (head-first, as get_estudio_members returns it), then any
  // leftover assignees, then unassigned last.
  const orderedKeys: string[] = [];
  for (const m of members) {
    if (groups.has(m.user_id)) orderedKeys.push(m.user_id);
  }
  for (const key of groups.keys()) {
    if (key !== NO_ASSIGNEE && !orderedKeys.includes(key)) orderedKeys.push(key);
  }
  if (groups.has(NO_ASSIGNEE)) orderedKeys.push(NO_ASSIGNEE);

  return orderedKeys.map((key) => ({
    key,
    label: labelFor(key),
    items: groups.get(key)!,
  }));
}
