"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BORRADORES_DEFAULT,
  BORRADORES_FILTROS,
  ESTADO_FILTROS,
  borradoresFiltroDe,
  estadoFiltroDe,
  type BorradoresFiltro,
  type HonorarioEstado,
} from "@/lib/domain/honorarios-lista";

// Radix Select cannot carry "" as a value (gotcha #9), so "Todos" travels as a
// sentinel in the widget and as an absent param in the URL.
const TODOS = "__todos__";

/**
 * The filter bar. The URL is the source of truth — the page is a Server
 * Component and reads `searchParams`, so every change here is a navigation and
 * the list comes back already narrowed by Postgres. Only the text input keeps
 * local state, to stay responsive between keystrokes.
 *
 * Changing any filter drops `?page=`: narrowing the set with a stale page can
 * land on an empty one.
 */
export function HonorariosFiltros({ q: initialQ }: { q: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ);

  const estado = estadoFiltroDe(params.get("estado"));
  const borradores = borradoresFiltroDe(params.get("borradores"));
  const urlQ = (params.get("q") ?? "").trim();

  function href(next: { q?: string; estado?: "" | HonorarioEstado; borradores?: BorradoresFiltro }) {
    const p = new URLSearchParams();
    const term = (next.q ?? urlQ).trim();
    const e = next.estado ?? estado;
    const b = next.borradores ?? borradores;
    if (term) p.set("q", term);
    if (e) p.set("estado", e);
    if (b !== BORRADORES_DEFAULT) p.set("borradores", b);
    const qs = p.toString();
    return qs ? `?${qs}` : "?";
  }

  // Debounced, so the list is not re-queried on every keystroke, and skipped
  // when the term already matches the URL (that includes the first render).
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim() === urlQ) return;
      router.replace(href({ q }), { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, urlQ, estado, borradores, router]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="max-w-sm flex-1 min-w-[12rem]">
        <Input
          placeholder="Buscar por nombre, expediente o documento…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Estado:</span>
        <Select
          value={estado || TODOS}
          onValueChange={(v) =>
            router.replace(
              href({ estado: v === TODOS ? "" : (v as HonorarioEstado) }),
              { scroll: false },
            )
          }
        >
          <SelectTrigger size="sm" className="w-[12rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADO_FILTROS.map((f) => (
              <SelectItem key={f.value || TODOS} value={f.value || TODOS}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Borradores:</span>
        <Select
          value={borradores}
          onValueChange={(v) =>
            router.replace(href({ borradores: v as BorradoresFiltro }), { scroll: false })
          }
        >
          <SelectTrigger size="sm" className="w-[11rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BORRADORES_FILTROS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
