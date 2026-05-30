import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sanitizeBodyHtml } from "@/lib/gmail/sanitize";
import { confirmEvent } from "./actions";

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
  to_emails: string[];
  body_html: string;
  body_text: string;
  received_at: string | null;
  is_delegated: boolean;
  ejecutados: Ejecutado | Ejecutado[] | null;
}

interface EventRow {
  id: string;
  tipo_evento: string;
  confidence: number;
  aplicado: boolean;
  source: string;
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: email } = await supabase
    .from("emails")
    .select(
      "id, subject, from_email, from_name, to_emails, body_html, body_text, received_at, is_delegated, ejecutados(id, nombre, numero_expediente)",
    )
    .eq("id", id)
    .maybeSingle<EmailRow>();

  // RLS hides emails the user shouldn't see; same path for a real 404.
  if (!email) notFound();

  const { data: events } = await supabase
    .from("ejecutado_eventos")
    .select("id, tipo_evento, confidence, aplicado, source")
    .eq("mail_id", id)
    .eq("source", "mail")
    .order("confidence", { ascending: false });

  const ejecutado = normalizeEjecutado(email.ejecutados);
  const bodyHtml = sanitizeBodyHtml(email.body_html);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/mail"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Mail
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {email.subject || "(sin asunto)"}
        </h1>
        <p className="text-sm text-muted-foreground">
          De: {email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
          {email.received_at && ` · ${formatDate(email.received_at)}`}
          {email.is_delegated && (
            <Badge variant="outline" className="ml-2">MEV</Badge>
          )}
        </p>
        <p className="text-sm">
          {ejecutado ? (
            <Link
              href={`/ejecutados/${ejecutado.id}`}
              className="hover:underline"
            >
              Asignado a <strong>{ejecutado.nombre}</strong>
              {ejecutado.numero_expediente && ` · ${ejecutado.numero_expediente}`}
            </Link>
          ) : (
            <span className="text-muted-foreground">Sin asignar</span>
          )}
        </p>
      </header>

      {(events ?? []).length > 0 && (
        <section className="space-y-3 rounded-md border p-4">
          <div>
            <h2 className="font-medium">Eventos propuestos</h2>
            <p className="text-sm text-muted-foreground">
              Confirmá los eventos que aplican — alimentan las recomendaciones de escritos.
            </p>
          </div>
          <ul className="space-y-2">
            {(events as EventRow[]).map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm">
                  <span className="font-mono">{event.tipo_evento}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {Math.round(event.confidence * 100)}%
                  </span>
                </span>
                {event.aplicado ? (
                  <Badge variant="outline">Confirmado</Badge>
                ) : (
                  <form action={confirmEvent}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="mailId" value={email.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Confirmar
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-md border">
        {bodyHtml ? (
          // Empty sandbox attribute applies all restrictions — no scripts,
          // no forms, no top-nav. The sanitizer is defense-in-depth on top.
          <iframe
            sandbox=""
            srcDoc={bodyHtml}
            className="h-[60vh] w-full bg-white"
            title="Cuerpo del correo"
          />
        ) : email.body_text ? (
          <pre className="whitespace-pre-wrap p-4 text-sm">{email.body_text}</pre>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            Sin contenido.
          </div>
        )}
      </section>
    </div>
  );
}

function normalizeEjecutado(
  value: Ejecutado | Ejecutado[] | null,
): Ejecutado | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
