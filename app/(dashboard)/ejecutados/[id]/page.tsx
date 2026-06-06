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
import { getConfiguredEmpresas } from "@/lib/domain/escritos-config";
import { EjecutadoFormFields } from "../ejecutado-form-fields";
import { JuzgadoInfoCard } from "../juzgado-info-card";
import { getById } from "@/lib/data/ejecutados";
import { getCourtIndex, getById as getJuzgadoById } from "@/lib/data/juzgados";
import { getEscritosConfig, getMembership, listMembers } from "@/lib/data/estudio";
import { requireUser } from "@/lib/data/auth";
import { updateEjecutado, archiveEjecutado, delegateEjecutado } from "./actions";
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
  const ejecutado = await getById(supabase, id);

  if (!ejecutado) notFound();

  const escritosConfig = await getEscritosConfig(supabase, ejecutado.estudio_id);
  const empresas = getConfiguredEmpresas(escritosConfig);
  const courtIndex = await getCourtIndex(supabase);
  const juzgado = ejecutado.juzgado_id
    ? await getJuzgadoById(supabase, ejecutado.juzgado_id)
    : null;

  // Delegation is head-only. Resolve head status + the estudio's members for the
  // "Delegar a" select (members can only reach their own cases anyway).
  const user = await requireUser(supabase);
  const membership = await getMembership(supabase, user.id);
  const isHead = membership?.role === "head";
  const members = isHead ? await listMembers(supabase) : [];

  const updateAction = updateEjecutado.bind(null, id);
  const archiveAction = archiveEjecutado.bind(null, id);
  const delegateAction = delegateEjecutado.bind(null, id);

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
              courtIndex={courtIndex}
              empresas={empresas}
            />
          </CardContent>

          <CardFooter>
            <Button type="submit">Guardar cambios</Button>
          </CardFooter>
        </form>
      </Card>

      <JuzgadoInfoCard juzgado={juzgado} />

      {isHead && (
        <Card>
          <CardHeader>
            <CardTitle>Delegar</CardTitle>
            <CardDescription>
              Asigná este ejecutado a un miembro del estudio. Solo el head y el miembro
              asignado pueden verlo.
            </CardDescription>
          </CardHeader>
          <form action={delegateAction}>
            <CardContent>
              <select
                name="assigned_to"
                defaultValue={ejecutado.assigned_to_user_id ?? ""}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Sin delegar (solo head)</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.nombre?.trim() ? m.nombre : m.email}
                    {m.role === "head" ? " (head)" : ""}
                  </option>
                ))}
              </select>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="outline">
                Guardar delegación
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <LiquidacionesSection ejecutadoId={id} />
      <EscritosSection ejecutadoId={id} />
      <HonorariosCard ejecutadoId={id} />
      <CobrosCard ejecutadoId={id} />
    </div>
  );
}