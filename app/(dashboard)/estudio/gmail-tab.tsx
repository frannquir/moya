import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatArDateTime } from "@/lib/domain/dates";
import { disconnectGmail } from "./actions";
import { type EstudioMember } from "./miembros-tab";

export type GmailConnection = {
  google_email: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
  connected_by_user_id: string | null;
  archived_at: string | null;
};

export function GmailTab({
  connection,
  isHead,
  members,
}: {
  connection: GmailConnection | null;
  isHead: boolean;
  members: EstudioMember[];
}) {
  const connected = connection && !connection.archived_at;

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gmail</CardTitle>
          <CardDescription>
            La casilla del estudio no está conectada.
          </CardDescription>
        </CardHeader>
        {isHead && (
          <CardContent>
            <Button asChild>
              <a href="/api/gmail/connect">Conectar Gmail</a>
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  const connectedBy = connection.connected_by_user_id
    ? members.find((m) => m.user_id === connection.connected_by_user_id)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gmail</CardTitle>
        <CardDescription>{connection.google_email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-1 text-sm">
          <Row label="Última sincronización" value={formatArDateTime(connection.last_synced_at)} />
          <Row
            label="Conectada por"
            value={connectedBy ? connectedBy.nombre || connectedBy.email : "—"}
          />
        </dl>

        {connection.last_sync_error && (
          <p className="text-sm text-red-600">
            Error de sincronización: {connection.last_sync_error}
          </p>
        )}

        {isHead && (
          <div className="flex gap-2 pt-1">
            <Button asChild variant="outline">
              <a href="/api/gmail/connect">Reconectar</a>
            </Button>
            <form action={disconnectGmail}>
              <Button type="submit" variant="outline">
                Desconectar
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

