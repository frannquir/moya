"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { formatCuil, isValidCuil } from "@/lib/domain/cuil";

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

  // Only picks the treatment (Dra./Sr.) when this person is listed as autorizado
  // in an escrito. Radix Select cannot use "" as a value (gotcha #9), so the UI
  // sends the sentinel for "sin especificar" and it is stored as NULL.
  const generoRaw = String(formData.get("genero") ?? "");
  const genero = generoRaw === "F" || generoRaw === "M" ? generoRaw : null;

  // Together with genero this picks Dr./Dra./Sr./Sra. in the autorizados list.
  // The switch posts an explicit "true"/"false": an unchecked one is simply
  // absent from FormData, which is indistinguishable from "not on this form".
  const es_abogado = String(formData.get("es_abogado") ?? "") === "true";

  // Same validator as every other CUIT in the app. Empty stays allowed — a
  // profile may be half filled — so only a non-empty value is checked.
  const cuit = formatCuil(String(formData.get("cuit") ?? ""));
  if (cuit !== "" && !isValidCuil(cuit)) {
    throw new Error("CUIT inválido: revisá el número, el dígito verificador no coincide.");
  }

  const { error } = await supabase.from("lawyer_profiles").upsert(
    {
      user_id: user.id,
      nombre: String(formData.get("nombre") ?? ""),
      matricula: String(formData.get("matricula") ?? ""),
      cuit,
      legajo: String(formData.get("legajo") ?? ""),
      ibm: String(formData.get("ibm") ?? ""),
      domicilio_electronico: String(formData.get("domicilio_electronico") ?? ""),
      telefono: String(formData.get("telefono") ?? ""),
      iva_condicion,
      genero,
      es_abogado,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;

  revalidatePath("/settings/profile");
}