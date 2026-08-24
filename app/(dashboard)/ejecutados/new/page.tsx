import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  getConfiguredEmpresas,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { getCourtIndex } from "@/lib/data/juzgados";
import { type Tables } from "@/lib/supabase/db-helpers";
import {
  IdentidadFields,
  ExpedienteFields,
  FinancieroFields,
  MedidaCautelarFields,
  NotasFields,
} from "../ejecutado-form-fields";
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo ejecutado</h1>
        <p className="text-sm text-muted-foreground">
          Los campos obligatorios son el demandado y, si cargás CUIL, que sea válido.
        </p>
      </div>

      {/*
        Same 2/3 + 1/3 distribution as the detail page. The left column is what
        you always fill in - who the debtor is, the expediente, the numbers. The
        rail holds the parts you often do not know yet when the case is created:
        the medida cautelar is usually decided later, and observaciones are
        optional. Actions live at the top of the rail and stick, because a
        full-width form is tall enough that a footer button would be off screen.

        One <form>, two columns: the grid is inside it, so every field posts
        together regardless of which column it renders in.
      */}
      <form action={createEjecutado}>
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

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Datos del ejecutado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <IdentidadFields ejecutado={prefill} />
                <ExpedienteFields
                  ejecutado={prefill}
                  courtIndex={courtIndex}
                  empresas={empresas}
                />
                <FinancieroFields ejecutado={prefill} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {/* sticky needs a scroll range to work in, which the stretched grid
                item gives it: the column is as tall as the left one. */}
            <Card className="sticky top-6 z-10">
              <CardContent className="flex flex-col gap-2 pt-6">
                <Button type="submit" name="intent" value="activo">
                  Crear ejecutado
                </Button>
                <Button type="submit" name="intent" value="borrador" variant="secondary">
                  Guardar como borrador
                </Button>
                <Button variant="ghost" asChild type="button">
                  <Link href="/ejecutados">Cancelar</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Medida cautelar</CardTitle>
                <CardDescription>
                  Se puede dejar sin definir y completar cuando el juzgado la provea.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MedidaCautelarFields ejecutado={prefill} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <NotasFields ejecutado={prefill} />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
