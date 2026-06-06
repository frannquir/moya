"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type CourtEntry } from "@/lib/data/juzgados";

const NONE = "__none__";

// Two cross-filtered dropdowns for an ejecutado's court:
//  - pick a Juzgado (e.g. "Civil y Comercial N° 3") -> Departamento list narrows to
//    those that actually have it.
//  - pick a Departamento (e.g. "Mar del Plata") -> Juzgado list narrows to its courts
//    (so a non-existent N° 19 never appears).
// Picking a Juzgado de Paz auto-resolves its (single) departamento.
// Submits three hidden inputs: departamento, juzgado (display label), juzgado_id.
export function JuzgadoPicker({
  index,
  defaultDepartamento,
  defaultJuzgadoId,
  defaultJuzgadoLabel,
}: {
  index: CourtEntry[];
  defaultDepartamento?: string | null;
  defaultJuzgadoId?: string | null;
  // Stored free-text juzgado of a not-yet-linked (migrated) case, kept as a hint.
  defaultJuzgadoLabel?: string | null;
}) {
  const initialEntry = defaultJuzgadoId
    ? index.find((e) => e.juzgadoId === defaultJuzgadoId)
    : undefined;

  const [departamento, setDepartamento] = useState(
    initialEntry?.departamento ?? defaultDepartamento?.trim() ?? "",
  );
  const [juzgadoKey, setJuzgadoKey] = useState(initialEntry?.juzgadoKey ?? "");

  const allDepartamentos = useMemo(
    () =>
      [...new Set(index.map((e) => e.departamento))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [index],
  );

  // Departamento options narrow to those holding the selected juzgado.
  const departamentoOptions = useMemo(() => {
    if (!juzgadoKey) return allDepartamentos;
    const hits = new Set(
      index.filter((e) => e.juzgadoKey === juzgadoKey).map((e) => e.departamento),
    );
    return allDepartamentos.filter((d) => hits.has(d));
  }, [index, juzgadoKey, allDepartamentos]);

  // Juzgado options narrow to the selected departamento, grouped Civil then Paz.
  const { civil, paz } = useMemo(() => {
    const pool = departamento
      ? index.filter((e) => e.departamento === departamento)
      : index;
    const seen = new Map<string, CourtEntry>();
    for (const e of pool) if (!seen.has(e.juzgadoKey)) seen.set(e.juzgadoKey, e);
    const opts = [...seen.values()];
    return {
      civil: opts
        .filter((o) => o.tipo === "Juzgado Civil y Comercial")
        .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0)),
      paz: opts
        .filter((o) => o.tipo === "Juzgado de Paz")
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    };
  }, [index, departamento]);

  // Resolve the concrete juzgado_id once (departamento, juzgadoKey) is unambiguous.
  const resolved = useMemo(() => {
    if (!juzgadoKey) return null;
    const matches = index.filter(
      (e) =>
        e.juzgadoKey === juzgadoKey &&
        (!departamento || e.departamento === departamento),
    );
    return matches.length === 1 ? matches[0] : null;
  }, [index, juzgadoKey, departamento]);

  const selectedLabel = juzgadoKey
    ? index.find((e) => e.juzgadoKey === juzgadoKey)?.label ?? ""
    : "";

  // Hidden values. When nothing is selected we keep the migrated free-text juzgado
  // so editing an unrelated field doesn't wipe it.
  const juzgadoIdValue = resolved?.juzgadoId ?? "";
  const juzgadoValue = juzgadoKey ? selectedLabel : defaultJuzgadoLabel ?? "";

  function onDepartamentoChange(value: string) {
    const dep = value === NONE ? "" : value;
    setDepartamento(dep);
    // Drop the juzgado if it no longer exists in the new departamento.
    if (
      juzgadoKey &&
      dep &&
      !index.some((e) => e.departamento === dep && e.juzgadoKey === juzgadoKey)
    ) {
      setJuzgadoKey("");
    }
  }

  function onJuzgadoChange(value: string) {
    const key = value === NONE ? "" : value;
    setJuzgadoKey(key);
    if (!key) return;
    // A Paz court (or any key present in exactly one departamento) implies its depto.
    const deptos = [
      ...new Set(index.filter((e) => e.juzgadoKey === key).map((e) => e.departamento)),
    ];
    if (deptos.length === 1) setDepartamento(deptos[0]);
  }

  const hasMigratedHint =
    !juzgadoKey && !!defaultJuzgadoLabel && defaultJuzgadoLabel.trim() !== "";

  return (
    <div className="grid grid-cols-2 gap-4">
      <input type="hidden" name="departamento" value={departamento} />
      <input type="hidden" name="juzgado" value={juzgadoValue} />
      <input type="hidden" name="juzgado_id" value={juzgadoIdValue} />

      <div className="space-y-2">
        <Label htmlFor="juzgado-select">Juzgado</Label>
        <Select value={juzgadoKey || NONE} onValueChange={onJuzgadoChange}>
          <SelectTrigger id="juzgado-select">
            <SelectValue placeholder="Sin juzgado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin juzgado</SelectItem>
            {civil.length > 0 && (
              <SelectGroup>
                <SelectLabel>Civil y Comercial</SelectLabel>
                {civil.map((o) => (
                  <SelectItem key={o.juzgadoKey} value={o.juzgadoKey}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {paz.length > 0 && (
              <SelectGroup>
                <SelectLabel>Juzgados de Paz</SelectLabel>
                {paz.map((o) => (
                  <SelectItem key={o.juzgadoKey} value={o.juzgadoKey}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        {hasMigratedHint && (
          <p className="text-xs text-muted-foreground">
            Actual: {defaultJuzgadoLabel} (sin vincular)
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="departamento-select">Departamento</Label>
        <Select value={departamento || NONE} onValueChange={onDepartamentoChange}>
          <SelectTrigger id="departamento-select">
            <SelectValue placeholder="Sin departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin departamento</SelectItem>
            {departamentoOptions.map((dep) => (
              <SelectItem key={dep} value={dep}>
                {dep}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
