import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type EstudioEscritosConfig } from "@/lib/domain/escritos-config";
import { requireUser } from "@/lib/data/auth";
import { getMembership, listMembers } from "@/lib/data/estudio";
import { getGmailConnection } from "@/lib/data/mail";
import { MiembrosTab, type EstudioMember } from "./miembros-tab";
import { GmailTab } from "./gmail-tab";
import { ConfiguracionTab } from "./configuracion-tab";
import { leaveEstudio } from "./actions";

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  invite_ok: { tone: "ok", text: "Miembro agregado." },
  invite_notfound: { tone: "error", text: "Ese email no tiene cuenta todavía." },
  invite_exists: { tone: "error", text: "Ese usuario ya pertenece a un estudio." },
  invite_empty: { tone: "error", text: "Ingresá un email." },
  remove_ok: { tone: "ok", text: "Miembro quitado." },
  remove_head: { tone: "error", text: "No se puede quitar al head del estudio." },
  leave_head: { tone: "error", text: "Sos head del estudio, no podés salir." },
};

export default async function EstudioPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { msg } = await searchParams;
  const feedback = msg ? MESSAGES[msg] : null;

  const supabase = await createClient();
  const user = await requireUser(supabase);

  const membership = await getMembership(supabase, user.id);

  const isHead = membership?.role === "head";
  const estudio = Array.isArray(membership?.estudio)
    ? membership?.estudio[0]
    : membership?.estudio;
  const config = (estudio?.escritos_config ?? {}) as EstudioEscritosConfig;

  const members = (await listMembers(supabase)) as EstudioMember[];

  const connection = await getGmailConnection(supabase);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">{estudio?.nombre ?? "Estudio"}</h1>

      {feedback && (
        <Alert variant={feedback.tone === "error" ? "destructive" : "default"}>
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="miembros">
        <TabsList>
          <TabsTrigger value="miembros">Miembros</TabsTrigger>
          <TabsTrigger value="salir">Invitaciones</TabsTrigger>
          <TabsTrigger value="gmail">Gmail</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="miembros">
          <MiembrosTab members={members} isHead={isHead} currentUserId={user!.id} />
        </TabsContent>

        <TabsContent value="salir">
          {isHead ? (
            <Alert>
              <AlertDescription>
                Sos head del estudio, no podés salir. (La transferencia de estudio y
                las invitaciones por token llegan más adelante.)
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Salir del estudio</CardTitle>
                <CardDescription>
                  Dejarás de tener acceso a los datos de este estudio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={leaveEstudio}>
                  <Button type="submit" variant="destructive">
                    Salir del estudio
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="gmail">
          <GmailTab connection={connection} isHead={isHead} members={members} />
        </TabsContent>

        <TabsContent value="configuracion">
          <ConfiguracionTab
            nombre={estudio?.nombre ?? ""}
            config={config}
            isHead={isHead}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
