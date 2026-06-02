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
