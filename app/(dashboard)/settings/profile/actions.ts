"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { formatCuil, isValidCuil } from "@/lib/domain/cuil";
import { IVA_OPTIONS } from "@/lib/domain/escritos-config";

/**
 * What the profile form gets back. Problems are RETURNED, never thrown: a throw
 * escaped to the dashboard error boundary, which unmounted the form, replaced the
 * page with "Algo salió mal" and buried the Spanish message in a collapsed
 * <details> — so one invalid CUIT cost the user every other field they had just
 * typed (Fran, 2026-08-31). Same pattern createDemanda and the estudio config
 * form use.
 */
export type ProfileState = { ok: true } | { errors: string[] } | null;

export async function updateLawyerProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const errors: string[] = [];

  // Trimmed like every other text field the app stores: `nombre` prints in the
  // autorizados list of an escrito, where a trailing space is visible.
  const campo = (k: string) => String(formData.get(k) ?? "").trim();

  const ivaRaw = campo("iva_condicion");
  const iva_condicion = (IVA_OPTIONS as readonly string[]).includes(ivaRaw)
    ? ivaRaw
    : "Responsable Inscripto";

  // Only picks the treatment (Dra./Sr.) when this person is listed as autorizado
  // in an escrito. Radix Select cannot use "" as a value (gotcha #9), so the UI
  // sends the sentinel for "sin especificar" and it is stored as NULL.
  const generoRaw = campo("genero");
  const genero = generoRaw === "F" || generoRaw === "M" ? generoRaw : null;

  // Together with genero this picks Dr./Dra./Sr./Sra. in the autorizados list.
  // The switch posts an explicit "true"/"false": an unchecked one is simply
  // absent from FormData, which is indistinguishable from "not on this form".
  const es_abogado = campo("es_abogado") === "true";

  // Same validator as every other CUIT in the app. Empty stays allowed — a
  // profile may be half filled — so only a non-empty value is checked.
  const cuit = formatCuil(campo("cuit"));
  if (cuit !== "" && !isValidCuil(cuit)) {
    errors.push(
      "El CUIT no es válido: revisá el número, el dígito verificador no coincide.",
    );
  }

  // Nothing is written while anything is wrong, and the form keeps every value.
  if (errors.length > 0) return { errors };

  const { error } = await supabase.from("lawyer_profiles").upsert(
    {
      user_id: user.id,
      nombre: campo("nombre"),
      matricula: campo("matricula"),
      cuit,
      legajo: campo("legajo"),
      ibm: campo("ibm"),
      domicilio_electronico: campo("domicilio_electronico"),
      telefono: campo("telefono"),
      iva_condicion,
      genero,
      es_abogado,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;

  revalidatePath("/settings/profile");
  return { ok: true };
}
