import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type Tables } from "@/lib/supabase/db-helpers";

type Client = SupabaseClient<Database>;

export type GmailConnection = {
  google_email: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
  connected_by_user_id: string | null;
  archived_at: string | null;
};


const EMAIL_LIST_COLUMNS =
  "id, subject, from_email, from_name, snippet, received_at, is_delegated, ejecutado_id, candidate_ejecutado_id, ejecutados!ejecutado_id(id, nombre, numero_expediente), candidato:ejecutados!candidate_ejecutado_id(id, nombre, numero_expediente)";

const EMAIL_DETAIL_COLUMNS =
  "id, subject, from_email, from_name, to_emails, body_html, body_text, received_at, is_delegated, ejecutado_id, candidate_ejecutado_id, ejecutados!ejecutado_id(id, nombre, numero_expediente), candidato:ejecutados!candidate_ejecutado_id(id, nombre, numero_expediente)";

// Newest first
export async function listEmailsInWindow(
  supabase: Client,
  { start, end }: { start: Date; end: Date },
) {
  const { data, error } = await supabase
    .from("emails")
    .select(EMAIL_LIST_COLUMNS)
    .is("archived_at", null)
    .gte("received_at", start.toISOString())
    .lt("received_at", end.toISOString())
    .order("received_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Single email by id (RLS hides emails the user shouldn't see → null → 404).
// Generic so callers keep their own row shape that matches the selected columns.
export async function getEmailById<T = Tables<"emails">>(
  supabase: Client,
  id: string,
): Promise<T | null> {
  const { data, error } = await supabase
    .from("emails")
    .select(EMAIL_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle<T>();
  if (error) throw error;
  return data;
}

// Unassigned mail: estudio mail the matcher left with no ejecutado and no candidate,
// that nobody filed by hand. Head-only in practice — the /mail/sin-asignar page gates
// on role and RLS scopes rows to the head's estudio. Returns only the fields the
// parser/clusterer needs.
export async function listUnassignedEmails(supabase: Client, estudioId: string) {
  const { data, error } = await supabase
    .from("emails")
    .select("id, subject, snippet, body_text, from_email, received_at")
    .eq("estudio_id", estudioId)
    .is("ejecutado_id", null)
    .is("candidate_ejecutado_id", null)
    .eq("match_manual", false)
    .is("archived_at", null)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getGmailConnection(
  supabase: Client,
): Promise<GmailConnection | null> {
  const { data, error } = await supabase
    .from("gmail_connections")
    .select(
      "google_email, last_synced_at, last_sync_error, connected_by_user_id, archived_at",
    )
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function archiveGmailConnection(supabase: Client): Promise<void> {
  const { error } = await supabase
    .from("gmail_connections")
    .update({ archived_at: new Date().toISOString() })
    .is("archived_at", null);
  if (error) throw error;
}
