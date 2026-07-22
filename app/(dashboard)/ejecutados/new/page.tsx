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
  getConfiguredEmpresas,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { getCourtIndex } from "@/lib/data/juzgados";
import { type Tables } from "@/lib/supabase/db-helpers";
import { EjecutadoFormFields } from "../ejecutado-form-fields";
import { createEjecutado } from "./actions";

// Prefill params arrive from the /mail/sin-asignar "Crear ejecutado" link.
// cluster_causa / cluster_localidad are passed through hidden inputs so the create
// action can recompute the cluster and attach its mail.
type NewSearchParams = {
  nombre?: string;
  numero_expediente?: string;
  departamento?: string;
  juzgado_id?: string;
  cluster_causa?: string;
  cluster_localidad?: string;
};

export default async function NewEjecutadoPage({
  searchParams,
}: {
  searchParams: Promise<NewSearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: estudioRow } = await supabase
    .from("estudios")
    .select("escritos_config")
    .maybeSingle();
  const config = (estudioRow?.escritos_config ?? {}) as EstudioEscritosConfig;
  const empresas = getConfiguredEmpresas(config);
  const courtIndex = await getCourtIndex(supabase);

  // Build a partial ejecutado from the prefill params; EjecutadoFormFields already
  // reads defaults off its `ejecutado` prop. Null when there is nothing to prefill,
  // so a plain "Nuevo ejecutado" navigation behaves exactly as before.
  const hasPrefill =
    !!params.nombre ||
    !!params.numero_expediente ||
    !!params.departamento ||
    !!params.juzgado_id;
  const prefill = hasPrefill
    ? ({
        nombre: params.nombre ?? "",
        numero_expediente: params.numero_expediente ?? "",
        departamento: params.departamento ?? "",
        juzgado_id: params.juzgado_id ?? null,
        juzgado: "",
      } as Partial<Tables<"ejecutados">> as Tables<"ejecutados">)
    : null;

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo ejecutado</CardTitle>
        </CardHeader>
        <form action={createEjecutado}>
          <CardContent className="space-y-4">
            {params.cluster_causa && (
              <input type="hidden" name="cluster_causa" value={params.cluster_causa} />
            )}
            {params.cluster_localidad && (
              <input
                type="hidden"
                name="cluster_localidad"
                value={params.cluster_localidad}
              />
            )}
            <EjecutadoFormFields
              ejecutado={prefill}
              courtIndex={courtIndex}
              empresas={empresas}
            />
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
