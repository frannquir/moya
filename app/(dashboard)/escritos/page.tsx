import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function EscritosPage() {
  const supabase = await createClient();

  const { data: escritos, error } = await supabase
    .from("escritos")
    .select("id, titulo, created_at, ejecutado:ejecutados(id, nombre)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Escritos</h1>
        <p className="text-sm text-muted-foreground">
          {escritos?.length ?? 0} escritos generados
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Ejecutado</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {escritos && escritos.length > 0 ? (
              escritos.map((e) => {
                const ejecutado = Array.isArray(e.ejecutado)
                  ? e.ejecutado[0]
                  : e.ejecutado;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      <Link href={`/escritos/${e.id}`} className="hover:underline">
                        {e.titulo || "Sin título"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {ejecutado ? (
                        <Link
                          href={`/ejecutados/${ejecutado.id}`}
                          className="hover:underline"
                        >
                          {ejecutado.nombre}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("es-AR")}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground py-8"
                >
                  Aún no hay escritos. Generá uno desde la ficha de un ejecutado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
