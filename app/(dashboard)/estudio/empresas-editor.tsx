"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CuilInput } from "@/components/cuil-input";

type Row = {
  clave: string;
  razonSocial: string;
  domicilioLegal: string;
  cuit: string;
  cuentaBancaria: string;
};

function emptyRow(): Row {
  return {
    clave: "",
    razonSocial: "",
    domicilioLegal: "",
    cuit: "",
    cuentaBancaria: "",
  };
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
          <div className="@container grid grid-cols-1 gap-2 @xs:grid-cols-2">
            <div className="space-y-1">
              <Label>Domicilio legal</Label>
              <Input
                value={row.domicilioLegal}
                onChange={(e) => update(i, "domicilioLegal", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>CUIT</Label>
              {/* Same masked input the party forms use: a CUIT is the same mod-11
                  construction as a CUIL, with a 30/33/34 juridical prefix. */}
              <CuilInput
                value={row.cuit}
                onValueChange={(next) => update(i, "cuit", next)}
                placeholder="30-70123456-8"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Cuenta bancaria (convenio)</Label>
            <Input
              value={row.cuentaBancaria}
              onChange={(e) => update(i, "cuentaBancaria", e.target.value)}
              placeholder="Cuenta 0000-00000/0, CBU 0000000000000000000000, Banco __________ Sucursal 000"
            />
            <p className="text-xs text-muted-foreground">
              Donde el deudor deposita el capital del Reconocimiento de Deuda. Es por
              empresa: la titular de la cuenta es la acreedora del convenio.
            </p>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        Agregar empresa
      </Button>
    </div>
  );
}
