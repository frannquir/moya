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
import { CodemandadosCard } from "./codemandados-card";
import { DemandaCard } from "./demanda-card";
import { updateDemandaDatos } from "./demanda-actions";
import { regenerarDemanda } from "./escritos-actions";
import { getUltimaDemanda, loadPartes } from "@/lib/data/escrito-render";
import { avisosDePartes } from "@/lib/domain/cautelar";
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

  // Transfer targets exclude whoever already owns the case (transferring to the
  // current owner is a no-op) and include the head, so the head can pull any
  // member's case into their own. No targets ⇒ a solo estudio ⇒ prompt to invite.
  const currentOwner =
    members.find((m) => m.user_id === ejecutado.assigned_to_user_id) ?? null;
  const transferTargets = members.filter(
    (m) => m.user_id !== ejecutado.assigned_to_user_id,
  );

  const updateAction = updateEjecutado.bind(null, id);
  const archiveAction = archiveEjecutado.bind(null, id);
  const delegateAction = delegateEjecutado.bind(null, id);
  const demandaAction = updateDemandaDatos.bind(null, id);
  const regenerarAction = regenerarDemanda.bind(null, id);

  // Only for the Demanda card, so only loaded when there is one to render.
  const esDemanda = ejecutado.origen === "demanda";
  const [ultimaDemanda, partesDemanda] = esDemanda
    ? await Promise.all([
        getUltimaDemanda(supabase, id),
        loadPartes(supabase, ejecutado).then((r) => r.partes),
      ])
    : [null, []];

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
              Transferí este ejecutado a otro miembro del estudio. Solo el head y el
              miembro asignado pueden verlo.
            </CardDescription>
          </CardHeader>
          {transferTargets.length === 0 ? (
            <CardContent className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                {currentOwner
                  ? `Asignado a ${currentOwner.nombre?.trim() ? currentOwner.nombre : currentOwner.email}.`
                  : "Sin delegar (solo head)."}
              </p>
              <p>
                No hay otros miembros para asignar.{" "}
                <Link href="/estudio" className="font-medium hover:underline">
                  ¡Agregá más miembros!
                </Link>
              </p>
            </CardContent>
          ) : (
            <form action={delegateAction}>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {currentOwner
                    ? `Asignado actualmente a ${currentOwner.nombre?.trim() ? currentOwner.nombre : currentOwner.email}.`
                    : "Sin delegar (solo head)."}
                </p>
                <select
                  name="assigned_to"
                  defaultValue={transferTargets[0]?.user_id ?? ""}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {transferTargets.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.nombre?.trim() ? m.nombre : m.email}
                      {m.user_id === user.id
                        ? " (vos)"
                        : m.role === "head"
                          ? " (head)"
                          : ""}
                    </option>
                  ))}
                  {/* Pull the case back to head-only, but only if it's currently
                      delegated — when it's already head-only this is a no-op. */}
                  {currentOwner && (
                    <option value="">Sin delegar (solo head)</option>
                  )}
                </select>
              </CardContent>
              <CardFooter>
                <Button type="submit" variant="outline">
                  Reasignar
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      )}

      <CodemandadosCard ejecutadoId={id} />

      {/* Only for cases started from "Iniciar demanda" - a migrated or manually
          loaded case has none of these fields. */}
      {esDemanda && (
        <DemandaCard
          updateAction={demandaAction}
          regenerarAction={regenerarAction}
          ultimaDemanda={ultimaDemanda}
          avisos={avisosDePartes(partesDemanda)}
          initial={{
            trabaja: ejecutado.trabaja === true,
            empleador_nombre: ejecutado.empleador_nombre,
            empleador_cuit: ejecutado.empleador_cuit,
            empleador_domicilio: ejecutado.empleador_domicilio,
            empleador_telefono: ejecutado.empleador_telefono,
            tarjeta_cabal: ejecutado.tarjeta_cabal,
            cuenta_cliper: ejecutado.cuenta_cliper,
            fecha_contrato: ejecutado.fecha_contrato,
          }}
        />
      )}

      <LiquidacionesSection ejecutadoId={id} />
      <EscritosSection ejecutadoId={id} />
      <HonorariosCard ejecutadoId={id} />
      <CobrosCard ejecutadoId={id} />
    </div>
  );
}