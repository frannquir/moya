"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CUENTA_HONORARIOS_DEFAULT,
  type AbogadoConfig,
  type CuentaHonorariosConfig,
} from "@/lib/domain/escritos-config";
import { DomiciliosEditor } from "./domicilios-editor";
import { EmpresasEditor } from "./empresas-editor";
import { EncargadoEditor } from "./encargado-editor";
import { JuecesRecusadosEditor, type RecusadoRow } from "./jueces-recusados-editor";
import { type CourtEntry } from "@/lib/data/juzgados";
import {
  updateEstudioEscritosConfig,
  type EscritosConfigState,
} from "./actions";

type EmpresaRow = {
  clave: string;
  razonSocial: string;
  domicilioLegal: string;
  cuit: string;
  cuentaBancaria: string;
};

/**
 * The escritos-config form, split out of ConfiguracionTab so it can hold
 * useActionState.
 *
 * The action used to redirect on a rejected value ("/estudio?msg=cbu_invalido"),
 * which re-rendered the whole tab from the database and reverted every field the
 * head had typed — the cuenta, the encargado, and both catalogues — because of
 * one wrong digit. Returning the errors instead keeps every child editor's state
 * exactly where it was, since nothing unmounts.
 */
export function EscritosConfigForm({
  cuenta,
  encargado,
  empresas,
  domicilios,
  recusados,
  courtIndex,
}: {
  cuenta: CuentaHonorariosConfig;
  encargado: Partial<AbogadoConfig>;
  empresas: EmpresaRow[];
  domicilios: { departamento: string; domicilio: string }[];
  recusados: RecusadoRow[];
  courtIndex: CourtEntry[];
}) {
  const [state, formAction] = useActionState<EscritosConfigState, FormData>(
    updateEstudioEscritosConfig,
    null,
  );

  const errors = state && "errors" in state ? state.errors : [];
  const saved = state !== null && "ok" in state;

  return (
    <form action={formAction} className="space-y-6">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium">
              No se guardó la configuración. Lo que cargaste sigue en el
              formulario: corregí {errors.length === 1 ? "esto" : "estos puntos"}{" "}
              y volvé a guardar.
            </p>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert>
          <AlertDescription>Configuración guardada.</AlertDescription>
        </Alert>
      )}

      {/* Two columns from xl up: who signs and where the firm gets paid on
          the left, the two catalogues on the right. Still one form and one
          Guardar — the split is layout, not scope. */}
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div className="space-y-6">
          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium">Encargado del estudio</div>
              <p className="text-xs text-muted-foreground">
                El apoderado que firma los escritos. Se imprime en el encabezado
                de todos los escritos, sin importar quién los genere.
              </p>
            </div>
            <EncargadoEditor initial={encargado} />
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium">Cuenta de honorarios</div>
              <p className="text-xs text-muted-foreground">
                Adónde se transfieren los honorarios regulados. Los escritos la
                arman en una sola línea.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoCuenta
                name="cuenta_tipo"
                label="Tipo de cuenta"
                defaultValue={cuenta.tipo}
                placeholder={CUENTA_HONORARIOS_DEFAULT.tipo}
              />
              <CampoCuenta
                name="cuenta_banco"
                label="Banco"
                defaultValue={cuenta.banco}
                placeholder="Banco de la Nación Argentina"
              />
              <CampoCuenta
                name="cuenta_numero"
                label="Número de cuenta"
                defaultValue={cuenta.numero}
                placeholder={CUENTA_HONORARIOS_DEFAULT.numero}
              />
              <CampoCuenta
                name="cuenta_cbu"
                label="CBU"
                defaultValue={cuenta.cbu}
                placeholder="22 dígitos"
                inputMode="numeric"
              />
              <CampoCuenta
                name="cuenta_alias"
                label="Alias"
                defaultValue={cuenta.alias}
                placeholder={CUENTA_HONORARIOS_DEFAULT.alias}
              />
              <CampoCuenta
                name="cuenta_dni"
                label="DNI del titular"
                defaultValue={cuenta.dni}
                placeholder={CUENTA_HONORARIOS_DEFAULT.dni}
                inputMode="numeric"
              />
              <div className="sm:col-span-2">
                <CampoCuenta
                  name="cuenta_titular"
                  label="Titular"
                  defaultValue={cuenta.titular}
                  placeholder={CUENTA_HONORARIOS_DEFAULT.titular}
                />
              </div>
            </div>
            {/* Keeps a value written before the split from being dropped. */}
            <input type="hidden" name="cuenta_texto" defaultValue={cuenta.texto ?? ""} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium">Empresas</div>
              <p className="text-xs text-muted-foreground">
                Las empresas disponibles al cargar un ejecutado. La clave es lo
                que se guarda en el ejecutado; la razón social, domicilio y CUIT
                se usan en el encabezado.
              </p>
            </div>
            <EmpresasEditor initial={empresas} />
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium">
                Domicilios procesales por departamento
              </div>
              <p className="text-xs text-muted-foreground">
                Estos son los departamentos disponibles al cargar un ejecutado.
                Agregá los que use el estudio.
              </p>
            </div>
            <DomiciliosEditor initial={domicilios} />
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium">Jueces recusados</div>
              <p className="text-xs text-muted-foreground">
                El apartado «Recusa sin expresión de causa» se imprime solo en las
                demandas cuyo juzgado esté en esta lista, con el nombre que cargues
                acá. Si la lista está vacía, ninguna demanda lo incluye. Solo
                juzgados civiles y comerciales.
              </p>
            </div>
            <JuecesRecusadosEditor initial={recusados} courtIndex={courtIndex} />
          </div>
        </div>
      </div>

      <Button type="submit">Guardar configuración</Button>
    </form>
  );
}

function CampoCuenta({
  name,
  label,
  defaultValue,
  placeholder,
  inputMode,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  inputMode?: "numeric";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </div>
  );
}
