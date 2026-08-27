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
import {
  IdentidadFields,
  ExpedienteFields,
  MedidaCautelarFields,
  MontosFields,
  NotasFields,
} from "../ejecutado-form-fields";
import { JuzgadoInfoCard } from "../juzgado-info-card";
import { getById } from "@/lib/data/ejecutados";
import { getCourtIndex, getById as getJuzgadoById } from "@/lib/data/juzgados";
import { getEscritosConfig, getMembership, listMembers } from "@/lib/data/estudio";
import { requireUser } from "@/lib/data/auth";
import {
  updateEjecutadoCaso,
  updateEjecutadoCautelar,
  updateEjecutadoMontos,
  archiveEjecutado,
  delegateEjecutado,
} from "./actions";
import { CobrosCard } from "./cobros-card";
import { HonorariosCard } from "./honorarios-card";
import { LiquidacionesSection } from "./liquidaciones-section";
import { EscritosSection } from "./escritos-section";
import { CodemandadosCard } from "./codemandados-card";
import { DemandaCard } from "./demanda-card";
import { ViaCard } from "./via-card";
import { actualizarVia } from "./via-actions";
import { updateDemandaDatos } from "./demanda-actions";
import { regenerarDemanda } from "./escritos-actions";
import { getUltimaDemanda, loadPartes } from "@/lib/data/escrito-render";
import { avisosDePartes } from "@/lib/domain/cautelar";
import { activarBorrador, moverABorrador } from "../../borradores/actions";
import { viaOf } from "@/lib/domain/ejecutado";
import { EjecutadoHeader } from "./ejecutado-header";
import { ResumenCard } from "./resumen-card";

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

  const casoAction = updateEjecutadoCaso.bind(null, id);
  const cautelarAction = updateEjecutadoCautelar.bind(null, id);
  const montosAction = updateEjecutadoMontos.bind(null, id);
  const archiveAction = archiveEjecutado.bind(null, id);
  const delegateAction = delegateEjecutado.bind(null, id);
  const demandaAction = updateDemandaDatos.bind(null, id);
  const regenerarAction = regenerarDemanda.bind(null, id);
  const viaAction = actualizarVia.bind(null, id);

  // Only for the Demanda card, so only loaded when there is one to render.
  const esDemanda = ejecutado.origen === "demanda";
  const [ultimaDemanda, partesDemanda] = esDemanda
    ? await Promise.all([
        getUltimaDemanda(supabase, id),
        loadPartes(supabase, ejecutado).then((r) => r.partes),
      ])
    : [null, []];

  return (
    <div className="space-y-4">
      <EjecutadoHeader
        ejecutado={ejecutado}
        juzgado={juzgado}
        ownerName={currentOwner?.nombre?.trim() || currentOwner?.email || null}
      />

      <div className="flex flex-wrap items-center gap-2">
        {ejecutado.is_draft ? (
          <form action={activarBorrador.bind(null, id)}>
            <Button type="submit" size="sm">Activar</Button>
          </form>
        ) : (
          <form action={moverABorrador.bind(null, id)}>
            <Button type="submit" size="sm" variant="outline">Mover a borrador</Button>
          </form>
        )}
        <form action={archiveAction}>
          <Button type="submit" size="sm" variant="outline">Archivar</Button>
        </form>
      </div>

      {/*
        60/40: the case on the left, the money on the right, so the liquidación's
        inputs sit beside the liquidación itself.

        Each card that saves is its own form over a disjoint column set. They
        cannot share one enclosing form — Codemandados, Demanda and Escritos carry
        forms of their own, and nested forms are invalid HTML — and a partial post
        through the full EjecutadoFormFields shape would blank every column the
        form does not render (gotcha #41).
      */}
      <div className="grid gap-4 xl:grid-cols-5 xl:items-start">
        {/* ---------------- EL CASO ---------------- */}
        <div className="min-w-0 space-y-4 xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Datos del demandado</CardTitle>
              <CardDescription>
                Identidad, contacto y expediente. Los montos se editan en la
                columna de la derecha, junto a la liquidación.
              </CardDescription>
            </CardHeader>
            <form action={casoAction} className="flex flex-col gap-4">
              <CardContent className="space-y-4">
                <IdentidadFields ejecutado={ejecutado} />
                <ExpedienteFields
                  ejecutado={ejecutado}
                  courtIndex={courtIndex}
                  empresas={empresas}
                />
                <NotasFields ejecutado={ejecutado} />
              </CardContent>
              <CardFooter>
                <Button type="submit">Guardar datos</Button>
              </CardFooter>
            </form>
          </Card>

          <CodemandadosCard ejecutadoId={id} />

          <Card>
            <CardHeader>
              <CardTitle>Medida cautelar</CardTitle>
            </CardHeader>
            <form action={cautelarAction} className="flex flex-col gap-4">
              <CardContent>
                <MedidaCautelarFields ejecutado={ejecutado} sinTitulo />
              </CardContent>
              <CardFooter>
                <Button type="submit">Guardar medida</Button>
              </CardFooter>
            </form>
          </Card>

          <EscritosSection ejecutadoId={id} />

          {/* Only for cases started from "Iniciar demanda" - a migrated or
              manually loaded case has none of these fields. */}
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
                fojas_resumenes: ejecutado.fojas_resumenes,
              }}
            />
          )}

          <JuzgadoInfoCard juzgado={juzgado} />

        {isHead && (
          <Card>
            <CardHeader>
              <CardTitle>Delegar</CardTitle>
              <CardDescription>
                Transferí este ejecutado a otro miembro del estudio. Solo el dueño del
                estudio y el miembro asignado pueden verlo.
              </CardDescription>
            </CardHeader>
            {transferTargets.length === 0 ? (
              <CardContent className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  {currentOwner
                    ? `Asignado a ${currentOwner.nombre?.trim() ? currentOwner.nombre : currentOwner.email}.`
                    : "Sin delegar (solo el dueño)."}
                </p>
                <p>
                  No hay otros miembros para asignar.{" "}
                  <Link href="/estudio" className="font-medium hover:underline">
                    ¡Agregá más miembros!
                  </Link>
                </p>
              </CardContent>
            ) : (
              <form action={delegateAction} className="flex flex-col gap-4">
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {currentOwner
                      ? `Asignado actualmente a ${currentOwner.nombre?.trim() ? currentOwner.nombre : currentOwner.email}.`
                      : "Sin delegar (solo el dueño)."}
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
                            ? " (dueño)"
                            : ""}
                      </option>
                    ))}
                    {/* Pull the case back to head-only, but only if it's currently
                        delegated — when it's already head-only this is a no-op. */}
                    {currentOwner && (
                      <option value="">Sin delegar (solo el dueño)</option>
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
        </div>

        {/* ---------------- EL DINERO ---------------- */}
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <ResumenCard ejecutadoId={id} ejecutado={ejecutado} />

          <Card>
            <CardHeader>
              <CardTitle>Montos</CardTitle>
              <CardDescription>
                De acá sale la liquidación. Se recalcula al guardar.
              </CardDescription>
            </CardHeader>
            <form action={montosAction} className="flex flex-col gap-4">
              <CardContent>
                <MontosFields ejecutado={ejecutado} sinTitulo />
              </CardContent>
              <CardFooter>
                <Button type="submit">Guardar y recalcular</Button>
              </CardFooter>
            </form>
          </Card>

          <LiquidacionesSection ejecutadoId={id} />

          {/* Vía lives here because the acuerdo IS money: monto, cuotas and
              vencimiento are what the debtor will actually pay. */}
          <ViaCard
            via={viaOf(ejecutado.via)}
            montoAcuerdo={ejecutado.monto_acuerdo}
            cuotas={ejecutado.cuotas}
            fechaVencimiento={ejecutado.fecha_vencimiento}
            action={viaAction}
          />

          <CobrosCard ejecutadoId={id} />
          <HonorariosCard ejecutadoId={id} />
        </div>
      </div>
    </div>
  );
}
