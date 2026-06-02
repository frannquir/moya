"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { listEmailsInWindow, getGmailConnection } from "@/lib/data/mail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatArDate, formatArDateTime } from "@/lib/domain/dates";
import { syncGmailNow } from "./actions";

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

export function MailBoard({
  offset,
  start,
  end,
  gmail,
  reason,
  isHead,
}: {
  offset: number;
  start: string;
  end: string;
  gmail?: string;
  reason?: string;
  isHead: boolean;
}) {
  const queryClient = useQueryClient();
  const supabase = createBrowserClient();

  const { data: emails = [] } = useQuery({
    queryKey: ["emails", "window", offset],
    queryFn: () =>
      listEmailsInWindow(supabase, { start: new Date(start), end: new Date(end) }),
  });

  // No refetchInterval: Gmail sync is a daily 7am cron, so last_synced_at and
  // new emails change ~once/day. A poll would be useless. The connection row is
  // prefetched once and read here; live rows arrive via the realtime channel.
  const { data: connection } = useQuery({
    queryKey: ["gmail-connection"],
    queryFn: () => getGmailConnection(supabase),
  });

  // Realtime: invalidate the emails query when a new row arrives. RLS applies to
  // the payload, so only rows for the user's estudio deliver.
  useEffect(() => {
    const ch = supabase
      .channel("emails-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emails" },
        () => queryClient.invalidateQueries({ queryKey: ["emails"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncMutation = useMutation({
    mutationFn: () => syncGmailNow(),
    onSuccess: () => {
      // last_synced_at updates when the background sync finishes; nudge the
      // connection query. Emails arrive via the realtime channel — no manual
      // emails refetch needed here.
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
    },
    onError: () => {
      toast.error("No se pudo sincronizar.");
    },
  });

  const connected = connection && !connection.archived_at;
  const groups = groupEmails(emails as EmailRow[]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mail</h1>
          {connected && (
            <p className="text-sm text-muted-foreground">
              {connection.google_email}
              {connection.last_synced_at &&
                ` · sincronizado ${formatArDateTime(connection.last_synced_at)}`}
            </p>
          )}
        </div>
        {connected && (
          <div className="flex items-center gap-3">
            {isHead && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? "Sincronizando…" : "Sincronizar ahora"}
              </Button>
            )}
            <a
              href="/api/gmail/connect"
              className="text-sm text-muted-foreground hover:underline"
            >
              Reconectar
            </a>
          </div>
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

      {connected && (
        <p className="text-sm text-muted-foreground">
          Mostrando del {formatArDate(new Date(start))} al {formatArDate(new Date(end))}
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
          {offset === 0
            ? "No hay correos sincronizados todavía."
            : "No hay correos en esta ventana."}
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
                  <li key={email.id}>
                    <Link
                      href={`/mail/${email.id}`}
                      className="block px-4 py-3 hover:bg-accent"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">
                          {email.subject || "(sin asunto)"}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatArDateTime(email.received_at)}
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
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {connected && (
        <div className="flex items-center justify-between pt-2">
          {offset > 0 ? (
            <Link
              href={`?window=${offset - 1}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Más recientes
            </Link>
          ) : (
            <span />
          )}
          <Link
            href={`?window=${offset + 1}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            Más antiguos →
          </Link>
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
