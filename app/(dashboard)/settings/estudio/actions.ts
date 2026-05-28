"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type Json } from "@/lib/supabase/types";

export async function updateEstudio(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
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

  revalidatePath("/settings/estudio");
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
    // Malformed payload — leave empresas empty rather than failing the save.
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

  revalidatePath("/settings/estudio");
}