"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const IVA_OPTIONS = [
  "Responsable Inscripto",
  "Monotributista",
  "Exento",
  "Consumidor Final",
] as const;

export async function updateLawyerProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const ivaRaw = String(formData.get("iva_condicion") ?? "Responsable Inscripto");
  const iva_condicion = (IVA_OPTIONS as readonly string[]).includes(ivaRaw)
    ? ivaRaw
    : "Responsable Inscripto";

  const { error } = await supabase.from("lawyer_profiles").upsert(
    {
      user_id: user.id,
      nombre: String(formData.get("nombre") ?? ""),
      matricula: String(formData.get("matricula") ?? ""),
      cuit: String(formData.get("cuit") ?? ""),
      legajo: String(formData.get("legajo") ?? ""),
      ibm: String(formData.get("ibm") ?? ""),
      domicilio_electronico: String(formData.get("domicilio_electronico") ?? ""),
      telefono: String(formData.get("telefono") ?? ""),
      iva_condicion,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;

  revalidatePath("/settings/profile");
}