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
} from "@/lib/domain/escritos-config";
import { EscritosConfigForm } from "./escritos-config-form";
import { type CourtEntry } from "@/lib/data/juzgados";
import { SoloDueno } from "./solo-dueno";
import { updateEstudio } from "./actions";

export function ConfiguracionTab({
  nombre,
  config,
  isHead,
  courtIndex,
}: {
  nombre: string;
  config: EstudioEscritosConfig;
  isHead: boolean;
  courtIndex: CourtEntry[];
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
