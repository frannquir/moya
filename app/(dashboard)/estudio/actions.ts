"use server";

import { type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { type Database } from "@/lib/supabase/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data/auth";
import { archiveGmailConnection } from "@/lib/data/mail";
import { updateEscritosConfig } from "@/lib/data/estudio";
import {
  aplicarConfigParcial,
  mergeEscritosConfig,
  parseAutorizados,
  validarDomicilioElectronico,
  type AbogadoConfig,
  type CuentaHonorariosConfig,
  type ErrorDeConfig,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { formatCuil, isValidCuil } from "@/lib/domain/cuil";
import {
  setJusConfig,
  upsertTasas,
  restoreConfigValue,
} from "@/lib/data/config";
import { parseTasasBlock, tasaRowFromFields } from "@/lib/domain/liquidaciones";

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

/**
 * What the Configuración form gets back. Problems are RETURNED, never redirected:
 * a redirect re-rendered the tab from the database, which silently reverted every
 * field the head had typed — seven cuenta fields, nine encargado fields and both
 * catalogues — because of one wrong CBU digit (Fran, 2026-08-31). Same pattern
 * createDemanda already uses.
 *
 * Every problem is collected in one pass, so a second mistake is not discovered
 * only after retyping the form to fix the first.
 *
 * Since 2026-09-17 a save ALWAYS happens: `errores` lists what was left out and
 * where, and `rechazadas` names the keys that kept their stored value. There is
 * no "nothing was written" result any more — one bad CUIT used to block a
 * recused judge, an autorizado and a phone number with it (gotcha #51).
 */
export type EscritosConfigState =
  | { ok: true; errores: ErrorDeConfig[]; rechazadas: string[] }
  | null;

type EmpresaRow = {
  clave: string;
  razonSocial: string;
  domicilioLegal: string;
  cuit: string;
  cuentaBancaria: string;
};

/**
 * The empresa rows exactly as posted, BEFORE anything is keyed by clave. Keying
 * first is what made a blanked clave a silent delete: the row simply stopped
 * existing, and the save still reported success.
 */
function parseEmpresaRows(raw: string): EmpresaRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((row) => {
    const o = (row ?? {}) as Record<string, unknown>;
    const s = (k: string) => String(o[k] ?? "").trim();
    return {
      clave: s("clave"),
      razonSocial: s("razonSocial"),
      domicilioLegal: s("domicilioLegal"),
      cuit: formatCuil(s("cuit")),
      cuentaBancaria: s("cuentaBancaria"),
    };
  });
}

// EmpresasEditor always renders one blank row when nothing is configured, so "no
// data at all" is a row to drop, not a row to complain about.
function empresaTieneDatos(row: EmpresaRow): boolean {
  return (
    row.razonSocial !== "" ||
    row.domicilioLegal !== "" ||
    row.cuit !== "" ||
    row.cuentaBancaria !== ""
  );
}

/**
 * How many cases point at an empresa clave. `ejecutados.empresa` stores the clave
 * as a free string and deliberately not as an FK (20260528170000_escritos.sql), so
 * nothing in the database stops a rename from orphaning every case that used it —
 * their escritos would print [RAZON_SOCIAL], [CUIT_EMPRESA] and
 * [DOMICILIO_LEGAL_EMPRESA] instead of the company. Archived cases count too:
 * archiving is reversible and the escritos survive it.
 */
async function contarCasosPorEmpresa(
  supabase: SupabaseClient<Database>,
  clave: string,
): Promise<number> {
  const { count } = await supabase
    .from("ejecutados")
    .select("id", { count: "exact", head: true })
    .eq("empresa", clave);
  return count ?? 0;
}

export async function updateEstudioEscritosConfig(
  _prev: EscritosConfigState,
  formData: FormData,
): Promise<EscritosConfigState> {
  const supabase = await createClient();

  const user = await requireUser(supabase);

  const { data: estudio } = await supabase
    .from("estudios")
    .select("id, escritos_config")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!estudio) throw new Error("Only the head can edit estudio settings");

  // Each problem carries the config key it blocks and the form field that caused
  // it, so aplicarConfigParcial can leave that key alone and the editor can put
  // the message next to the right input.
  const errores: ErrorDeConfig[] = [];

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

  const filas = parseEmpresaRows(String(formData.get("empresas_json") ?? "[]"));

  // Validated OUTSIDE the parse, deliberately: the catch above exists to tolerate
  // malformed JSON, and a rejection thrown inside it would be swallowed — the
  // empresa would vanish from the config instead of reporting why.
  //
  // A CUIT is the same mod-11 construction as a CUIL with a 30/33/34 prefix, so
  // this is the validator validateParty already applies to the empleador's CUIT —
  // one implementation, not two. An empty CUIT stays allowed: an empresa may be
  // configured before its CUIT is known.
  const empresas: Record<
    string,
    { razonSocial: string; domicilioLegal: string; cuit: string; cuentaBancaria: string }
  > = {};
  const vistas = new Set<string>();
  for (const fila of filas) {
    const indice = filas.indexOf(fila);
    if (fila.clave === "") {
      // A row with data but no clave is the retype accident: the empresa used to
      // be dropped here and the save still said "Configuración guardada".
      if (empresaTieneDatos(fila)) {
        const nombre = fila.razonSocial !== "" ? `"${fila.razonSocial}"` : "una empresa";
        errores.push({
          clave: "empresas",
          campo: `empresa.${indice}.clave`,
          fila: { empresa: "" },
          mensaje: `Falta la clave de ${nombre}. La clave es lo que se guarda en el ejecutado; sin ella la empresa no se puede guardar.`,
        });
      }
      continue;
    }
    if (vistas.has(fila.clave)) {
      errores.push({
        clave: "empresas",
        campo: `empresa.${indice}.clave`,
        fila: { empresa: fila.clave },
        mensaje: `La clave "${fila.clave}" está repetida. Cada empresa necesita una clave distinta.`,
      });
      continue;
    }
    vistas.add(fila.clave);

    if (fila.cuit !== "" && !isValidCuil(fila.cuit)) {
      errores.push({
        clave: "empresas",
        campo: `empresa.${indice}.cuit`,
        fila: { empresa: fila.clave },
        mensaje: `El CUIT de "${fila.clave}" no es válido. Revisá el dígito verificador.`,
      });
    }

    empresas[fila.clave] = {
      razonSocial: fila.razonSocial,
      domicilioLegal: fila.domicilioLegal,
      cuit: fila.cuit,
      cuentaBancaria: fila.cuentaBancaria,
    };
  }

  // A clave that was configured and is no longer posted was either renamed or
  // removed. Deleting an unused empresa is fine; deleting one that cases point at
  // is silent damage that only surfaces in a filed document, so it is blocked.
  const configPrevia = (estudio.escritos_config ?? {}) as EstudioEscritosConfig;
  // Gated on the field, like the write below: a form that does not render the
  // empresas editor does not remove anything, so it must not be told it is
  // about to. Without this the guard would reject every save from such a form.
  if (formData.has("empresas_json")) {
    for (const clave of Object.keys(configPrevia.empresas ?? {})) {
      if (clave in empresas) continue;
      const casos = await contarCasosPorEmpresa(supabase, clave);
      if (casos > 0) {
        // No `fila`: this one blocks the whole empresas key on purpose. A rename
        // spans two rows, so keeping the stored one AND writing the new one
        // would leave the estudio with two empresas where it wanted one.
        errores.push({
          clave: "empresas",
          campo: "empresas",
          mensaje:
            `La empresa "${clave}" la usan ${casos} caso${casos === 1 ? "" : "s"}. ` +
            "Si la borrás o le cambiás la clave, esos escritos quedan sin razón social, " +
            "CUIT ni domicilio legal.",
        });
      }
    }
  }

  // The courts whose judge the estudio recuses. A row needs BOTH a court and a
  // name: the name is the only source (juzgados.juez is deliberately not a
  // fallback), so a court saved without one would print [JUEZ_RECUSADO] into a
  // filing. Blocked here rather than rendered as a marker.
  const jueces_recusados: Record<string, string> = {};
  try {
    const parsed = JSON.parse(String(formData.get("jueces_recusados_json") ?? "[]"));
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        const juzgadoId = String(row?.juzgadoId ?? "").trim();
        const nombreJuez = String(row?.nombre ?? "").trim();
        const indice = parsed.indexOf(row);
        if (juzgadoId === "" && nombreJuez === "") continue;
        // A bad row is dropped and named; the judges that ARE complete still
        // save. The form keeps every row on screen either way, so nothing the
        // head typed is lost by the drop.
        if (juzgadoId === "") {
          errores.push({
            clave: "jueces_recusados",
            campo: `juez.${indice}.juzgado`,
            mensaje: `Falta el juzgado del juez recusado "${nombreJuez}". Elegí el departamento y el juzgado.`,
          });
          continue;
        }
        if (nombreJuez === "") {
          errores.push({
            clave: "jueces_recusados",
            campo: `juez.${indice}.nombre`,
            mensaje:
              "Falta el nombre de un juez recusado. Sin nombre la demanda no puede imprimir la recusación.",
          });
          continue;
        }
        if (juzgadoId in jueces_recusados) {
          errores.push({
            clave: "jueces_recusados",
            campo: `juez.${indice}.juzgado`,
            mensaje:
              "Un mismo juzgado aparece dos veces en los jueces recusados. Dejá uno solo.",
          });
          continue;
        }
        jueces_recusados[juzgadoId] = nombreJuez;
      }
    }
  } catch {
  }

  // The estudio's own autorizados for section IX. Parsed and validated in
  // lib/domain so the rules are covered by Vitest rather than only by clicking
  // through the form. `undefined` back means "no override" — the derived member
  // list — and is NOT the same as an empty array.
  const { autorizados, errors: erroresAutorizados } = parseAutorizados(
    String(formData.get("autorizados_json") ?? ""),
  );
  for (const mensaje of erroresAutorizados) {
    errores.push({ clave: "autorizados", campo: "autorizados", mensaje });
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
        email: pick("email"),
      };
    }
  } catch {
  }

  if (encargado.cuit && !isValidCuil(encargado.cuit)) {
    errores.push({
      clave: "encargado",
      campo: "encargado.cuit",
      mensaje: "El CUIT del encargado no es válido. Revisá el dígito verificador.",
    });
  }

  // The SCBA notification address is printed in the encabezado of every escrito
  // the firm files, and until now nothing looked at it at all — which is how a
  // value with "scva" for "scba" reached a real estudio and stayed there.
  const errorDomicilioElectronico = validarDomicilioElectronico(
    encargado.domicilioElectronico,
  );
  if (errorDomicilioElectronico) {
    errores.push({
      clave: "encargado",
      campo: "encargado.domicilioElectronico",
      mensaje: errorDomicilioElectronico,
    });
  }

  const campo = (k: string) => String(formData.get(k) ?? "").trim();

  const cuenta_honorarios: CuentaHonorariosConfig = {
    tipo: campo("cuenta_tipo"),
    banco: campo("cuenta_banco"),
    numero: campo("cuenta_numero"),
    cbu: campo("cuenta_cbu").replace(/\D/g, ""),
    alias: campo("cuenta_alias"),
  };
  // Carried from the hidden field so a value written before the split is not
  // dropped by a save that leaves the parts empty.
  const textoPrevio = campo("cuenta_texto");
  if (textoPrevio !== "") cuenta_honorarios.texto = textoPrevio;

  // Length only. A CBU has its own check digits, but a validator that rejects a
  // correct number is worse than none — and 22 digits cannot false-positive.
  if (cuenta_honorarios.cbu !== "" && cuenta_honorarios.cbu.length !== 22) {
    errores.push({
      clave: "cuenta_honorarios",
      campo: "cuenta.cbu",
      mensaje: `El CBU tiene que tener 22 dígitos y tiene ${cuenta_honorarios.cbu.length}.`,
    });
  }

  // Only the keys this form actually rendered, each gated on the field that
  // carries it. mergeEscritosConfig carries the rest of the column through
  // untouched.
  //
  // This replaces a whole-column rebuild from a hand-written spread, which
  // deleted any key the form did not name — the comment that used to sit here
  // was the only thing stopping it, and `autorizados` would have been the sixth
  // key to depend on someone reading it. Now a key can only be lost by removing
  // it from EstudioEscritosConfig, which does not compile.
  const candidatos: Partial<EstudioEscritosConfig> = {};
  if (formData.has("cuenta_texto")) candidatos.cuenta_honorarios = cuenta_honorarios;
  if (formData.has("encargado_json")) candidatos.encargado = encargado;
  if (formData.has("domicilios_json")) {
    candidatos.domicilios_procesales = domicilios_procesales;
  }
  if (formData.has("empresas_json")) candidatos.empresas = empresas;
  if (formData.has("jueces_recusados_json")) {
    candidatos.jueces_recusados = jueces_recusados;
  }
  // Assigning `undefined` is deliberate and is NOT the same as skipping the
  // line: mergeEscritosConfig reads Object.hasOwn, so this removes the override
  // and puts the list back to the estudio's members.
  if (formData.has("autorizados_json")) candidatos.autorizados = autorizados;

  // Everything that validated is written; a key with a problem keeps its stored
  // value and says so. The decision itself is a pure function so it is covered
  // by Vitest rather than only by clicking through a form.
  const { patch, rechazadas } = aplicarConfigParcial(configPrevia, candidatos, errores);

  await updateEscritosConfig(
    supabase,
    estudio.id,
    mergeEscritosConfig(configPrevia, patch),
  );

  revalidatePath("/estudio");
  return { ok: true, errores, rechazadas };
}

// --- Valores de referencia (JUS, tasas BCRA) --------------------------------
//
// Both tables are global, not scoped by estudio, and the RLS policies added in
// 20260905130000 only let a head write. These actions return their errors rather
// than throwing so a member who reaches the form gets the reason instead of an
// error page.

export type ValoresState = { ok: string | null; error: string | null };

export async function guardarJus(
  _prev: ValoresState,
  formData: FormData,
): Promise<ValoresState> {
  const supabase = await createClient();
  await requireUser(supabase);

  try {
    await setJusConfig(supabase, {
      value: Number(formData.get("jus_value") ?? 0),
      date: String(formData.get("jus_date") ?? ""),
    });
  } catch (e) {
    return { ok: null, error: e instanceof Error ? e.message : "No se pudo guardar." };
  }

  // Every honorario, liquidación and escrito prints pesos derived from this.
  revalidatePath("/", "layout");
  return { ok: "Valor del JUS actualizado.", error: null };
}

export async function guardarTasas(
  _prev: ValoresState,
  formData: FormData,
): Promise<ValoresState> {
  const supabase = await createClient();
  await requireUser(supabase);

  // The six labelled fields. Read as fields, not re-joined into a line and
  // re-parsed: with the middle box left empty a T.E.A. would slide into the
  // punitorios slot, which is the kind of error nothing downstream can catch.
  const fila = tasaRowFromFields({
    mes: String(formData.get("mes") ?? ""),
    anio: String(formData.get("anio") ?? ""),
    tna: String(formData.get("tna") ?? ""),
    intsPunitorios: String(formData.get("ints_punitorios") ?? ""),
    tea: String(formData.get("tea") ?? ""),
    cft: String(formData.get("cft") ?? ""),
  });
  if ("error" in fila) return { ok: null, error: fila.error };

  // The extra months of a multi-line paste travel as the raw pasted text and are
  // re-parsed here, so the client's parsed list never crosses the wire. The row
  // the fields stand for is dropped from the block: it is the edited one that counts.
  const porClave = new Map(
    parseTasasBlock(String(formData.get("bloque") ?? "")).parsed.map((r) => [
      `${r.anio}-${r.mes}`,
      r,
    ]),
  );
  const reemplaza = String(formData.get("reemplaza") ?? "");
  if (reemplaza) porClave.delete(reemplaza);
  porClave.set(`${fila.row.anio}-${fila.row.mes}`, fila.row);

  const rows = [...porClave.values()];

  try {
    await upsertTasas(supabase, rows);
  } catch (e) {
    return { ok: null, error: e instanceof Error ? e.message : "No se pudo guardar." };
  }

  // Liquidaciones already stored are not recalculated here — they regenerate on
  // the next save of their ejecutado. Only the views that read tasas directly
  // (the calculator, the clamp warning) need to see the new months now.
  revalidatePath("/", "layout");
  return {
    ok: `${rows.length} ${rows.length === 1 ? "mes guardado" : "meses guardados"}.`,
    error: null,
  };
}

// Put the JUS or one month's tasas back to what they were before a recorded
// change. Goes through the same writes a manual edit does, so the head-only RLS
// still applies and the restore is itself logged.
export async function restaurarValor(
  _prev: ValoresState,
  formData: FormData,
): Promise<ValoresState> {
  const supabase = await createClient();
  await requireUser(supabase);

  try {
    const mensaje = await restoreConfigValue(
      supabase,
      String(formData.get("historial_id") ?? ""),
    );
    revalidatePath("/", "layout");
    return { ok: mensaje, error: null };
  } catch (e) {
    return { ok: null, error: e instanceof Error ? e.message : "No se pudo restaurar." };
  }
}
