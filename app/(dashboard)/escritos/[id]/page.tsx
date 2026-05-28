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
} from "@/components/ui/card";
import { EscritoEditor } from "./escrito-editor";
import { updateEscrito, archiveEscrito } from "./actions";

export default async function EscritoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: escrito } = await supabase
    .from("escritos")
    .select("*, ejecutado:ejecutados(id, nombre)")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (!escrito) notFound();

  const ejecutado = Array.isArray(escrito.ejecutado)
    ? escrito.ejecutado[0]
    : escrito.ejecutado;

  const saveAction = updateEscrito.bind(null, id);
  const archiveAction = archiveEscrito.bind(null, id);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/escritos"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Escritos
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{escrito.titulo}</h1>
          {ejecutado && (
            <p className="text-sm text-muted-foreground">
              Ejecutado:{" "}
              <Link
                href={`/ejecutados/${ejecutado.id}`}
                className="hover:underline"
              >
                {ejecutado.nombre}
              </Link>
            </p>
          )}
        </div>
        <form action={archiveAction}>
          <Button type="submit" variant="outline">
            Archivar
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documento</CardTitle>
          <CardDescription>
            Editá el texto, completá los datos faltantes y copialo para
            presentarlo. Los cambios se guardan al hacer clic en «Guardar».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EscritoEditor
            initialTitulo={escrito.titulo}
            initialContenido={escrito.contenido}
            saveAction={saveAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}
