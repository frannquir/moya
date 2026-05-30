import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

interface Ejecutado {
  id: string;
  nombre: string;
  numero_expediente: string;
}

interface EmailRow {
  id: string;
  subject: string;
  from_email: string;
  from_name: string;
  snippet: string;
  received_at: string | null;
  is_delegated: boolean;
  ejecutado_id: string | null;
  ejecutados: Ejecutado | Ejecutado[] | null;
}

type GroupKind = "ejecutado" | "sin_asignar" | "otros";

interface Group {
  kind: GroupKind;
  ejecutado: Ejecutado | null;
  emails: EmailRow[];
  latest: number;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string }>;
}) {
  const { gmail, reason } = await searchParams;
  const supabase = await createClient();

  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("google_email, last_synced_at, last_sync_error, archived_at")
    .maybeSingle();
  const connected = connection && !connection.archived_at;

  const { data: emails } = await supabase
    .from("emails")
    .select(
      "id, subject, from_email, from_name, snippet, received_at, is_delegated, ejecutado_id, ejecutados(id, nombre, numero_expediente)",
    )
    .is("archived_at", null)
    .order("received_at", { ascending: false });

  const groups = groupEmails((emails ?? []) as EmailRow[]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mail</h1>
          {connected && (
            <p className="text-sm text-muted-foreground">
              {connection.google_email}
              {connection.last_synced_at &&
                ` · sincronizado ${formatDate(connection.last_synced_at)}`}
            </p>
          )}
        </div>
        {connected && (
          <a
            href="/api/gmail/connect"
            className="text-sm text-muted-foreground hover:underline"
          >
            Reconectar
          </a>
        )}
      </div>

      {gmail === "connected" && (
        <p className="text-sm text-green-600">Casilla conectada.</p>
      )}
      {gmail === "error" && (
        <p className="text-sm text-red-600">
          No se pudo conectar{reason ? ` (${reason})` : ""}.
        </p>
      )}
      {connected && connection.last_sync_error && (
        <p className="text-sm text-red-600">
          Error de sincronización: {connection.last_sync_error}
        </p>
      )}

      {!connected ? (
        <a
          href="/api/gmail/connect"
          className="inline-flex rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Conectar Gmail
        </a>
      ) : groups.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          No hay correos sincronizados todavía.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section
              key={group.ejecutado?.id ?? group.kind}
              className="rounded-md border"
            >
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  {group.ejecutado ? (
                    <>
                      <Link
                        href={`/ejecutados/${group.ejecutado.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {group.ejecutado.nombre}
                      </Link>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {group.ejecutado.numero_expediente || "—"}
                      </span>
                    </>
                  ) : (
                    <span className="font-medium text-muted-foreground">
                      {group.kind === "sin_asignar" ? "Sin asignar" : "Otros"}
                    </span>
                  )}
                </div>
                <Badge variant="secondary">{group.emails.length}</Badge>
              </div>
              <ul className="divide-y">
                {group.emails.map((email) => (
                  <li key={email.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {email.subject || "(sin asunto)"}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(email.received_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="truncate">
                        {email.from_name || email.from_email}
                      </span>
                      {email.is_delegated && (
                        <Badge variant="outline" className="shrink-0">
                          MEV
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {email.snippet}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupEmails(emails: EmailRow[]): Group[] {
  const map = new Map<string, Group>();

  for (const email of emails) {
    const ejecutado = normalizeEjecutado(email.ejecutados);
    let key: string;
    let kind: GroupKind;
    if (ejecutado) {
      key = ejecutado.id;
      kind = "ejecutado";
    } else if (email.is_delegated) {
      // Unmatched MEV mail is relevant — surface it for manual assignment.
      key = "__sin_asignar__";
      kind = "sin_asignar";
    } else {
      // Everything else unmatched (non-MEV) lands in "Otros".
      key = "__otros__";
      kind = "otros";
    }
    const received = email.received_at ? new Date(email.received_at).getTime() : 0;

    const existing = map.get(key);
    if (existing) {
      existing.emails.push(email);
      existing.latest = Math.max(existing.latest, received);
    } else {
      map.set(key, { kind, ejecutado, emails: [email], latest: received });
    }
  }

  // Ejecutado groups first (most recently active), then Sin asignar, then Otros.
  const order: Record<GroupKind, number> = {
    ejecutado: 0,
    sin_asignar: 1,
    otros: 2,
  };
  return [...map.values()].sort((a, b) => {
    if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
    return b.latest - a.latest;
  });
}

function normalizeEjecutado(
  value: Ejecutado | Ejecutado[] | null,
): Ejecutado | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
