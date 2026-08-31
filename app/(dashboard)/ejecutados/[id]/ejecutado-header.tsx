import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CautelarBadge } from "@/components/cautelar-badge";
import { MovimientoBadge } from "@/components/movimiento-badge";
import { formatDni } from "@/lib/domain/cuil";
import { viaOf } from "@/lib/domain/ejecutado";
import { textoDeInactividad, urgenciaDeCaso } from "@/lib/domain/urgencia";
import { type Tables } from "@/lib/supabase/db-helpers";
import { type Juzgado } from "@/lib/data/juzgados";

/** Read-only identity strip, sticky under the app header (h-14). */
export function EjecutadoHeader({
  ejecutado,
  juzgado,
  ownerName,
}: {
  ejecutado: Tables<"ejecutados">;
  juzgado: Juzgado | null;
  ownerName: string | null;
}) {
  const via = viaOf(ejecutado.via);
  const dni = ejecutado.documento ? formatDni(ejecutado.documento) : "";
  const foro = juzgado?.organismo ?? ejecutado.juzgado ?? "";
  const inactividad = textoDeInactividad(ejecutado.updated_at);

  return (
    <header className="sticky top-14 z-30 -mx-6 border-b bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Link
        href="/ejecutados"
        className="text-xs text-muted-foreground hover:underline"
      >
        ← Ejecutados
      </Link>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-heading text-2xl font-semibold">{ejecutado.nombre}</h1>

        {/* Stage and whether it came back are one fact, so MovimientoBadge
            renders them together — and it carries the same colour the case wears
            in the list, so arriving here confirms rather than re-teaches. */}
        {ejecutado.movimiento && (
          <MovimientoBadge
            movimiento={ejecutado.movimiento}
            diligenciada={ejecutado.movimiento_diligenciada}
          />
        )}
        <CautelarBadge
          medida={ejecutado.medida_cautelar}
          estado={ejecutado.medida_cautelar_estado}
          diligenciada={ejecutado.medida_cautelar_diligenciada}
        />
        {via === "extrajudicial" && <Badge variant="accent">Extrajudicial</Badge>}
        {ejecutado.is_draft && <Badge variant="secondary">Borrador</Badge>}
        {ejecutado.archived_at && <Badge variant="warning">Archivado</Badge>}
        {/* Same two thresholds as the list's edge bar. Archived cases are meant
            to sit still, so they are not nagged about it. */}
        {inactividad && !ejecutado.archived_at && (
          <Badge
            variant={
              urgenciaDeCaso(ejecutado.updated_at) === "urgente"
                ? "destructive"
                : "warning"
            }
          >
            {inactividad}
          </Badge>
        )}
      </div>

      <dl className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Dato label="CUIL" value={ejecutado.cuil || (dni && `DNI ${dni}`) || ""} />
        <Dato label="Expte." value={ejecutado.numero_expediente} />
        <Dato label="Juzgado" value={foro} />
        <Dato label="Depto." value={ejecutado.departamento} />
        <Dato label="Empresa" value={ejecutado.empresa} />
        <Dato label="A cargo de" value={ownerName} />
      </dl>
    </header>
  );
}

/** Renders nothing when the value is missing, rather than a dash. */
function Dato({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value.trim() === "") return null;
  return (
    <div className="flex items-center gap-1">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
