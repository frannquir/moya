"use client";

import { useEffect, useState, useDeferredValue } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { listActive, getStats, type Ejecutado } from "@/lib/data/ejecutados";
import {
  ORDEN_OPTIONS,
  ordenOf,
  VIA_OPTIONS,
  viaOf,
  type Orden,
  type Via,
} from "@/lib/domain/ejecutado";
import { formatMonedaAr } from "@/lib/domain/moneda-ar";
import { textoDeInactividad, urgenciaDeCaso } from "@/lib/domain/urgencia";
import { cn } from "@/lib/utils";
import { MovimientoBadge, etapaRowClass } from "@/components/movimiento-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// The via filter, URL-driven like ?vista=. "" is "Todos" and stays out of the URL.
const VIA_FILTERS: { value: "" | Via; label: string }[] = [
  { value: "", label: "Todos" },
  ...VIA_OPTIONS.map((v) => ({
    value: v,
    label: v === "judicial" ? "Judicial" : "Extrajudicial",
  })),
];

function viaFilterFrom(raw: string | null): "" | Via {
  return (VIA_OPTIONS as readonly string[]).includes(raw ?? "") ? (raw as Via) : "";
}

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

  // The via filter rides the same URL-as-source-of-truth pattern as ?vista=.
  // Not head-gated: an extrajudicial case means a channel to the debtor exists,
  // which is what the firm most wants to see grouped, member or head.
  const viaFilter = viaFilterFrom(params.get("via"));
  const orden = ordenOf(params.get("orden"));

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
      {
        q: deferredQ,
        page: pageNum,
        view: "miembro",
        assignedTo: currentUserId,
        via: viaFilter,
        orden,
      },
    ],
    queryFn: () =>
      listActive(supabase, {
        q: deferredQ,
        page: pageNum,
        pageSize,
        assignedTo: currentUserId,
        orden,
        ...(viaFilter ? { via: viaFilter } : {}),
      }),
    placeholderData: (prev) => prev, // keep the old page visible while the next loads
    enabled: !showFolders,
  });

  // Folder view fetches the full active set once and groups it client-side.
  const { data: folderData } = useQuery({
    queryKey: ["ejecutados", "folders", { q: deferredQ, via: viaFilter, orden }],
    queryFn: () =>
      listActive(supabase, {
        q: deferredQ,
        page: 1,
        pageSize: FOLDER_FETCH_SIZE,
        orden,
        ...(viaFilter ? { via: viaFilter } : {}),
      }),
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
      if (viaFilter) next.set("via", viaFilter);
      if (orden !== "recientes") next.set("orden", orden);
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [deferredQ, pageNum, vista, viaFilter, orden, router]);

  const { data: stats } = useQuery({
    queryKey: ["ejecutados", "stats", { assignedTo: showFolders ? null : currentUserId, via: viaFilter }],
    queryFn: () =>
      getStats(supabase, {
        ...(showFolders ? {} : { assignedTo: currentUserId }),
        ...(viaFilter ? { via: viaFilter } : {}),
      }),
    placeholderData: (prev) => prev,
  });

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
    `?${new URLSearchParams({
      ...(deferredQ ? { q: deferredQ } : {}),
      ...(vista === "estudio" ? { vista: "estudio" } : {}),
      ...(viaFilter ? { via: viaFilter } : {}),
      ...(orden !== "recientes" ? { orden } : {}),
      page: String(target),
    })}`;

  // Switching view drops ?page= so each view starts at page 1.
  function setVista(next: "miembro" | "estudio") {
    if (next === vista) return;
    const p = new URLSearchParams();
    if (deferredQ) p.set("q", deferredQ);
    if (next === "estudio") p.set("vista", "estudio");
    if (viaFilter) p.set("via", viaFilter);
    if (orden !== "recientes") p.set("orden", orden);
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  // Narrowing the set can strand a stale ?page=, so the filter resets to page 1
  // exactly as switching view does.
  function setViaFilter(next: "" | Via) {
    if (next === viaFilter) return;
    const p = new URLSearchParams();
    if (deferredQ) p.set("q", deferredQ);
    if (vista === "estudio") p.set("vista", "estudio");
    if (next) p.set("via", next);
    if (orden !== "recientes") p.set("orden", orden);
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  // Re-sorting reshuffles every page, so a stale ?page= would land somewhere
  // arbitrary. Same reset as the via filter.
  function setOrden(next: Orden) {
    if (next === orden) return;
    const p = new URLSearchParams();
    if (deferredQ) p.set("q", deferredQ);
    if (vista === "estudio") p.set("vista", "estudio");
    if (viaFilter) p.set("via", viaFilter);
    if (next !== "recientes") p.set("orden", next);
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  // Group the folder-view rows by assignee, in directory order (head-first),
  // unassigned last.
  const folders = buildFolders(folderData?.items ?? [], members);
  const headerCount = showFolders ? (folderData?.items.length ?? 0) : count;

  return (
    <div className="space-y-4">
      {/* flex-wrap, or the five action buttons hold the page open: measured at a
          375px viewport the document was 688px wide and scrolled sideways. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ejecutados</h1>
          <p className="text-sm text-muted-foreground">
            {headerCount} ejecutados activos
            {showFolders ? " en el estudio" : isHead ? " asignados a mí" : ""}
            {viaFilter ? ` · ${viaFilter === "judicial" ? "judiciales" : "extrajudiciales"}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" asChild>
            <Link href="/ejecutados/new">Nuevo ejecutado</Link>
          </Button>
          <Button asChild>
            <Link href="/ejecutados/demanda">Iniciar demanda</Link>
          </Button>
        </div>
      </div>

      {/* The figures describe the rows below, not the whole estudio: same
          assignedTo and same via filter as the list query. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Ejecutados" value={stats ? String(stats.total) : "—"} />
        <StatCard
          label="Actualizados hoy"
          value={stats ? String(stats.actualizadosHoy) : "—"}
          muted={stats?.actualizadosHoy === 0}
        />
        {/* The red figure counts exactly the rows wearing a red edge bar below. */}
        <StatCard
          label="Sin movimiento"
          value={stats ? String(stats.urgentes) : "—"}
          tone={stats && stats.urgentes > 0 ? "urgente" : undefined}
          muted={stats?.urgentes === 0}
        />
        <StatCard
          label="Extrajudiciales"
          value={stats ? String(stats.extrajudiciales) : "—"}
          muted={stats?.extrajudiciales === 0}
        />
        <StatCard
          label="Deuda inicial total"
          value={stats ? `$${formatMonedaAr(stats.deudaTotal)}` : "—"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[12rem]">
          <Input
            placeholder="Buscar por nombre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Vía:</span>
          <div className="flex rounded-md border p-0.5">
            {VIA_FILTERS.map((f) => (
              <Button
                key={f.value || "todos"}
                variant={viaFilter === f.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setViaFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ordenar:</span>
          <Select value={orden} onValueChange={(v) => setOrden(v as Orden)}>
            <SelectTrigger size="sm" className="w-[15rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDEN_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

function StatCard({
  label,
  value,
  muted = false,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  /** "urgente" tints the whole card; "cobrado" is for money that arrived. */
  tone?: "urgente" | "cobrado";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        tone === "urgente" && "border-destructive/30 bg-destructive/5",
        tone === "cobrado" && "border-success/30 bg-success/5",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-heading text-xl font-semibold tabular-nums",
          muted && "text-muted-foreground",
          !muted && tone === "urgente" && "text-destructive",
          !muted && tone === "cobrado" && "text-success",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EjecutadoRow({ e }: { e: Ejecutado }) {
  const urgencia = urgenciaDeCaso(e.updated_at);
  const inactividad = textoDeInactividad(e.updated_at);

  return (
    <TableRow
      className={cn(
        "cursor-pointer",
        // Every row carries the bar and only its colour changes: sizing it per
        // row would push the columns 4px sideways on urgent rows alone.
        //
        // The bar is red where the etapa pill can also be red, but the two never
        // read as one signal — a 4px rule at the table's edge is a different
        // shape in a different place from a filled pill mid-row, and "overdue"
        // is worth the strongest affordance available.
        "border-l-4 border-l-transparent",
        urgencia === "atencion" && "border-l-warning",
        urgencia === "urgente" && "border-l-destructive",
        etapaRowClass(e.movimiento),
      )}
      title={inactividad ?? undefined}
    >
      <TableCell className="font-medium">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/ejecutados/${e.id}`} className="hover:underline">
            {e.nombre}
          </Link>
          {viaOf(e.via) === "extrajudicial" && (
            <Badge variant="accent" className="text-[10px]">
              Extrajudicial
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>{e.numero_expediente || "—"}</TableCell>
      <TableCell>{e.juzgado || "—"}</TableCell>
      {/* Deuda inicial is what is claimed, not what came in, so it stays
          neutral — green is reserved for money actually collected. */}
      <TableCell className="text-right tabular-nums">
        {e.deuda_inicial.toLocaleString("es-AR", {
          style: "currency",
          currency: "ARS",
        })}
      </TableCell>
      <TableCell>
        {e.movimiento ? <MovimientoBadge movimiento={e.movimiento} /> : "—"}
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
