"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type CourtEntry } from "@/lib/data/juzgados";

const NONE = "__none__";

export type RecusadoRow = {
  /** Empty until a court is chosen. The stored key, and what a case matches on. */
  juzgadoId: string;
  nombre: string;
};

/**
 * The courts whose judge the estudio recuses without cause.
 *
 * Section XII of the demanda is printed only for a case whose juzgado is on this
 * list, and it prints THIS name — never `juzgados.juez`. A judge must not appear
 * as recusado just because the reference table knows who they are (Fran,
 * 2026-08-31), so the name is typed here and nowhere else.
 *
 * Civil y Comercial only: a Juzgado de Paz is never recused.
 */
export function JuecesRecusadosEditor({
  initial,
  courtIndex,
}: {
  initial: RecusadoRow[];
  courtIndex: CourtEntry[];
}) {
  const [rows, setRows] = useState<RecusadoRow[]>(initial);

  // Only Civil y Comercial courts are offered, and each is keyed by its real
  // juzgados.id — the same column ejecutados.juzgado_id holds, so matching a case
  // is one lookup and survives any renaming of a court or a city.
  const civiles = useMemo(
    () =>
      courtIndex
        .filter((e) => e.tipo === "Juzgado Civil y Comercial")
        .sort(
          (a, b) =>
            a.departamento.localeCompare(b.departamento, "es") ||
            (a.numero ?? 0) - (b.numero ?? 0),
        ),
    [courtIndex],
  );

  const departamentos = useMemo(
    () => [...new Set(civiles.map((e) => e.departamento))],
    [civiles],
  );

  const byId = useMemo(
    () => new Map(civiles.map((e) => [e.juzgadoId, e])),
    [civiles],
  );

  const update = (i: number, patch: Partial<RecusadoRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const remove = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const add = () => setRows((prev) => [...prev, { juzgadoId: "", nombre: "" }]);

  return (
    <div className="space-y-3">
      {/* Serialized for the server action; the visible inputs are controlled. */}
      <input
        type="hidden"
        name="jueces_recusados_json"
        value={JSON.stringify(rows)}
      />

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin jueces recusados. Ninguna demanda va a incluir el apartado de
          recusación sin expresión de causa.
        </p>
      )}

      {rows.map((row, i) => {
        const entry = row.juzgadoId ? byId.get(row.juzgadoId) : undefined;
        const departamento = entry?.departamento ?? "";
        const enDepartamento = departamento
          ? civiles.filter((e) => e.departamento === departamento)
          : [];

        return (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Departamento</Label>
                <Select
                  value={departamento || NONE}
                  onValueChange={(v) => {
                    // Changing the departamento drops the court, because a court
                    // belongs to exactly one city.
                    if (v === NONE) return update(i, { juzgadoId: "" });
                    const primero = civiles.find((e) => e.departamento === v);
                    update(i, { juzgadoId: primero?.juzgadoId ?? "" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí un departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin departamento</SelectItem>
                    {departamentos.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Juzgado</Label>
                <Select
                  value={row.juzgadoId || NONE}
                  onValueChange={(v) =>
                    update(i, { juzgadoId: v === NONE ? "" : v })
                  }
                  disabled={departamento === ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí un juzgado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin juzgado</SelectItem>
                    {enDepartamento.map((e) => (
                      <SelectItem key={e.juzgadoId} value={e.juzgadoId}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Nombre del juez</Label>
              <Input
                value={row.nombre}
                onChange={(e) => update(i, { nombre: e.target.value })}
                placeholder="Dra. Nombre Apellido"
              />
              <p className="text-xs text-muted-foreground">
                Se imprime tal cual en la demanda: «vengo a recusar sin expresión
                de causa a …». Incluí el tratamiento (Dr. / Dra.).
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => remove(i)}>
                Quitar
              </Button>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        Agregar juez recusado
      </Button>
    </div>
  );
}
