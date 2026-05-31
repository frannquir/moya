"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Row = {
  clave: string;
  razonSocial: string;
  domicilioLegal: string;
  cuit: string;
};

function emptyRow(): Row {
  return { clave: "", razonSocial: "", domicilioLegal: "", cuit: "" };
}

export function EmpresasEditor({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [emptyRow()]);

  const update = (i: number, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const remove = (i: number) =>
    setRows((prev) => prev.filter((_, idx) => idx !== i));

  const add = () => setRows((prev) => [...prev, emptyRow()]);

  return (
    <div className="space-y-3">
      {/* Serialized for the server action; visible inputs are controlled. */}
      <input type="hidden" name="empresas_json" value={JSON.stringify(rows)} />

      {rows.map((row, i) => (
        <div key={i} className="rounded-md border p-3 space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label>Clave (se guarda en el ejecutado)</Label>
              <Input
                value={row.clave}
                onChange={(e) => update(i, "clave", e.target.value)}
                placeholder="Tartan"
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
          <div className="space-y-1">
            <Label>Razón social</Label>
            <Input
              value={row.razonSocial}
              onChange={(e) => update(i, "razonSocial", e.target.value)}
              placeholder="TARTAN S.A."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Domicilio legal</Label>
              <Input
                value={row.domicilioLegal}
                onChange={(e) => update(i, "domicilioLegal", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>CUIT</Label>
              <Input
                value={row.cuit}
                onChange={(e) => update(i, "cuit", e.target.value)}
                placeholder="00-00000000-0"
              />
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        Agregar empresa
      </Button>
    </div>
  );
}
