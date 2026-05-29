import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { unarchiveEjecutado } from "../[id]/actions";

export default async function ArchivadosPage() {
  const supabase = await createClient();

  const { data: ejecutados, error } = await supabase
    .from("ejecutados")
    .select("id, nombre, numero_expediente, juzgado, archived_at")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  if (error) throw error;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/ejecutados"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Ejecutados
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Archivados</h1>
          <p className="text-sm text-muted-foreground">
            {ejecutados?.length ?? 0} ejecutados archivados. No aparecen en Cobros,
            Liquidaciones ni Escritos.
          </p>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Expediente</TableHead>
              <TableHead>Juzgado</TableHead>
              <TableHead>Archivado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ejecutados && ejecutados.length > 0 ? (
              ejecutados.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nombre}</TableCell>
                  <TableCell>{e.numero_expediente || "—"}</TableCell>
                  <TableCell>{e.juzgado || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.archived_at
                      ? new Date(e.archived_at).toLocaleDateString("es-AR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={unarchiveEjecutado.bind(null, e.id)}>
                      <Button type="submit" size="sm" variant="outline">
                        Desarchivar
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No hay ejecutados archivados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
