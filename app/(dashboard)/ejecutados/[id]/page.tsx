import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  getConfiguredDepartamentos,
  getConfiguredEmpresas,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { EjecutadoFormFields } from "../ejecutado-form-fields";
import { updateEjecutado, archiveEjecutado } from "./actions";
import { CobrosCard } from "./cobros-card";
import { HonorariosCard } from "./honorarios-card";
import { LiquidacionesSection } from "./liquidaciones-section";
import { EscritosSection } from "./escritos-section";
import { Badge } from "@/components/ui/badge";
import { activarBorrador, moverABorrador } from "../../borradores/actions";

export default async function EjecutadoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: ejecutado } = await supabase
    .from("ejecutados")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (!ejecutado) notFound();

  const { data: estudioRow } = await supabase
    .from("estudios")
    .select("escritos_config")
    .eq("id", ejecutado.estudio_id)
    .maybeSingle();
  const escritosConfig = (estudioRow?.escritos_config ?? {}) as EstudioEscritosConfig;
  const departamentos = getConfiguredDepartamentos(escritosConfig);
  const empresas = getConfiguredEmpresas(escritosConfig);

  const updateAction = updateEjecutado.bind(null, id);
  const archiveAction = archiveEjecutado.bind(null, id);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/ejecutados"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Ejecutados
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-semibold">{ejecutado.nombre}</h1>
            {ejecutado.is_draft && <Badge variant="secondary">Borrador</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ejecutado.is_draft ? (
            <form action={activarBorrador.bind(null, id)}>
              <Button type="submit">Activar</Button>
            </form>
          ) : (
            <form action={moverABorrador.bind(null, id)}>
              <Button type="submit" variant="outline">Mover a borrador</Button>
            </form>
          )}
          <form action={archiveAction}>
            <Button type="submit" variant="outline">Archivar</Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
          <CardDescription>
            Editá los datos del ejecutado. Los cambios se guardan al hacer clic en «Guardar».
          </CardDescription>
        </CardHeader>
        <form action={updateAction}>
          <CardContent className="space-y-4">
            <EjecutadoFormFields
              ejecutado={ejecutado}
              departamentos={departamentos}
              empresas={empresas}
            />
          </CardContent>

          <CardFooter>
            <Button type="submit">Guardar cambios</Button>
          </CardFooter>
        </form>
      </Card>

      <LiquidacionesSection ejecutadoId={id} />
      <EscritosSection ejecutadoId={id} />
      <HonorariosCard ejecutadoId={id} />
      <CobrosCard ejecutadoId={id} />
    </div>
  );
}