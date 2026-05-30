"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Flips a mail-derived event from proposed (aplicado=false) to confirmed.
// Closes the propose/confirm loop — once aplicado=true, the escrito scorer
// (lib/domain/escritos-scorer.ts) picks it up as ultimo_evento.
// RLS on ejecutado_eventos restricts UPDATE to current estudio members.
export async function confirmEvent(formData: FormData) {
  const eventId = formData.get("eventId");
  const mailId = formData.get("mailId");
  if (typeof eventId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("ejecutado_eventos")
    .update({ aplicado: true })
    .eq("id", eventId);

  if (typeof mailId === "string") revalidatePath(`/mail/${mailId}`);
  revalidatePath("/mail");
  revalidatePath("/escritos");
}
