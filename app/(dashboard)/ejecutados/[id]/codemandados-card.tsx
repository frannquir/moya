import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { listByEjecutado } from "@/lib/data/codemandados";
import { partyFromRow } from "@/lib/domain/demanda";
import { CodemandadoAdder, CodemandadoEditor } from "./codemandado-forms";
import {
  archiveCodemandado,
  createCodemandado,
  updateCodemandado,
} from "./codemandados-actions";

/**
 * One card per codemandado, each openable and editable in place. Server Actions
 * for every mutation - no TanStack Query here (locked decision #6): this surface
 * has neither realtime nor polling.
 */
export async function CodemandadosCard({ ejecutadoId }: { ejecutadoId: string }) {
  const supabase = await createClient();
  const rows = await listByEjecutado(supabase, ejecutadoId);

  const createAction = createCodemandado.bind(null, ejecutadoId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codemandados</CardTitle>
        <CardDescription>
          Titulares adicionales de la tarjeta, solidariamente responsables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin codemandados.</p>
        )}
        {rows.map((row) => (
          <CodemandadoEditor
            key={row.id}
            id={row.id}
            party={partyFromRow(row)}
            updateAction={updateCodemandado.bind(null, ejecutadoId, row.id)}
            archiveAction={archiveCodemandado.bind(null, ejecutadoId, row.id)}
          />
        ))}
        <CodemandadoAdder createAction={createAction} />
      </CardContent>
    </Card>
  );
}
