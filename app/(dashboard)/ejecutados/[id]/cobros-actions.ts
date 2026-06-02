"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireUser, getCurrentEstudioId } from "@/lib/data/auth";
import {
  addCobro as insertCobro,
  confirmCobro as markCobroProveido,
  archiveCobro as softDeleteCobro,
} from "@/lib/data/cobros";

export async function addCobro(ejecutadoId: string, formData: FormData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const estudioId = await getCurrentEstudioId(supabase);

  await insertCobro(supabase, {
    ejecutadoId,
    userId: user.id,
    estudioId,
    monto: Number(formData.get("monto") ?? 0),
    nota: String(formData.get("nota") ?? ""),
    fecha: String(
      formData.get("fecha") ?? new Date().toISOString().slice(0, 10),
    ),
  });

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/cobros");
}

export async function confirmCobro(cobroId: string, ejecutadoId: string) {
  const supabase = await createClient();
  await markCobroProveido(supabase, cobroId);

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/cobros");
}

export async function archiveCobro(cobroId: string, ejecutadoId: string) {
  const supabase = await createClient();
  await softDeleteCobro(supabase, cobroId);

  revalidatePath(`/ejecutados/${ejecutadoId}`);
  revalidatePath("/cobros");
}