"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CUENTA_HONORARIOS_DEFAULT,
  type AbogadoConfig,
  type AutorizadoConfig,
  type CuentaHonorariosConfig,
  type MiembroAutorizado,
} from "@/lib/domain/escritos-config";
import { AutorizadosEditor } from "./autorizados-editor";
import { DomiciliosEditor } from "./domicilios-editor";
import { EmpresasEditor } from "./empresas-editor";
import { EncargadoEditor } from "./encargado-editor";
import { JuecesRecusadosEditor, type RecusadoRow } from "./jueces-recusados-editor";
import { type CourtEntry } from "@/lib/data/juzgados";
import { CampoError, type ErroresPorCampo } from "./campo-error";
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
  autorizados,
  miembros,
}: {
  cuenta: CuentaHonorariosConfig;
  encargado: Partial<AbogadoConfig>;
  empresas: EmpresaRow[];
  domicilios: { departamento: string; domicilio: string }[];
  recusados: RecusadoRow[];
  courtIndex: CourtEntry[];
  /** null = no list of its own; the estudio's members are used. */
  autorizados: AutorizadoConfig[] | null;
  miembros: MiembroAutorizado[];
}) {
  const [state, formAction] = useActionState<EscritosConfigState, FormData>(
    updateEstudioEscritosConfig,
    null,
  );

  // Gotcha #47: a useActionState result outlives the text it describes. Once the
  // head starts typing again, last save's verdict is about something that is no
  // longer on screen, so it goes away. `onChange` on the form catches every text
  // input; a Radix Select writes through a hidden field and does not bubble one,
  // which is the known edge of this.
  //
  // Adjusted during render rather than in an effect (React's own "adjusting
  // state when a prop changes" pattern): a new action result IS the news, so
  // clearing the flag in an effect would render the stale verdict once first.
  const [editadoDesdeGuardar, setEditadoDesdeGuardar] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(state);
  if (ultimoResultado !== state) {
    setUltimoResultado(state);
    setEditadoDesdeGuardar(false);
  }

  const vigente = state !== null && !editadoDesdeGuardar;
  const errores = vigente ? state.errores : [];
  const guardadoLimpio = vigente && errores.length === 0;

  /** The message for one input, by the anchor the action gave it. */
  const errorDe: ErroresPorCampo = (campo) =>
    errores.find((e) => e.campo === campo)?.mensaje;

  // The alert is at the top of a form long enough that its last editor — jueces
  // recusados — is a screenful below the fold, and a save leaves the page exactly
  // where it was. A head who added a judge, pressed Guardar and saw nothing
  // happen concluded the recusación feature was broken (package A diagnosis,
  // 2026-09-17). So the summary comes to the reader; the detail is next to each
  // input.
  const alerta = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state !== null && state.errores.length > 0) {
      alerta.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [state]);

  return (
    <form
      action={formAction}
      onChange={() => setEditadoDesdeGuardar(true)}
      className="space-y-6"
    >
      {errores.length > 0 && (
        <Alert variant="destructive" ref={alerta}>
          <AlertDescription>
            <p className="font-medium">
              Se guardó todo menos{" "}
              {errores.length === 1 ? "un campo" : `${errores.length} campos`}.
              Cada uno tiene el detalle al lado, y quedó como estaba:
            </p>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {errores.map((e) => (
                <li key={e.campo}>{e.mensaje}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {guardadoLimpio && (
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
            <EncargadoEditor initial={encargado} errorDe={errorDe} />
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium">Autorizados</div>
              <p className="text-xs text-muted-foreground">
                Quiénes quedan autorizados a hacer trámites en la demanda. No
                hace falta que tengan cuenta en Moya: el procurador o el
                empleado de mesa de entradas van acá.
              </p>
            </div>
            <AutorizadosEditor initial={autorizados} miembros={miembros} />
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium">Cuenta de honorarios</div>
              <p className="text-xs text-muted-foreground">
                Adónde se transfieren los honorarios regulados. El CUIT y el
                titular salen del Encargado.
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
                placeholder="Galicia"
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
                error={errorDe("cuenta.cbu")}
              />
              <CampoCuenta
                name="cuenta_alias"
                label="Alias"
                defaultValue={cuenta.alias}
                placeholder={CUENTA_HONORARIOS_DEFAULT.alias}
              />
              {/* Ni DNI ni titular: los dos salen del Encargado de arriba. Un
                  CUIT y un nombre tipeados dos veces son un CUIT y un nombre que
                  pueden no coincidir, y esto se imprime en un escrito. */}
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
            <EmpresasEditor initial={empresas} errorDe={errorDe} />
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
            <JuecesRecusadosEditor
              initial={recusados}
              courtIndex={courtIndex}
              errorDe={errorDe}
            />
          </div>
        </div>
      </div>

      {/* The same news as the alert, at the other end of the form: this button
          is what the head is looking at when the save is rejected, and the alert
          is far enough away that it used to read as "nothing happened". */}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Guardar configuración</Button>
        {errores.length > 0 && (
          <span className="text-sm font-medium text-destructive">
            Se guardó todo menos{" "}
            {errores.length === 1 ? "1 campo" : `${errores.length} campos`}.
          </span>
        )}
        {guardadoLimpio && (
          <span className="text-sm text-muted-foreground">Guardado.</span>
        )}
      </div>
    </form>
  );
}

function CampoCuenta({
  name,
  label,
  defaultValue,
  placeholder,
  inputMode,
  error,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  inputMode?: "numeric";
  error?: string;
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
        aria-invalid={error ? true : undefined}
      />
      <CampoError mensaje={error} />
    </div>
  );
}
