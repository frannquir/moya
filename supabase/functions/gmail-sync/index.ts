// Daily Gmail sync. For each estudio's connection: refresh the access token,
// pull recent messages, parse them, match to an ejecutado via the shared matcher
// (lib/domain/mail-match.ts — causa + juzgado composite key, with a candidate
// fallback), and upsert into `emails` (idempotent on estudio_id + gmail_message_id).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { classifyMailEvents } from "../_shared/classify.ts";
import { decryptToken } from "../_shared/crypto.ts";
import {
  getMessage,
  listMessageIds,
  MEV_SENDER,
  refreshAccessToken,
} from "../_shared/gmail.ts";
import {
  type EjecutadoRef,
  type JuzgadoRef,
  matchEmail,
} from "../../../lib/domain/mail-match.ts";


const SYNC_QUERY = "in:inbox newer_than:3d";
const MAX_MESSAGES_PER_CONNECTION = 300;

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let estudioId: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.estudio_id === "string") estudioId = body.estudio_id;
    } catch {
    }
  }

  let connQuery = supabase
    .from("gmail_connections")
    .select("id, estudio_id, refresh_token_encrypted, last_synced_at")
    .is("archived_at", null);
  if (estudioId) connQuery = connQuery.eq("estudio_id", estudioId);

  const { data: connections, error: connErr } = await connQuery;
  if (connErr) {
    return json({ error: `load connections: ${connErr.message}` }, 500);
  }


  EdgeRuntime.waitUntil(
    (async () => {
      for (const conn of connections ?? []) {
        await syncConnection(supabase, conn);
      }
    })(),
  );

  return json({ accepted: true, scope: estudioId ?? "all" }, 202);
});

interface Connection {
  id: string;
  estudio_id: string;
  refresh_token_encrypted: string;
  last_synced_at: string | null;
}

async function syncConnection( 
  supabase: any,
  conn: Connection,
): Promise<Record<string, unknown>> {
  try {
    const refreshToken = await decryptToken(conn.refresh_token_encrypted);
    const { accessToken, expiresIn } = await refreshAccessToken(refreshToken);

    const { data: ejecutados } = await supabase
      .from("ejecutados")
      .select("id, nombre, numero_expediente, juzgado_id, departamento")
      .eq("estudio_id", conn.estudio_id)
      .is("archived_at", null);
    const refs: EjecutadoRef[] = ejecutados ?? [];

    // Global court reference (no estudio_id) — used to resolve a mail's Organismo
    // line to a juzgado_id, the second half of the causa+court composite key.
    const { data: juzgadosRows } = await supabase
      .from("juzgados")
      .select("id, tipo, numero, localidad");
    const juzgados: JuzgadoRef[] = juzgadosRows ?? [];

    const ids = await listMessageIds(
      accessToken,
      SYNC_QUERY,
      MAX_MESSAGES_PER_CONNECTION,
    );

    let inserted = 0;
    let proposed = 0;
    for (const id of ids) {
      const parsed = await getMessage(accessToken, id);
      const match = matchEmail(parsed, refs, juzgados);
      const isDelegated = parsed.from_email === MEV_SENDER;

      // ignoreDuplicates:true → existing rows (incl. manual matches) are never
      // touched; only brand-new mail gets the matcher result. Re-matching the
      // backlog is the job of scripts/rematch-emails.ts.
      const { error: upsertErr } = await supabase.from("emails").upsert(
        {
          estudio_id: conn.estudio_id,
          gmail_connection_id: conn.id,
          ...parsed,
          ejecutado_id: match.ejecutadoId,
          candidate_ejecutado_id: match.candidateId,
          match_confidence: match.confidence,
          is_delegated: isDelegated,
        },
        { onConflict: "estudio_id,gmail_message_id", ignoreDuplicates: true },
      );
      if (upsertErr) continue;
      inserted++;

      // Event proposals only for confident auto-matches, never for candidates.
      const ejecutadoId = match.ejecutadoId;
      if (!isDelegated || !ejecutadoId) continue;

      const proposals = classifyMailEvents(parsed);
      if (proposals.length === 0) continue;

      const { data: emailRow } = await supabase
        .from("emails")
        .select("id")
        .eq("estudio_id", conn.estudio_id)
        .eq("gmail_message_id", parsed.gmail_message_id)
        .maybeSingle();
      if (!emailRow) continue;

      const events = proposals.map((p) => ({
        estudio_id: conn.estudio_id,
        ejecutado_id: ejecutadoId,
        tipo_evento: p.tipo_evento,
        source: "mail",
        confidence: p.confidence,
        mail_id: emailRow.id,
        aplicado: false,
      }));
      const { error: eventsErr } = await supabase
        .from("ejecutado_eventos")
        .upsert(events, {
          onConflict: "mail_id,tipo_evento",
          ignoreDuplicates: true,
        });
      if (!eventsErr) proposed += events.length;
    }

    await supabase
      .from("gmail_connections")
      .update({
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("id", conn.id);

    return { estudio_id: conn.estudio_id, fetched: ids.length, inserted, proposed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("gmail_connections")
      .update({ last_sync_error: message })
      .eq("id", conn.id);
    return { estudio_id: conn.estudio_id, error: message };
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
