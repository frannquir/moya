"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/data/auth";

export async function syncGmailNow() {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  // Head only — same gate as the Connect/Disconnect Gmail flow.
  const { data: membership } = await supabase
    .from("estudio_members")
    .select("estudio_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.role !== "head") {
    throw new Error("Only the head can trigger a sync");
  }

  // Server-to-server invoke with the service-role bearer; scoped to this estudio.
  // The function returns 202 quickly (it backgrounds the work), so this does not
  // block on the full sync. New emails arrive in the client via the realtime
  // channel on `emails`.
  const admin = createAdminClient();
  const { error } = await admin.functions.invoke("gmail-sync", {
    body: { estudio_id: membership.estudio_id },
  });
  if (error) throw error;

  revalidatePath("/mail");
}

// Manual match: pin a mail to an ejecutado. match_manual=true so the next sync /
// re-match never overrides it; clears any pending candidate. RLS limits who can
// run this (the head, or a member acting on a mail they can already see).
export async function assignEmail(emailId: string, ejecutadoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("emails")
    .update({
      ejecutado_id: ejecutadoId,
      candidate_ejecutado_id: null,
      match_manual: true,
    })
    .eq("id", emailId);
  if (error) throw error;

  revalidatePath("/mail");
  revalidatePath(`/mail/${emailId}`);
}

// Accept the matcher's suggestion: promote candidate_ejecutado_id → ejecutado_id.
// Read-then-write because PostgREST can't SET one column from another in place.
export async function confirmCandidate(emailId: string) {
  const supabase = await createClient();

  const { data, error: readError } = await supabase
    .from("emails")
    .select("candidate_ejecutado_id")
    .eq("id", emailId)
    .maybeSingle();
  if (readError) throw readError;

  const candidateId = data?.candidate_ejecutado_id;
  if (!candidateId) return;

  const { error } = await supabase
    .from("emails")
    .update({
      ejecutado_id: candidateId,
      candidate_ejecutado_id: null,
      match_manual: true,
    })
    .eq("id", emailId);
  if (error) throw error;

  revalidatePath("/mail");
  revalidatePath(`/mail/${emailId}`);
}

// Reject the matcher's suggestion: drop the candidate and mark the mail manual so
// the next sync / re-match doesn't re-propose it. ejecutado_id stays null, so for
// a member the mail leaves their view (it was only theirs via the candidate).
export async function rejectCandidate(emailId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("emails")
    .update({
      candidate_ejecutado_id: null,
      match_manual: true,
    })
    .eq("id", emailId);
  if (error) throw error;

  revalidatePath("/mail");
  revalidatePath(`/mail/${emailId}`);
}
