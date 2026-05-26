"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateLawyerProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const payload = {
    user_id: user.id,
    nombre: String(formData.get("nombre") ?? ""),
    matricula: String(formData.get("matricula") ?? ""),
    cuit: String(formData.get("cuit") ?? ""),
    legajo: String(formData.get("legajo") ?? ""),
    ibm: String(formData.get("ibm") ?? ""),
    domicilio_electronico: String(formData.get("domicilio_electronico") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    iva_condicion: String(formData.get("iva_condicion") ?? "Responsable Inscripto"),
  };

  const { error } = await supabase
    .from("lawyer_profiles")
    .upsert(payload, { onConflict: "user_id" });
  if (error) throw error;

  revalidatePath("/settings/profile");
}