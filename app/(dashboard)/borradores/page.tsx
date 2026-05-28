import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activarBorrador } from "./actions";

export default async function BorradoresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: drafts }, { data: profiles }] = await Promise.all([
    supabase
      .from("ejecutados")
      .select("id, nombre, numero_expediente, movimiento, created_at, created_by_user_id")
      .eq("is_draft", true)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("lawyer_profiles").select("user_id, nombre"),
  ]);

  type DraftRow = NonNullable<typeof drafts>[number];

  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.nombre]));
  const myId = user?.id ?? "";


  const groups = new Map<string, DraftRow[]>();
  for (const d of drafts ?? []) {
    const key = d.created_by_user_id ?? "—";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  
  const orderedKeys = [...groups.keys()].sort((a, b) =>
    a === myId ? -1 : b === myId ? 1 : 0,
  );

  const folderLabel = (uid: string) => {
    if (uid === myId) return "Mis borradores";
    const nombre = nameById.get(uid);
    return nombre && nombre.trim() ? nombre : "Otro miembro";
  };

  const total = drafts?.length ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Borradores</h1>
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "borrador" : "borradores"} en el estudio
        </p>
      </div>

      {orderedKeys.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aún no hay borradores. Creá un ejecutado con "Guardar como borrador".
          </CardContent>
        </Card>
      ) : (
        orderedKeys.map((uid) => {
          const items = groups.get(uid)!;
          return (
            <Card key={uid}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {folderLabel(uid)}
                  <Badge variant="outline">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {items.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-6 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{d.nombre}</span>
                          {d.movimiento && (
                            <Badge variant="outline" className="shrink-0">
                              {d.movimiento}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.numero_expediente || "Sin expediente"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/ejecutados/${d.id}`}>Ver</Link>
                        </Button>
                        <form action={activarBorrador.bind(null, d.id)}>
                          <Button type="submit" size="sm">
                            Activar
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}