import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";
import { type Tables } from "@/lib/supabase/db-helpers";
import { formatCurrency } from "@/lib/domain/liquidaciones";
import { parseLocalDate } from "@/lib/domain/dates";
import { renderTemplate, type TemplateRecord, type TemplateScope } from "@/lib/domain/template-engine";
import {
  buildEncabezado,
  formatAutorizados,
  resolveCuentaHonorarios,
  resolveEmpresa,
  resolveDomicilioProcesal,
  resolveJuezRecusado,
  type AbogadoConfig,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { type Empresa } from "@/lib/domain/escritos";
import {
  cautelarScope,
  parteRecord,
  resolveCautelar,
  separadoresDeLista,
  type ParteCautelar,
} from "@/lib/domain/cautelar";
import { montoALetras, numeroALetras, formatMontoNumerico } from "@/lib/domain/numero-a-letras";
import {
  CONVENIO_CLAVE,
  cuotasTexto,
  fechaEnLetras,
  planDePagos,
} from "@/lib/domain/convenio";
import { techoHonorario } from "@/lib/domain/honorarios";
import { getJusValue } from "@/lib/data/honorarios";
import { cuilToDni, formatDni, isValidCuil } from "@/lib/domain/cuil";
import { getById as getJuzgadoById } from "@/lib/data/juzgados";
import { listByEjecutado } from "@/lib/data/codemandados";
import { listMembers } from "@/lib/data/estudio";

type Client = SupabaseClient<Database>;

// The demanda template's clave. Matched on clave, never on título (gotcha #31).
export const DEMANDA_CLAVE = "demanda.cobro-ejecutivo";

/** Where the cautelar fragment is spliced into the demanda body before rendering. */
export const SECCION_CAUTELAR_TOKEN = "{{SECCION_CAUTELAR}}";

// Re-exported so callers reach one place for both document claves.
export { CONVENIO_CLAVE };

function money(value: number | null | undefined): string {
  return `$${formatCurrency(Number(value ?? 0))}`;
}

/**
 * Dates as the firm's own documents write them: zero-padded dd/mm/yyyy.
 *
 * A bare toLocaleDateString("es-AR") does NOT pad - it yields "22/9/2026" - and
 * that shipped into the convenio next to a schedule built with formatArDate,
 * so clause SEGUNDA read "vencimiento la primera el 22/9/2026" above rows
 * saying "22/09/2026". Same date, two formats, one clause.
 *
 * Not formatArDate itself, only its options: that helper returns an em dash for
 * a missing value, and here an empty string is load-bearing - it is what makes
 * the engine print the visible [FECHA_MORA] marker instead of a dash that looks
 * like real content.
 */
function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return parseLocalDate(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}


/**
 * The parties of a case in document order: the demandado first, then the
 * codemandados by `orden`. This ordering is what the cautelar composer and the
 * ANTECEDENTES listing both depend on.
 */
export async function loadPartes(
  supabase: Client,
  ejecutado: Tables<"ejecutados">,
): Promise<{ partes: ParteCautelar[]; tarjetas: string[] }> {
  const codemandados = await listByEjecutado(supabase, ejecutado.id);

  const demandado: ParteCautelar = {
    nombre: ejecutado.nombre ?? "",
    cuil: ejecutado.cuil ?? "",
    domicilio: ejecutado.domicilio ?? "",
    trabaja: ejecutado.trabaja === true,
    empleador:
      ejecutado.trabaja === true
        ? {
            nombre: ejecutado.empleador_nombre ?? "",
            cuit: ejecutado.empleador_cuit ?? "",
            domicilio: ejecutado.empleador_domicilio ?? "",
          }
        : null,
  };

  const partes: ParteCautelar[] = [
    demandado,
    ...codemandados.map((c) => ({
      nombre: c.nombre ?? "",
      cuil: c.cuil ?? "",
      domicilio: c.domicilio ?? "",
      trabaja: c.trabaja === true,
      empleador: c.trabaja
        ? {
            nombre: c.empleador_nombre ?? "",
            cuit: c.empleador_cuit ?? "",
            domicilio: c.empleador_domicilio ?? "",
          }
        : null,
    })),
  ];

  // Card numbers are per party and live alongside the party, so they travel in
  // parallel rather than inside ParteCautelar (which the cautelar fragments own).
  const tarjetas = [
    ejecutado.tarjeta_cabal ?? "",
    ...codemandados.map((c) => c.tarjeta_cabal ?? ""),
  ];

  return { partes, tarjetas };
}

/**
 * Section VII, composed. resolveCautelar picks which of the three fragments to
 * use; the wording itself comes from the escritos_templates row so the firm can
 * reword it without a deploy.
 */
export async function loadSeccionCautelar(
  supabase: Client,
  partes: ParteCautelar[],
): Promise<{ cuerpo: string; scope: TemplateScope }> {
  const plan = resolveCautelar(partes);
  const { data: fragmento } = await supabase
    .from("escritos_templates")
    .select("contenido")
    .eq("clave", plan.clave)
    .maybeSingle();

  if (!fragmento) {
    throw new Error(
      `Falta el fragmento de medida cautelar "${plan.clave}". ` +
        "¿Se corrió la migración 20260821120000_demanda_documento?",
    );
  }
  // Returned UNRENDERED. It used to be rendered here and injected as a finished
  // string, which meant the demanda was two render passes — and a {{SECCION}}
  // counter cannot span two passes, so the cautelar heading could not number
  // itself. The caller splices this into the body and renders once.
  return { cuerpo: fragmento.contenido, scope: cautelarScope(plan) };
}

export type EscritoScope = {
  scope: TemplateScope;
  ejecutado: Tables<"ejecutados">;
  /**
   * The medida cautelar fragment, unrendered, for the caller to splice into the
   * body at {{SECCION_CAUTELAR}} before the single render. Null for anything
   * that is not a demanda.
   */
  cuerpoCautelar: string | null;
};

/**
 * Every token an escrito body can reach. `esDemanda` adds the demanda-only half:
 * the composed cautelar section, the amount in words, the party list, and an
 * encabezado without the "en autos caratulados … (Expt. N° …)" clause — a demanda
 * is filed to OBTAIN a case number, so that clause would print an [EXPEDIENTE]
 * marker on every one.
 */
export async function buildEscritoScope(
  supabase: Client,
  // No userId: the encabezado comes from the estudio's Encargado and the
  // autorizados from its members, so nothing here depends on who is generating.
  opts: { ejecutadoId: string; esDemanda: boolean; esConvenio?: boolean },
): Promise<EscritoScope> {
  const { data: ej } = await supabase
    .from("ejecutados")
    .select("*")
    .eq("id", opts.ejecutadoId)
    .single();
  if (!ej) throw new Error("ejecutado not found");

  const [{ data: liq }, { data: estudio }, juzgado] = await Promise.all([
    supabase
      .from("liquidaciones")
      .select("*")
      .eq("ejecutado_id", opts.ejecutadoId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("estudios")
      .select("escritos_config")
      .eq("id", ej.estudio_id)
      .maybeSingle(),
    ej.juzgado_id ? getJuzgadoById(supabase, ej.juzgado_id) : Promise.resolve(null),
  ]);

  const config = (estudio?.escritos_config ?? {}) as EstudioEscritosConfig;
  const empresaKey = ej.empresa as Empresa | null;
  const empresa = resolveEmpresa(config, empresaKey);

  // The apoderado is the estudio's Encargado, NOT the current user (Fran,
  // 2026-08-22). The head is a lawyer who works for the owner of the estudio, so
  // reading the presenter's own profile here would have had whoever clicked
  // generate sign the escrito as apoderado.
  //
  // Passed RAW. It used to go through resolveEncargado, which filled every blank
  // with ABOGADO_DEFAULT — so an unconfigured estudio filed a document reading
  // "CUIT Nº 00-00000000-0" and nothing warned about it, because a placeholder
  // is not a [TOKEN] and extractUnresolved only sees [TOKEN].
  const abogado = config.encargado ?? {};

  const encabezado = buildEncabezado({
    abogado,
    empresa,
    domicilioProcesal: resolveDomicilioProcesal(config, ej.departamento),
    demandado: ej.nombre,
    expediente: ej.numero_expediente,
    sinAutos: opts.esDemanda,
  });

  const gastos = Number(liq?.gastos ?? ej.gastos ?? 0);
  const interesGastos = Number(liq?.interes_gastos ?? ej.interes_gastos ?? 0);

  // The liquidación long stored only the combined total_intereses, so rows
  // written before the split columns existed have neither half. By construction
  // punitorios is exactly half the compensatorios (see calcularLiquidacion), so
  // the combined figure splits 2/3 - 1/3 — an exact fallback, asserted in
  // liquidaciones.test.ts. New rows carry the real snapshot and use it.
  const totalIntereses = Number(liq?.total_intereses ?? 0);
  const compensatorios = Number(liq?.total_compensatorios ?? (totalIntereses * 2) / 3);
  const punitorios = Number(liq?.total_punitorios ?? totalIntereses / 3);

  // Set only on the demanda branch; spliced into the body by generarDemanda.
  let cuerpoCautelar: string | null = null;

  const scope: TemplateScope = {
    ENCABEZADO: encabezado,
    CUENTA_HONORARIOS: resolveCuentaHonorarios(config),
    EMPRESA: empresa?.razonSocial ?? "",
    CUIT_EMPRESA: empresa?.cuit ?? "",
    DOMICILIO_LEGAL_EMPRESA: empresa?.domicilioLegal ?? "",
    DEMANDADO: ej.nombre ?? "",
    FECHA_HOY: new Date().toLocaleDateString("es-AR"),
    DEPARTAMENTO: ej.departamento ?? "",
  };

  // Court data (available to any template via {{JUZGADO_*}} / {{JUEZ}}).
  if (juzgado) {
    scope.JUZGADO = juzgado.organismo ?? "";
    scope.JUZGADO_DOMICILIO = juzgado.direccion ?? "";
    scope.JUZGADO_LOCALIDAD = juzgado.localidad ?? "";
    scope.JUZGADO_TELEFONO = juzgado.telefono ?? "";
    scope.JUZGADO_EMAIL = juzgado.email ?? "";
    scope.JUEZ = juzgado.juez ?? "";
  }

  if (liq) {
    scope.CAPITAL = money(liq.capital);
    scope.FECHA_MORA = fmtDate(liq.fecha_desde);
    scope.INTERESES_COMPENSATORIOS = money(compensatorios);
    scope.INTERESES_PUNITORIOS = money(punitorios);
    scope.IVA_INTERESES = money(liq.iva);
    scope.GASTOS = money(gastos);
    scope.INTERES_GASTOS = money(interesGastos);
    scope.TOTAL_LIQUIDACION = money(liq.monto_adeudado);
    // Legacy: the bullet list used to carry a conditional gastos line. Kept
    // resolving so escritos generated from an older template body don't come
    // out with a "[GASTOS_LINEA]" marker in them.
    scope.GASTOS_LINEA = gastos > 0 ? `• Gastos: ${money(gastos)}` : "";
  }

  if (opts.esDemanda) {
    const { partes, tarjetas } = await loadPartes(supabase, ej);

    // The demanda's own party list carries the card numbers and the join
    // separator on top of what the cautelar fragments need, so ANTECEDENTES can
    // read "… 5042… (TITULAR) y 6002… (ADICIONAL)" out of one {{#each}}.
    const partesRecords: TemplateRecord[] = partes.map((p, i) => ({
      ...parteRecord(p, i),
      TARJETA_CABAL: tarjetas[i] ?? "",
      ...separadoresDeLista(i, partes.length),
    }));

    const monto = Number(ej.deuda_inicial ?? 0);

    // Section XII (recusación sin expresión de causa) is printed ONLY for a case
    // whose court the estudio has put on the recusados list, and prints the name
    // from that list. juzgados.juez is deliberately not a fallback: it is filled
    // for essentially every court, so falling back would recuse a judge on every
    // demanda ever generated. No entry = no section, and {{SECCION}} closes the
    // numbering over the gap.
    const juezRecusado = resolveJuezRecusado(config, ej.juzgado_id);
    scope.HAY_RECUSACION = juezRecusado !== "";
    if (juezRecusado !== "") scope.JUEZ_RECUSADO = juezRecusado;

    const cautelar = await loadSeccionCautelar(supabase, partes);
    cuerpoCautelar = cautelar.cuerpo;
    // The fragment's own scope first, then the demanda's richer values on top:
    // both define PARTES and HAY_CODEMANDADOS, and the demanda's PARTES is a
    // superset (it adds TARJETA_CABAL and the list separators), so one merged
    // scope serves both without the fragment losing anything.
    Object.assign(scope, cautelar.scope);
    scope.PARTES = partesRecords;
    scope.DEMANDADOS = partes.map((p) => p.nombre).join(" Y ");
    scope.DOMICILIO = ej.domicilio ?? "";
    scope.TARJETA_CABAL = ej.tarjeta_cabal ?? "";
    scope.CUENTA_CLIPER = ej.cuenta_cliper ?? "";
    scope.FECHA_CONTRATO = fmtDate(ej.fecha_contrato);
    // The only DOCUMENTAL count still variable: contrato (14) and acuse (2) are
    // literals in the body since 20260823140000_fojas. Left unset when NULL so
    // the [FOJAS_RESUMENES] marker shows rather than a made-up number.
    if (ej.fojas_resumenes !== null) scope.FOJAS_RESUMENES = String(ej.fojas_resumenes);
    scope.MONTO = formatMontoNumerico(monto);
    scope.MONTO_LETRAS = montoALetras(monto);
    // Section IX lists the estudio's own members, head first, the presenting
    // lawyer included (Fran, 2026-08-22). get_estudio_members() is SECURITY
    // DEFINER and scoped to current_estudio_id(), so it needs the caller's
    // session: a service-role client sees nothing and the marker shows instead.
    const autorizados = formatAutorizados(await listMembers(supabase));
    if (autorizados !== "") scope.AUTORIZADOS = autorizados;
    scope.HAY_CODEMANDADOS = partes.length > 1;
    scope.VARIOS_CODEMANDADOS = partes.length > 2;
    // Prose, so lowercase: "se emitieron dos tarjetas plásticas".
    scope.CANTIDAD_PARTES_LETRAS = numeroALetras(partes.length).toLowerCase();
    // FECHA_MORA is normally the liquidación's start date; a demanda generated
    // before one exists still needs it, and ejecutados.fecha_mora is the source
    // that generateLiquidacion itself reads.
    if (!scope.FECHA_MORA) scope.FECHA_MORA = fmtDate(ej.fecha_mora);
  }

  if (opts.esConvenio) {
    Object.assign(scope, await convenioScope(supabase, ej, config, abogado, empresa));
  }

  return { scope, ejecutado: ej, cuerpoCautelar };
}

/**
 * The convenio-only half of the scope.
 *
 * Kept behind its own flag and its own function for the same reason `esDemanda`
 * is: these tokens cost an extra round trip (the honorario and the JUS value),
 * and every other escrito in the library must keep generating byte-identically.
 * Nothing here leaks into the shared scope.
 *
 * Anything the case or the estudio has not filled in comes through as an empty
 * string on purpose — the engine turns that into a visible [TOKEN] marker, which
 * is how the lawyer notices the gap before the debtor signs rather than after.
 */
async function convenioScope(
  supabase: Client,
  ej: Tables<"ejecutados">,
  config: EstudioEscritosConfig,
  abogado: Partial<AbogadoConfig>,
  empresa: ReturnType<typeof resolveEmpresa>,
): Promise<TemplateScope> {
  const monto = Number(ej.monto_acuerdo ?? 0);
  const cuotas = Number(ej.cuotas ?? 1);
  const fechaVencimiento = ej.fecha_vencimiento ?? "";

  const [honorario, jusValue] = await Promise.all([
    supabase
      .from("honorarios")
      .select("monto_total_jus, max_acordado_ars")
      .eq("ejecutado_id", ej.id)
      .is("archived_at", null)
      .maybeSingle()
      .then((r) => r.data),
    getJusValue(supabase),
  ]);

  const scope: TemplateScope = {
    // The apoderado, from the estudio's Encargado (decision #18) — the convenio's
    // first line is "Entre el Dr. … en su carácter de letrado apoderado de …",
    // so it must name the estudio's apoderado and not whoever clicked generate.
    // Empty, never a default: this function's own contract above is that an
    // unfilled value arrives as "" so the engine prints a [TOKEN] marker.
    ABOGADO_NOMBRE: abogado.nombre ?? "",
    ABOGADO_TELEFONO: abogado.telefono ?? "",
    ABOGADO_EMAIL: abogado.email ?? "",
    // The estudio's physical address for this departamento. The source convenio
    // gives the apoderado's domicilio as the estudio's street address, which is
    // exactly what domicilios_procesales already holds.
    DOMICILIO_PROCESAL: resolveDomicilioProcesal(config, ej.departamento),

    DEMANDADO: ej.nombre ?? "",
    DEMANDADO_MAYUSCULA: (ej.nombre ?? "").toUpperCase(),
    DOMICILIO: ej.domicilio ?? "",
    DNI_DEMANDADO: ej.cuil ? formatDni(cuilToDni(ej.cuil)) : formatDni(ej.documento ?? ""),
    EXPEDIENTE: ej.numero_expediente ?? "",
    FECHA_MORA: fmtDate(ej.fecha_mora),
    CUENTA_ACREEDOR: empresa?.cuentaBancaria ?? "",

    // The settlement. MONTO_LETRAS is the DEUDA RECONOCIDA here, not the
    // deuda_inicial the demanda prints — the two documents never render together.
    MONTO: formatMontoNumerico(monto),
    MONTO_LETRAS: montoALetras(monto),
    CUOTAS_TEXTO: cuotasTexto(monto, cuotas),
    FECHA_VENCIMIENTO: fmtDate(fechaVencimiento),
    // A single payment is fully described by "en UN PAGO. Con vencimiento la
    // primera el …", so the schedule block is suppressed rather than printing a
    // one-row table restating the sentence above it.
    HAY_CUOTAS: cuotas > 1,
    PLAN_PAGOS:
      cuotas > 1 && fechaVencimiento !== ""
        ? planDePagos(monto, cuotas, fechaVencimiento)
        : [],

    FECHA_FIRMA_LETRAS: fechaEnLetras(new Date()),
  };

  // The DNI comes off the encargado's own CUIT (gotcha #36: strip the prefix,
  // the check digit AND the zero pad). Only when one is actually configured —
  // ABOGADO_DEFAULT's placeholder CUIT would otherwise print "D.N.I. N° 0".
  const encargadoCuit = config?.encargado?.cuit ?? "";
  if (isValidCuil(encargadoCuit)) {
    scope.ABOGADO_DNI = formatDni(cuilToDni(encargadoCuit));
  }

  // Honorarios: the regulated base from the case's own honorario row, and the
  // total from lib/domain/honorarios.ts. The tax math is NOT recomputed here —
  // techoHonorario() resolves the same ceiling the DB trigger enforces. A
  // convenio names the figure the debtor actually agreed to, so a settled
  // máximo (a peso amount) wins over the ×1.31 one.
  const baseJus = Number(honorario?.monto_total_jus ?? 0);
  if (baseJus > 0) {
    scope.HONORARIOS_JUS = baseJus.toLocaleString("es-AR", { maximumFractionDigits: 2 });
    scope.HONORARIOS_TOTAL_LETRAS = montoALetras(
      techoHonorario({
        baseJus,
        maxAcordadoArs: honorario?.max_acordado_ars ?? null,
        // The clause states the ceiling, not the balance, so collections do not
        // enter here — pendiente is irrelevant to what the convenio names.
        pagadoJus: 0,
        pagadoArs: 0,
        jusValue,
      }).capArs,
    );
  }

  return scope;
}

/**
 * The most recently generated demanda for a case, for the Demanda card's
 * "Copiar" and "Ver escrito". Two queries rather than a join: the escritos row
 * points at a template id, and the template is found by clave.
 */
export async function getUltimaDemanda(
  supabase: Client,
  ejecutadoId: string,
): Promise<{ id: string; contenido: string } | null> {
  const { data: template } = await supabase
    .from("escritos_templates")
    .select("id")
    .eq("clave", DEMANDA_CLAVE)
    .maybeSingle();
  if (!template) return null;

  const { data } = await supabase
    .from("escritos")
    .select("id, contenido")
    .eq("ejecutado_id", ejecutadoId)
    .eq("template_id", template.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

/** Insert the generated document. Always a new row — never an overwrite. */
export async function insertEscrito(
  supabase: Client,
  input: {
    estudioId: string;
    ejecutadoId: string;
    templateId: string;
    userId: string;
    titulo: string;
    contenido: string;
  },
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("escritos")
    .insert({
      estudio_id: input.estudioId,
      ejecutado_id: input.ejecutadoId,
      template_id: input.templateId,
      created_by_user_id: input.userId,
      titulo: input.titulo,
      contenido: input.contenido,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Generate the demanda for a case from its current data and store it. Used both
 * by "Iniciar demanda" and by "Generar de nuevo" on the Demanda card — the party
 * list may have changed since, and a regeneration always produces a NEW escrito
 * row because the previous one may already have been filed.
 */
export async function generarDemanda(
  supabase: Client,
  opts: { ejecutadoId: string; userId: string },
): Promise<{ id: string }> {
  const { data: template } = await supabase
    .from("escritos_templates")
    .select("id, titulo, contenido")
    .eq("clave", DEMANDA_CLAVE)
    .maybeSingle();

  if (!template) {
    throw new Error(
      `Falta la plantilla "${DEMANDA_CLAVE}". ` +
        "¿Se corrió la migración 20260821120000_demanda_documento?",
    );
  }

  const { scope, ejecutado, cuerpoCautelar } = await buildEscritoScope(supabase, {
    ejecutadoId: opts.ejecutadoId,
    esDemanda: true,
  });

  // One render for the whole document, cautelar fragment included, so {{SECCION}}
  // numbers every heading in document order. A function replacer, because the
  // fragment is arbitrary text and "$&" in it must not be treated as a group ref.
  const cuerpo =
    cuerpoCautelar === null
      ? template.contenido
      : template.contenido.replace(SECCION_CAUTELAR_TOKEN, () => cuerpoCautelar);

  return insertEscrito(supabase, {
    estudioId: ejecutado.estudio_id,
    ejecutadoId: opts.ejecutadoId,
    templateId: template.id,
    userId: opts.userId,
    titulo: template.titulo,
    contenido: renderTemplate(cuerpo, scope),
  });
}
