"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatCurrency } from "@/lib/domain/liquidaciones";
import { parseLocalDate } from "@/lib/domain/dates";
import { renderTemplate } from "@/lib/domain/template-engine";
import {
  buildEncabezado,
  resolveAbogado,
  resolveCuentaHonorarios,
  resolveEmpresa,
  resolveDomicilioProcesal,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { type Empresa } from "@/lib/domain/escritos";

function money(value: number | null | undefined): string {
  return `$${formatCurrency(Number(value ?? 0))}`;
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return parseLocalDate(dateStr).toLocaleDateString("es-AR");
}

export async function generarEscrito(ejecutadoId: string, formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "");
  if (!templateId) throw new Error("template_id is required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const [{ data: template }, { data: ej }, { data: profile }] = await Promise.all([
    supabase.from("escritos_templates").select("*").eq("id", templateId).single(),
    supabase.from("ejecutados").select("*").eq("id", ejecutadoId).single(),
    supabase
      .from("lawyer_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!template) throw new Error("template not found");
  if (!ej) throw new Error("ejecutado not found");

  const [{ data: liq }, { data: estudio }] = await Promise.all([
    supabase
      .from("liquidaciones")
      .select("*")
      .eq("ejecutado_id", ejecutadoId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("estudios")
      .select("escritos_config")
      .eq("id", ej.estudio_id)
      .maybeSingle(),
  ]);

  const config = (estudio?.escritos_config ?? {}) as EstudioEscritosConfig;
  const empresaKey = ej.empresa as Empresa | null;
  const empresa = resolveEmpresa(config, empresaKey);

  const abogado = resolveAbogado(
    profile
      ? {
          nombre: profile.nombre,
          matricula: profile.matricula,
          legajo: profile.legajo,
          cuit: profile.cuit,
          ibm: profile.ibm,
          ivaCondicion: profile.iva_condicion,
          domicilioElectronico: profile.domicilio_electronico,
          telefono: profile.telefono,
        }
      : null,
  );

  const encabezado = buildEncabezado({
    abogado,
    empresa,
    domicilioProcesal: resolveDomicilioProcesal(config, ej.departamento),
    demandado: ej.nombre,
    expediente: ej.numero_expediente,
  });

  const gastos = Number(liq?.gastos ?? ej.gastos ?? 0);

  const tokens: Record<string, string> = {
    ENCABEZADO: encabezado,
    CUENTA_HONORARIOS: resolveCuentaHonorarios(config),
    EMPRESA: empresa?.razonSocial ?? "",
    CUIT_EMPRESA: empresa?.cuit ?? "",
    DEMANDADO: ej.nombre ?? "",
    FECHA_HOY: new Date().toLocaleDateString("es-AR"),
  };

  if (liq) {
    tokens.CAPITAL = money(liq.capital);
    tokens.FECHA_MORA = fmtDate(liq.fecha_desde);
    tokens.IVA_INTERESES = money(liq.iva);
    tokens.TOTAL_LIQUIDACION = money(liq.monto_adeudado);
    tokens.GASTOS_LINEA = gastos > 0 ? `• Gastos: ${money(gastos)}` : "";
  }

  const contenido = renderTemplate(template.contenido, tokens);

  const { data: created, error } = await supabase
    .from("escritos")
    .insert({
      estudio_id: ej.estudio_id,
      ejecutado_id: ejecutadoId,
      template_id: template.id,
      created_by_user_id: user.id,
      titulo: template.titulo,
      contenido,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/escritos");
  revalidatePath(`/ejecutados/${ejecutadoId}`);
  redirect(`/escritos/${created.id}`);
}
