import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getCurrentEstudioId } from "@/lib/data/auth";
import { getMembership } from "@/lib/data/estudio";
import { listUnassignedEmails } from "@/lib/data/mail";
import { getCourtIndex, type CourtEntry } from "@/lib/data/juzgados";
import { localidadMatch } from "@/lib/domain/mail-match";
import { normalizeNumeroExpediente } from "@/lib/domain/ejecutado";
import { clusterUnassigned, type MailCluster } from "@/lib/domain/mail-cluster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatArDate } from "@/lib/domain/dates";

// Resolve the concrete juzgado for a cluster (Civil y Comercial only — Paz courts
// have no number to match on), reusing the matcher's mojibake-tolerant locality
// compare. Returns the clean court entry so we can prefill a real departamento.
function resolveCourt(
  courtIndex: CourtEntry[],
  cluster: MailCluster,
): CourtEntry | null {
  if (cluster.numero == null || !cluster.localidad) return null;
  return (
    courtIndex.find(
      (e) =>
        e.tipo === "Juzgado Civil y Comercial" &&
        e.numero === cluster.numero &&
        localidadMatch(e.departamento, cluster.localidad),
    ) ?? null
  );
}

function createEjecutadoHref(
  cluster: MailCluster,
  court: CourtEntry | null,
): string {
  const params = new URLSearchParams();
  if (cluster.demandado) params.set("nombre", cluster.demandado);
  params.set(
    "numero_expediente",
    normalizeNumeroExpediente(
      cluster.año ? `${cluster.causa}/${cluster.año}` : cluster.causa,
    ),
  );
  // Prefer the clean seat city from the matched court; fall back to the parsed
  // (possibly mojibake'd) locality so the field is at least populated.
  const departamento = court?.departamento ?? cluster.localidad ?? "";
  if (departamento) params.set("departamento", departamento);
  if (court) params.set("juzgado_id", court.juzgadoId);
  // Passthroughs so createEjecutado can recompute and attach this cluster's mail.
  params.set("cluster_causa", cluster.causa);
  if (cluster.localidad) params.set("cluster_localidad", cluster.localidad);
  return `/ejecutados/new?${params.toString()}`;
}

function courtLabel(cluster: MailCluster): string | null {
  if (!cluster.tipo) return null;
  return cluster.numero != null ? `${cluster.tipo} N° ${cluster.numero}` : cluster.tipo;
}

// firstDate/lastDate are full received_at timestamps; formatArDate's string path
// expects a date-only value, so hand it a Date (its Date path formats correctly).
function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

export default async function UnassignedMailPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const membership = await getMembership(supabase, user.id);
  // Head-only: members never see the firm-wide gap of unassigned mail.
  if (membership?.role !== "head") notFound();

  const estudioId = await getCurrentEstudioId(supabase);
  const [emails, courtIndex] = await Promise.all([
    listUnassignedEmails(supabase, estudioId),
    getCourtIndex(supabase),
  ]);

  const clusters = clusterUnassigned(emails);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Correos sin asignar</h1>
          <p className="text-sm text-muted-foreground">
            Causas con correo de la MEV pero sin ejecutado cargado. Creá el
            ejecutado de cada una para vincular su correo.
          </p>
        </div>
        <Link href="/mail" className="text-sm text-muted-foreground hover:underline">
          ← Volver al correo
        </Link>
      </div>

      {clusters.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          No hay correos sin asignar. Todo el correo MEV está asignado.
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {clusters.length} {clusters.length === 1 ? "causa" : "causas"} sin
            ejecutado. Revisá los datos antes de guardar: algunos nombres pueden
            venir con errores de codificación.
          </p>
          <div className="space-y-3">
            {clusters.map((cluster) => {
              const court = resolveCourt(courtIndex, cluster);
              const label = courtLabel(cluster);
              return (
                <Card key={cluster.key} size="sm">
                  <CardHeader>
                    <CardTitle>
                      {cluster.demandado ?? `Causa ${cluster.causa}`}
                    </CardTitle>
                    <CardDescription>
                      Causa {cluster.causa}
                      {cluster.año ? `/${cluster.año}` : ""}
                      {cluster.localidad ? ` · ${cluster.localidad}` : ""}
                      {label ? ` · ${label}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      {cluster.count}{" "}
                      {cluster.count === 1 ? "correo" : "correos"} ·{" "}
                      {formatArDate(toDate(cluster.firstDate))} –{" "}
                      {formatArDate(toDate(cluster.lastDate))}
                    </p>
                    {cluster.sampleSubjects.map((subject, i) => (
                      <p key={i} className="truncate">
                        {subject}
                      </p>
                    ))}
                  </CardContent>
                  <CardFooter className="justify-between">
                    <Badge variant="secondary">{cluster.count}</Badge>
                    <Button asChild size="sm">
                      <Link href={createEjecutadoHref(cluster, court)}>
                        Crear ejecutado
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
