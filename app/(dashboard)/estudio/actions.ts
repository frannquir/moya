"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type Json } from "@/lib/supabase/types";

export async function inviteMember(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/estudio?msg=invite_empty");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: found } = await supabase.rpc("get_user_by_email", {
    p_email: email,
  });
  const target = Array.isArray(found) ? found[0] : found;
  if (!target) redirect("/estudio?msg=invite_notfound");

  const { data: membership } = await supabase
    .from("estudio_members")
    .select("estudio_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No estudio for user");

  const { error } = await supabase.from("estudio_members").insert({
    estudio_id: membership.estudio_id,
    user_id: target.id,
    role: "member",
  });
  if (error) {
    if (error.code === "23505") redirect("/estudio?msg=invite_exists");
    throw error;
  }

  revalidatePath("/estudio");
  redirect("/estudio?msg=invite_ok");
}

export async function removeMember(userId: string) {
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("estudio_members")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (target?.role === "head") redirect("/estudio?msg=remove_head");

  const { error } = await supabase
    .from("estudio_members")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;

  revalidatePath("/estudio");
  redirect("/estudio?msg=remove_ok");
}

export async function leaveEstudio() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: membership } = await supabase
    .from("estudio_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership?.role === "head") redirect("/estudio?msg=leave_head");

  const { error } = await supabase
    .from("estudio_members")
    .delete()
    .eq("user_id", user.id);
  if (error) throw error;

  redirect("/");
}

export async function disconnectGmail() {
  const supabase = await createClient();

  const { error } = await supabase
    .from("gmail_connections")
    .update({ archived_at: new Date().toISOString() })
    .is("archived_at", null);
  if (error) throw error;

  revalidatePath("/estudio");
  revalidatePath("/mail");
}


export async function updateEstudio(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: estudio } = await supabase
    .from("estudios")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!estudio) throw new Error("Only the head can edit estudio settings");

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("Nombre is required");

  const { error } = await supabase
    .from("estudios")
    .update({ nombre })
    .eq("id", estudio.id);
  if (error) throw error;

  revalidatePath("/estudio");
}

export async function updateEstudioEscritosConfig(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data: estudio } = await supabase
    .from("estudios")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!estudio) throw new Error("Only the head can edit estudio settings");

  const domicilios_procesales: Record<string, string> = {};
  try {
    const parsed = JSON.parse(String(formData.get("domicilios_json") ?? "[]"));
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        const dep = String(row?.departamento ?? "").trim();
        const dom = String(row?.domicilio ?? "").trim();
        if (dep) domicilios_procesales[dep] = dom;
      }
    }
  } catch {
  }

  const empresas: Record<string, { razonSocial: string; domicilioLegal: string; cuit: string }> = {};
  try {
    const parsed = JSON.parse(String(formData.get("empresas_json") ?? "[]"));
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        const clave = String(row?.clave ?? "").trim();
        if (!clave) continue;
        empresas[clave] = {
          razonSocial: String(row?.razonSocial ?? "").trim(),
          domicilioLegal: String(row?.domicilioLegal ?? "").trim(),
          cuit: String(row?.cuit ?? "").trim(),
        };
      }
    }
  } catch {
  }

  const config = {
    cuenta_honorarios: String(formData.get("cuenta_honorarios") ?? "").trim(),
    domicilios_procesales,
    empresas,
  };

  const { error } = await supabase
    .from("estudios")
    .update({ escritos_config: config as unknown as Json })
    .eq("id", estudio.id);
  if (error) throw error;

  revalidatePath("/estudio");
}
