"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUTORIZADOS_DERIVADO,
  formatAutorizados,
  type AutorizadoConfig,
  type Genero,
  type MiembroAutorizado,
} from "@/lib/domain/escritos-config";

const NONE = "__none__";

function filasDesdeMiembros(miembros: MiembroAutorizado[]): AutorizadoConfig[] {
  return miembros.map((m) => ({
    nombre: (m.nombre ?? "").trim(),
    genero: m.genero === "F" || m.genero === "M" ? m.genero : null,
    es_abogado: m.es_abogado === true,
  }));
}

/**
 * The people section IX of the demanda authorises to do trámites.
 *
 * Until now this list was derived from the estudio's members and nothing else,
 * which meant the head could not add the procurador or the empleado de mesa de
 * entradas who actually do the trámites — they have no Moya account — could not
 * fix another member's blank profile, and could not change the order.
 *
 * Two states, and they are deliberately different things:
 *
 *   rows === null  the estudio has no list of its own; the members are used,
 *                  exactly as before this editor existed.
 *   rows !== null  the estudio's own list, in printed order. Empty is allowed
 *                  and means empty — it prints the [AUTORIZADOS] marker rather
 *                  than quietly bringing the members back.
 */
export function AutorizadosEditor({
  initial,
  miembros,
}: {
  /** null = no list of its own; the members are used. */
  initial: AutorizadoConfig[] | null;
  miembros: MiembroAutorizado[];
}) {
  const [rows, setRows] = useState<AutorizadoConfig[] | null>(initial);

  const derivada = formatAutorizados(miembros);
  const propia = rows === null ? "" : formatAutorizados(rows);

  const update = (i: number, patch: Partial<AutorizadoConfig>) =>
    setRows((prev) =>
      prev === null ? prev : prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );

  const quitar = (i: number) =>
    setRows((prev) => (prev === null ? prev : prev.filter((_, idx) => idx !== i)));

  const agregar = () =>
    setRows((prev) => [...(prev ?? []), { nombre: "", genero: null, es_abogado: false }]);

  // The order is the printed order, which is why this list is an array and why
  // it can be moved at all.
  const mover = (i: number, delta: number) =>
    setRows((prev) => {
      if (prev === null) return prev;
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="space-y-3">
      {/* Serialized for the server action; the visible inputs are controlled.
          The sentinel and an empty array are different values on purpose. */}
      <input
        type="hidden"
        name="autorizados_json"
        value={rows === null ? AUTORIZADOS_DERIVADO : JSON.stringify(rows)}
      />

      {rows === null ? (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <div className="text-xs text-muted-foreground">
            Se arma sola con los miembros del estudio
          </div>
          {derivada !== "" ? (
            <p className="text-sm">«{derivada} y/o quienes ellos designen»</p>
          ) : (
            <p className="text-sm text-warning">
              Ningún miembro tiene el nombre cargado, así que la demanda imprime
              [AUTORIZADOS].
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows(filasDesdeMiembros(miembros))}
          >
            Armar una lista propia
          </Button>
        </div>
      ) : (
        <>
          {rows.map((row, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`autorizado-nombre-${i}`}>Nombre</Label>
                  <Input
                    id={`autorizado-nombre-${i}`}
                    value={row.nombre}
                    onChange={(e) => update(i, { nombre: e.target.value })}
                    placeholder="Nombre y apellido"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Subir"
                    disabled={i === 0}
                    onClick={() => mover(i, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Bajar"
                    disabled={i === rows.length - 1}
                    onClick={() => mover(i, 1)}
                  >
                    ↓
                  </Button>
                </div>
              </div>

              {/* Container queries, not sm:/xl: — this editor renders inside a
                  narrow column of the config form (gotcha #43). */}
              <div className="@container grid grid-cols-1 gap-2 @xs:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`autorizado-genero-${i}`}>Género</Label>
                  {/* Radix Select cannot use "" as a value (gotcha #9). */}
                  <Select
                    value={row.genero ?? NONE}
                    onValueChange={(v) =>
                      update(i, { genero: v === NONE ? null : (v as Genero) })
                    }
                  >
                    <SelectTrigger id={`autorizado-genero-${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin especificar</SelectItem>
                      <SelectItem value="F">Femenino</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="flex h-9 w-full items-center gap-2 rounded-md border px-3">
                    <Switch
                      id={`autorizado-abogado-${i}`}
                      checked={row.es_abogado}
                      onCheckedChange={(v) => update(i, { es_abogado: v })}
                    />
                    <Label
                      htmlFor={`autorizado-abogado-${i}`}
                      className="cursor-pointer font-normal"
                    >
                      Abogado/a
                    </Label>
                  </div>
                </div>
              </div>

              {row.nombre.trim() === "" && (
                <p className="text-xs text-warning">
                  Sin nombre no se puede guardar.
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => quitar(i)}
                >
                  Quitar
                </Button>
              </div>
            </div>
          ))}

          <div className="rounded-md border border-dashed p-3">
            <div className="text-xs text-muted-foreground">
              Se imprime en la demanda
            </div>
            {propia !== "" ? (
              <p className="mt-1 text-sm">«{propia} y/o quienes ellos designen»</p>
            ) : (
              <p className="mt-1 text-sm text-warning">
                La lista está vacía: la demanda imprime [AUTORIZADOS].
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={agregar}>
              Agregar autorizado
            </Button>
            {/* A seed, not a save: it refills the rows from the members and
                waits for Guardar, so the head can trim or extend it first. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows(filasDesdeMiembros(miembros))}
            >
              Restaurar por defecto
            </Button>
            {/* Different thing: drops the estudio's list entirely and goes back
                to deriving it from the members on every escrito. */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows(null)}
            >
              Usar los miembros
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
