import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  CUENTA_HONORARIOS,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { DomiciliosEditor } from "./domicilios-editor";
import { EmpresasEditor } from "./empresas-editor";
import { SoloDueno } from "./solo-dueno";
import { EncargadoEditor } from "./encargado-editor";
import { updateEstudio, updateEstudioEscritosConfig } from "./actions";

export function ConfiguracionTab({
  nombre,
  config,
  isHead,
}: {
  nombre: string;
  config: EstudioEscritosConfig;
  isHead: boolean;
}) {
  if (!isHead) {
    return <SoloDueno />;
  }

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
          <form action={updateEstudioEscritosConfig} className="space-y-6">
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
              <EncargadoEditor initial={config.encargado ?? {}} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuenta_honorarios">Cuenta de honorarios</Label>
              <Textarea
                id="cuenta_honorarios"
                name="cuenta_honorarios"
                rows={3}
                defaultValue={config.cuenta_honorarios ?? ""}
                placeholder={CUENTA_HONORARIOS}
              />
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
              <EmpresasEditor initial={initialEmpresas} />
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
              <DomiciliosEditor initial={initialDomicilios} />
            </div>
            </div>
            </div>

            <Button type="submit">Guardar configuración</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
