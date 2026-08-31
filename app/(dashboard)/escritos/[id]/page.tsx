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
import { getById as getJuzgadoById } from "@/lib/data/juzgados";
import { requireUser } from "@/lib/data/auth";
import { getMembership } from "@/lib/data/estudio";
import { JuzgadoInfoCard } from "@/app/(dashboard)/ejecutados/juzgado-info-card";

export default async function EscritoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: escrito } = await supabase
    .from("escritos")
    .select("*, ejecutado:ejecutados(id, nombre, juzgado_id)")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (!escrito) notFound();

  const ejecutado = Array.isArray(escrito.ejecutado)
    ? escrito.ejecutado[0]
    : escrito.ejecutado;

  // Only to decide whether an estudio-config gap gets a link or a "lo carga el
  // head" note — a member sent to /estudio would only meet a refusal.
  const user = await requireUser(supabase);
  const membership = await getMembership(supabase, user.id);
  const isHead = membership?.role === "head";

  const juzgado = ejecutado?.juzgado_id
    ? await getJuzgadoById(supabase, ejecutado.juzgado_id)
    : null;

  const saveAction = updateEscrito.bind(null, id);
  const archiveAction = archiveEscrito.bind(null, id);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/escritos"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Escritos
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{escrito.titulo}</h1>
          {ejecutado && (
            <p className="text-sm text-muted-foreground">{ejecutado.nombre}</p>
          )}
        </div>
        {/* "Ir al caso" is a button, not the grey line it used to be. A demanda
            lands the lawyer here, and every field this document prints is edited
            back on the case — including the ones that resolved to the WRONG value
            rather than to a marker, which the "faltan completar" badges below
            cannot know about. */}
        <div className="flex flex-wrap items-center gap-2">
          {ejecutado && (
            <Button asChild>
              <Link href={`/ejecutados/${ejecutado.id}`}>Ir al caso</Link>
            </Button>
          )}
          <form action={archiveAction}>
            <Button type="submit" variant="outline">
              Archivar
            </Button>
          </form>
        </div>
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
            ejecutadoId={ejecutado?.id ?? null}
            isHead={isHead}
            initialTitulo={escrito.titulo}
            initialContenido={escrito.contenido}
            saveAction={saveAction}
          />
        </CardContent>
      </Card>

      <JuzgadoInfoCard juzgado={juzgado} />
    </div>
  );
}
