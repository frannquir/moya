import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  getConfiguredDepartamentos,
  getConfiguredEmpresas,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { EjecutadoFormFields } from "../ejecutado-form-fields";
import { createEjecutado } from "./actions";

export default async function NewEjecutadoPage() {
  const supabase = await createClient();
  const { data: estudioRow } = await supabase
    .from("estudios")
    .select("escritos_config")
    .maybeSingle();
  const config = (estudioRow?.escritos_config ?? {}) as EstudioEscritosConfig;
  const departamentos = getConfiguredDepartamentos(config);
  const empresas = getConfiguredEmpresas(config);

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo ejecutado</CardTitle>
        </CardHeader>
        <form action={createEjecutado}>
          <CardContent className="space-y-4">
            <EjecutadoFormFields departamentos={departamentos} empresas={empresas} />
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button variant="outline" asChild type="button">
              <Link href="/ejecutados">Cancelar</Link>
            </Button>
            <div className="flex gap-2">
              <Button type="submit" name="intent" value="borrador" variant="secondary">
                Guardar como borrador
              </Button>
              <Button type="submit" name="intent" value="activo">
                Crear
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
