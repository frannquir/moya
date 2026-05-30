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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CUENTA_HONORARIOS,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { DomiciliosEditor } from "./domicilios-editor";
import { EmpresasEditor } from "./empresas-editor";
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
    return (
      <Alert>
        <AlertDescription>
          Solo el head del estudio puede editar la configuración.
        </AlertDescription>
      </Alert>
    );
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
            <div className="space-y-2">
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
            Datos del estudio que se usan en el encabezado de los escritos
            (compartidos por todo el estudio). Los datos personales del abogado se
            editan en tu Perfil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateEstudioEscritosConfig} className="space-y-6">
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

            <Button type="submit">Guardar configuración</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
