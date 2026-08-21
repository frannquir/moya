"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CuilInput } from "@/components/cuil-input";
import { onlyDigits, type PartyFields } from "@/lib/domain/demanda";

/**
 * The identity + employment block one party contributes to a demanda. Controlled,
 * so the demanda form can mirror it into its localStorage draft; when `namePrefix`
 * is set it also emits named inputs, which is how the codemandado cards on the
 * ejecutado page post to a server action.
 *
 * The trabaja switch is paired with a hidden input carrying an explicit
 * "true"/"false": Radix omits an unchecked switch from FormData entirely, and an
 * absent field is indistinguishable from a field the form never had.
 */
export function PartyFieldsBlock({
  value,
  onChange,
  namePrefix,
  idPrefix,
  showTarjeta = true,
  nombreLabel = "Nombre",
}: {
  value: PartyFields;
  onChange: (next: PartyFields) => void;
  namePrefix?: string;
  idPrefix: string;
  showTarjeta?: boolean;
  nombreLabel?: string;
}) {
  const set = <K extends keyof PartyFields>(key: K, next: PartyFields[K]) =>
    onChange({ ...value, [key]: next });

  // undefined namePrefix -> no name attributes at all (the demanda form serializes
  // its codemandados to JSON instead of posting them as fields).
  const name = (k: string) => (namePrefix === undefined ? undefined : `${namePrefix}${k}`);
  const id = (k: string) => `${idPrefix}-${k}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={id("nombre")}>{nombreLabel} *</Label>
        <Input
          id={id("nombre")}
          name={name("nombre")}
          value={value.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id("cuil")}>CUIL</Label>
          <CuilInput
            id={id("cuil")}
            name={name("cuil")}
            value={value.cuil}
            onValueChange={(next) => set("cuil", next)}
            showDni
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("telefono")}>Teléfono</Label>
          <Input
            id={id("telefono")}
            name={name("telefono")}
            value={value.telefono}
            onChange={(e) => set("telefono", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("domicilio")}>Domicilio</Label>
        <Input
          id={id("domicilio")}
          name={name("domicilio")}
          value={value.domicilio}
          onChange={(e) => set("domicilio", e.target.value)}
        />
      </div>

      {showTarjeta && (
        <div className="space-y-2">
          <Label htmlFor={id("tarjeta_cabal")}>Tarjeta Cabal</Label>
          <Input
            id={id("tarjeta_cabal")}
            name={name("tarjeta_cabal")}
            value={value.tarjeta_cabal}
            onChange={(e) => set("tarjeta_cabal", onlyDigits(e.target.value))}
            inputMode="numeric"
            placeholder="Solo números"
          />
        </div>
      )}

      <div className="flex items-center gap-3 rounded-md border p-3">
        <Switch
          id={id("trabaja")}
          checked={value.trabaja}
          onCheckedChange={(checked) => set("trabaja", checked === true)}
        />
        <Label htmlFor={id("trabaja")} className="cursor-pointer">
          Trabaja en relación de dependencia
        </Label>
        {name("trabaja") && (
          <input type="hidden" name={name("trabaja")} value={value.trabaja ? "true" : "false"} />
        )}
      </div>

      {value.trabaja && (
        <div className="space-y-4 rounded-md border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            Datos del empleador — se imprimen en la medida cautelar.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={id("empleador_nombre")}>Empleador *</Label>
              <Input
                id={id("empleador_nombre")}
                name={name("empleador_nombre")}
                value={value.empleador_nombre}
                onChange={(e) => set("empleador_nombre", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("empleador_cuit")}>CUIT del empleador *</Label>
              <CuilInput
                id={id("empleador_cuit")}
                name={name("empleador_cuit")}
                value={value.empleador_cuit}
                onValueChange={(next) => set("empleador_cuit", next)}
                placeholder="30-70123456-8"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={id("empleador_domicilio")}>Domicilio del empleador</Label>
              <Input
                id={id("empleador_domicilio")}
                name={name("empleador_domicilio")}
                value={value.empleador_domicilio}
                onChange={(e) => set("empleador_domicilio", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("empleador_telefono")}>Teléfono del empleador</Label>
              <Input
                id={id("empleador_telefono")}
                name={name("empleador_telefono")}
                value={value.empleador_telefono}
                onChange={(e) => set("empleador_telefono", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
