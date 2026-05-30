"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Row = { departamento: string; domicilio: string };

export function DomiciliosEditor({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(
    initial.length ? initial : [{ departamento: "", domicilio: "" }],
  );

  const update = (i: number, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const remove = (i: number) =>
    setRows((prev) => prev.filter((_, idx) => idx !== i));

  const add = () =>
    setRows((prev) => [...prev, { departamento: "", domicilio: "" }]);

  return (
    <div className="space-y-3">
      {/* Serialized for the server action; visible inputs are controlled. */}
      <input type="hidden" name="domicilios_json" value={JSON.stringify(rows)} />

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.6fr_auto] items-end gap-2">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Departamento</span>
            <Input
              value={row.departamento}
              onChange={(e) => update(i, "departamento", e.target.value)}
              placeholder="Mar del Plata"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Domicilio procesal</span>
            <Input
              value={row.domicilio}
              onChange={(e) => update(i, "domicilio", e.target.value)}
              placeholder="calle __________ Nº ____"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => remove(i)}
          >
            Quitar
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        Agregar departamento
      </Button>
    </div>
  );
}
