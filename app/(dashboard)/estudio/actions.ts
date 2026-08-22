"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data/auth";
import { archiveGmailConnection } from "@/lib/data/mail";
import { updateEscritosConfig } from "@/lib/data/estudio";
import {
  type AbogadoConfig,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { formatCuil, isValidCuil } from "@/lib/domain/cuil";

export async function inviteMember(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/estudio?msg=invite_empty");

  const user = await requireUser(supabase);

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

  const user = await requireUser(supabase);

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

  await archiveGmailConnection(supabase);

  revalidatePath("/estudio");
  revalidatePath("/mail");
}


export async function updateEstudio(formData: FormData) {
  const supabase = await createClient();

  const user = await requireUser(supabase);

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

  const user = await requireUser(supabase);

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
          cuit: formatCuil(String(row?.cuit ?? "").trim()),
        };
      }
    }
  } catch {
  }

  // Validated OUTSIDE the parse, deliberately: the catch above exists to tolerate
  // malformed JSON, and a rejection thrown inside it would be swallowed — the
  // empresa would vanish from the config instead of reporting why.
  //
  // A CUIT is the same mod-11 construction as a CUIL with a 30/33/34 prefix, so
  // this is the validator validateParty already applies to the empleador's CUIT —
  // one implementation, not two. An empty CUIT stays allowed: an empresa may be
  // configured before its CUIT is known.
  for (const [clave, emp] of Object.entries(empresas)) {
    if (emp.cuit !== "" && !isValidCuil(emp.cuit)) {
      throw new Error(
        `CUIT inválido en la empresa "${clave}": revisá el número, ` +
          "el dígito verificador no coincide.",
      );
    }
  }

  // The apoderado every escrito is presented by. Stored verbatim; each field
  // falls back to a visible placeholder at render time.
  let encargado: Partial<AbogadoConfig> = {};
  try {
    const parsed = JSON.parse(String(formData.get("encargado_json") ?? "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const pick = (k: keyof AbogadoConfig) => String(parsed[k] ?? "").trim();
      encargado = {
        nombre: pick("nombre"),
        matricula: pick("matricula"),
        legajo: pick("legajo"),
        cuit: formatCuil(pick("cuit")),
        ibm: pick("ibm"),
        ivaCondicion: pick("ivaCondicion"),
        domicilioElectronico: pick("domicilioElectronico"),
        telefono: pick("telefono"),
      };
    }
  } catch {
  }

  if (encargado.cuit && !isValidCuil(encargado.cuit)) {
    throw new Error(
      "CUIT inválido en el encargado del estudio: revisá el número, " +
        "el dígito verificador no coincide.",
    );
  }

  const config: EstudioEscritosConfig = {
    cuenta_honorarios: String(formData.get("cuenta_honorarios") ?? "").trim(),
    encargado,
    domicilios_procesales,
    empresas,
  };

  await updateEscritosConfig(supabase, estudio.id, config);

  revalidatePath("/estudio");
}
