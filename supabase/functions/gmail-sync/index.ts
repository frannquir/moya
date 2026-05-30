// Daily Gmail sync. For each estudio's connection: refresh the access token,
// pull recent messages, parse them, match to an ejecutado by expediente number,
// and upsert into `emails` (idempotent on estudio_id + gmail_message_id).
//
// Runs on the service-role key, so it bypasses RLS. Invoked by pg_cron; also
// callable manually for testing (see the function README / deploy notes).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { classifyMailEvents } from "../_shared/classify.ts";
import { decryptToken } from "../_shared/crypto.ts";
import {
  type EjecutadoRef,
  getMessage,
  listMessageIds,
  matchExpediente,
  MEV_SENDER,
  refreshAccessToken,
} from "../_shared/gmail.ts";

// Every run pulls the last 3 days of inbox mail. With the daily 7am cron, the
// overlapping window means a missed run self-heals and the upsert dedupes the
// overlap. The cap is just a safety bound — a 3-day window is small in practice.
const SYNC_QUERY = "in:inbox newer_than:3d";
const MAX_MESSAGES_PER_CONNECTION = 300;

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: connections, error: connErr } = await supabase
    .from("gmail_connections")
    .select("id, estudio_id, refresh_token_encrypted, last_synced_at")
    .is("archived_at", null);

  if (connErr) {
    return json({ error: `load connections: ${connErr.message}` }, 500);
  }

  const results: Record<string, unknown>[] = [];
  for (const conn of connections ?? []) {
    results.push(await syncConnection(supabase, conn));
  }
  return json({ synced: results });
});

interface Connection {
  id: string;
  estudio_id: string;
  refresh_token_encrypted: string;
  last_synced_at: string | null;
}

async function syncConnection(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  conn: Connection,
): Promise<Record<string, unknown>> {
  try {
    const refreshToken = await decryptToken(conn.refresh_token_encrypted);
    const { accessToken, expiresIn } = await refreshAccessToken(refreshToken);

    const { data: ejecutados } = await supabase
      .from("ejecutados")
      .select("id, numero_expediente")
      .eq("estudio_id", conn.estudio_id)
      .is("archived_at", null);
    const refs: EjecutadoRef[] = ejecutados ?? [];

    const ids = await listMessageIds(
      accessToken,
      SYNC_QUERY,
      MAX_MESSAGES_PER_CONNECTION,
    );

    let inserted = 0;
    let proposed = 0;
    for (const id of ids) {
      const parsed = await getMessage(accessToken, id);
      const match = matchExpediente(parsed, refs);
      const isDelegated = parsed.from_email === MEV_SENDER;

      const { error: upsertErr } = await supabase.from("emails").upsert(
        {
          estudio_id: conn.estudio_id,
          gmail_connection_id: conn.id,
          ...parsed,
          ejecutado_id: match.ejecutado_id,
          match_confidence: match.match_confidence,
          is_delegated: isDelegated,
        },
        { onConflict: "estudio_id,gmail_message_id", ignoreDuplicates: true },
      );
      if (upsertErr) continue;
      inserted++;

      // Mail → escrito loop: only MEV mail matched to an ejecutado feeds events.
      const ejecutadoId = match.ejecutado_id;
      if (!isDelegated || !ejecutadoId) continue;

      const proposals = classifyMailEvents(parsed);
      if (proposals.length === 0) continue;

      // ignoreDuplicates means upsert doesn't return the id on conflict; look it up.
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
