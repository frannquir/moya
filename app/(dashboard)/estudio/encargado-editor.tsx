"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CuilInput } from "@/components/cuil-input";
import { ABOGADO_DEFAULT, type AbogadoConfig } from "@/lib/domain/escritos-config";
import { CampoError, type ErroresPorCampo } from "./campo-error";
import { useState } from "react";

const IVA_OPTIONS = [
  "Responsable Inscripto",
  "Monotributista",
  "Exento",
  "Consumidor Final",
] as const;

/**
 * The apoderado every escrito is presented by. This is the estudio's owner, not
 * whoever happens to click generate — the head is a lawyer who works for the
 * owner, and an escrito must not name them as apoderado.
 *
 * Each field falls back to a visible placeholder in the generated text, so a
 * half-filled block produces "Tº __ Fº ___" rather than a hole.
 */
export function EncargadoEditor({
  initial,
  errorDe,
}: {
  initial: Partial<AbogadoConfig>;
  /** Per-field messages from the last save; the key is left as it was stored. */
  errorDe?: ErroresPorCampo;
}) {
  const [v, setV] = useState<Partial<AbogadoConfig>>(initial);
  const error = (campo: string) => errorDe?.(campo);
  const set = (key: keyof AbogadoConfig, value: string) =>
    setV((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-3">
      {/* Serialized for the server action; the visible inputs are controlled. */}
      <input type="hidden" name="encargado_json" value={JSON.stringify(v)} />

      <div className="space-y-1">
        <Label htmlFor="enc-nombre">Nombre y apellido</Label>
        <Input
          id="enc-nombre"
          value={v.nombre ?? ""}
          onChange={(e) => set("nombre", e.target.value)}
          placeholder={ABOGADO_DEFAULT.nombre}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="enc-matricula">Matrícula</Label>
        <Input
          id="enc-matricula"
          value={v.matricula ?? ""}
          onChange={(e) => set("matricula", e.target.value)}
          placeholder={ABOGADO_DEFAULT.matricula}
        />
      </div>

      <div className="@container grid grid-cols-1 gap-2 @xs:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="enc-legajo">Legajo previsional</Label>
          <Input
            id="enc-legajo"
            value={v.legajo ?? ""}
            onChange={(e) => set("legajo", e.target.value)}
            placeholder={ABOGADO_DEFAULT.legajo}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="enc-cuit">CUIT</Label>
          <CuilInput
            id="enc-cuit"
            value={v.cuit ?? ""}
            onValueChange={(next) => set("cuit", next)}
            placeholder={ABOGADO_DEFAULT.cuit}
            aria-invalid={error("encargado.cuit") ? true : undefined}
          />
          <CampoError mensaje={error("encargado.cuit")} />
        </div>
      </div>

      <div className="@container grid grid-cols-1 gap-2 @xs:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="enc-ibm">IBM</Label>
          <Input
            id="enc-ibm"
            value={v.ibm ?? ""}
            onChange={(e) => set("ibm", e.target.value)}
            placeholder={ABOGADO_DEFAULT.ibm}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="enc-iva">Condición frente al IVA</Label>
          <Select
            value={v.ivaCondicion || "Responsable Inscripto"}
            onValueChange={(next) => set("ivaCondicion", next)}
          >
            <SelectTrigger id="enc-iva" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IVA_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="@container grid grid-cols-1 gap-2 @xs:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="enc-dom-electronico">Domicilio electrónico</Label>
          <Input
            id="enc-dom-electronico"
            value={v.domicilioElectronico ?? ""}
            onChange={(e) => set("domicilioElectronico", e.target.value)}
            placeholder={ABOGADO_DEFAULT.domicilioElectronico}
            aria-invalid={error("encargado.domicilioElectronico") ? true : undefined}
          />
          <CampoError mensaje={error("encargado.domicilioElectronico")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="enc-telefono">Teléfono de contacto</Label>
          <Input
            id="enc-telefono"
            value={v.telefono ?? ""}
            onChange={(e) => set("telefono", e.target.value)}
            placeholder={ABOGADO_DEFAULT.telefono}
          />
        </div>
      </div>

      {/* A real inbox, unlike the domicilio electrónico above — that one is the
          SCBA notification address and nobody reads it. The convenio asks the
          debtor to send the deposit receipt here. */}
      <div className="space-y-1">
        <Label htmlFor="enc-email">Correo del estudio</Label>
        <Input
          id="enc-email"
          type="email"
          value={v.email ?? ""}
          onChange={(e) => set("email", e.target.value)}
          placeholder="estudio@ejemplo.com"
        />
        <p className="text-xs text-muted-foreground">
          Adonde el deudor manda el comprobante de pago del convenio. Junto con el
          teléfono de contacto, es la vía que imprime el Reconocimiento de Deuda.
        </p>
      </div>
    </div>
  );
}
