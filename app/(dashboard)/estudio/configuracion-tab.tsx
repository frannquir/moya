import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  cuentaHonorariosPartes,
  type EstudioEscritosConfig,
  type MiembroAutorizado,
} from "@/lib/domain/escritos-config";
import { EscritosConfigForm } from "./escritos-config-form";
import { type CourtEntry } from "@/lib/data/juzgados";
import { SoloDueno } from "./solo-dueno";
import { updateEstudio } from "./actions";
import { JusForm, TasasForm } from "./valores-form";
import { type JusConfig, type ConfigHistorialEntry } from "@/lib/data/config";
import { HistorialValores } from "./historial-valores";
import { getUltimaTasa, type TasaRowFull } from "@/lib/domain/liquidaciones";

export function ConfiguracionTab({
  nombre,
  config,
  isHead,
  courtIndex,
  jus,
  tasas,
  historial,
  miembros,
}: {
  nombre: string;
  config: EstudioEscritosConfig;
  isHead: boolean;
  courtIndex: CourtEntry[];
  jus: JusConfig | null;
  tasas: TasaRowFull[];
  historial: ConfigHistorialEntry[];
  /**
   * Passed down rather than fetched in the client, the same way courtIndex is:
   * the autorizados editor seeds and restores from the member list, and
   * get_estudio_members() is a server-side RPC.
   */
  miembros: MiembroAutorizado[];
}) {
  if (!isHead) {
    return <SoloDueno />;
  }

  const cuenta = cuentaHonorariosPartes(config);
  const initialDomicilios = Object.entries(config.domicilios_procesales ?? {}).map(
    ([departamento, domicilio]) => ({
      departamento,
      domicilio: String(domicilio ?? ""),
    }),
  );

  const initialEmpresas = Object.entries(config.empresas ?? {}).map(
    ([clave, emp]) => ({
      clave,
      razonSocial: emp?.razonSocial ?? "",
      domicilioLegal: emp?.domicilioLegal ?? "",
      cuit: emp?.cuit ?? "",
      cuentaBancaria: emp?.cuentaBancaria ?? "",
    }),
  );

  const initialRecusados = Object.entries(config.jueces_recusados ?? {}).map(
    ([juzgadoId, nombreJuez]) => ({ juzgadoId, nombre: String(nombreJuez ?? "") }),
  );

  // null, not [], when the key is absent: no list of its own is a different
  // state from an empty one, and only the second prints [AUTORIZADOS].
  const initialAutorizados = Array.isArray(config.autorizados)
    ? config.autorizados
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Nombre del estudio</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateEstudio} className="space-y-4">
            {/* Capped: a single short text field stretched across a
                full-width page reads as a mistake, not as generosity. */}
            <div className="max-w-md space-y-2">
              <Label htmlFor="nombre">Nombre del estudio</Label>
              <Input id="nombre" name="nombre" defaultValue={nombre} required />
            </div>
            <Button type="submit">Guardar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valor del JUS</CardTitle>
          <CardDescription>
            Convierte a pesos todo honorario. Es un valor global: lo ven todos los
            estudios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JusForm
            value={jus?.value ?? 0}
            date={jus?.date ?? null}
            updatedAt={jus?.updatedAt ?? null}
            stale={jusEstaViejo(jus)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasas del BCRA</CardTitle>
          <CardDescription>
            Intereses de las liquidaciones. Si falta un mes, la liquidación se corta
            ahí y sale por debajo de lo que corresponde.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TasasForm ultima={getUltimaTasa(tasas)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de valores</CardTitle>
          <CardDescription>
            Cambios del JUS y de las tasas, con quién los hizo. Se puede volver a
            cualquier valor anterior.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HistorialValores entradas={historial} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de escritos</CardTitle>
          <CardDescription>
            Datos del estudio que se usan en los escritos, compartidos por todo
            el estudio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* A client component, because its action returns its errors instead of
              redirecting: a rejected CBU no longer reverts the whole tab. */}
          <EscritosConfigForm
            cuenta={cuenta}
            encargado={config.encargado ?? {}}
            empresas={initialEmpresas}
            domicilios={initialDomicilios}
            recusados={initialRecusados}
            courtIndex={courtIndex}
            autorizados={initialAutorizados}
            miembros={miembros}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Nine months without a touch is not maintenance, it is an oversight: the JUS
// moves a few times a year, so this only fires when it should. Computed here
// and not in the form — reading the clock during a client render is not
// idempotent, and eslint is right to say so.
const NUEVE_MESES_MS = 1000 * 60 * 60 * 24 * 270;

function jusEstaViejo(jus: JusConfig | null): boolean {
  if (!jus?.updatedAt) return false;
  return Date.now() - new Date(jus.updatedAt).getTime() > NUEVE_MESES_MS;
}
