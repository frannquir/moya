

import { type Empresa } from "./escritos";

export type AbogadoConfig = {
  nombre: string;
  matricula: string;
  legajo: string;
  cuit: string;
  ibm: string;
  ivaCondicion: string;
  domicilioElectronico: string;
  telefono: string;
  /**
   * A real inbox, unlike domicilioElectronico — which is the SCBA notification
   * address and nobody reads. The convenio asks the debtor to send the deposit
   * receipt here, so it has to be somewhere the estudio actually looks.
   */
  email: string;
};

// Placeholder defaults
export const ABOGADO_DEFAULT: AbogadoConfig = {
  nombre: "NOMBRE Y APELLIDO DEL ABOGADO",
  matricula: "Tº __ Fº ___ del Colegio de Abogados de __________",
  legajo: "00000-0",
  cuit: "00-00000000-0",
  ibm: "00-00000000-0",
  ivaCondicion: "Responsable Inscripto",
  domicilioElectronico: "00000000000@notificaciones.scba.gov.ar",
  telefono: "000-0000000",
  email: "CORREO DEL ESTUDIO",
};

/**
 * The estudio's account for regulated fees, in named parts.
 *
 * `texto` carries a value entered before the split, verbatim. Nothing tries to
 * pull a CBU back out of that prose — a regex that guesses wrong puts the wrong
 * account number in a court filing.
 */
export type CuentaHonorariosConfig = {
  tipo: string;
  banco: string;
  numero: string;
  cbu: string;
  alias: string;
  dni: string;
  titular: string;
  texto?: string;
};

export const CUENTA_HONORARIOS_DEFAULT: CuentaHonorariosConfig = {
  tipo: "Caja de ahorro",
  banco: "__________",
  numero: "0000000-0 000-0",
  cbu: "0000000000000000000000",
  alias: "ALIAS.CBU",
  dni: "00000000",
  titular: "NOMBRE Y APELLIDO",
};

/**
 * The one line the templates expect. Both call sites need a noun phrase — "a la
 * {{CUENTA_HONORARIOS}}" and "en la siguiente cuenta: {{CUENTA_HONORARIOS}}" —
 * so an empty part drops its whole clause instead of leaving "CBU: ,".
 */
export function formatCuentaHonorarios(
  cuenta: Partial<CuentaHonorariosConfig> | null | undefined,
): string {
  const v = (s: string | null | undefined) => (s ?? "").trim();
  if (!cuenta) return "";

  const cabecera = [v(cuenta.tipo), v(cuenta.banco) && `del Banco ${v(cuenta.banco)}`]
    .filter(Boolean)
    .join(" ");

  return [
    cabecera,
    v(cuenta.numero) && `Cuenta Nro: ${v(cuenta.numero)}`,
    v(cuenta.cbu) && `CBU: ${v(cuenta.cbu)}`,
    v(cuenta.dni) && `DNI: ${v(cuenta.dni)}`,
    v(cuenta.alias) && `Alias de CBU: ${v(cuenta.alias)}`,
    v(cuenta.titular) && `de titularidad de ${v(cuenta.titular)}`,
  ]
    .filter(Boolean)
    .join(", ");
}

export const CUENTA_HONORARIOS = formatCuentaHonorarios(CUENTA_HONORARIOS_DEFAULT);

export type EmpresaConfig = {
  razonSocial: string;
  domicilioLegal: string;
  cuit: string;
  /**
   * Where the debtor deposits the capital under a convenio. One free-text line,
   * the way the firm writes it: "Cuenta 1610-01079/3, CBU 2990…, del Banco
   * Comafi Sucursal 161". Per empresa, because the acreedor is the account
   * holder — the source convenio names Tartan's account on a Contar convenio,
   * which is precisely the defect this removes.
   */
  cuentaBancaria: string;
};

export function getConfiguredDepartamentos(
  config: EstudioEscritosConfig | null | undefined,
): string[] {
  const map = config?.domicilios_procesales;
  if (!map) return [];
  return Object.keys(map)
    .map((d) => d.trim())
    .filter((d) => d !== "");
}

export function getConfiguredEmpresas(
  config: EstudioEscritosConfig | null | undefined,
): string[] {
  const map = config?.empresas;
  if (!map) return [];
  return Object.keys(map)
    .map((e) => e.trim())
    .filter((e) => e !== "");
}

export type EstudioEscritosConfig = {
  /** An object since the split; a plain string is a value saved before it. */
  cuenta_honorarios?: string | CuentaHonorariosConfig;
  /**
   * The apoderado every escrito is presented by — the estudio's owner, not
   * whoever clicks generate (Fran, 2026-08-22). The head is a lawyer who works
   * for the owner, so building the encabezado from the current user's profile
   * would have had a member sign as apoderado.
   */
  encargado?: Partial<AbogadoConfig>;
  domicilios_procesales?: Record<string, string>;
  empresas?: Record<string, EmpresaConfig>;
};

function nonEmpty(value: string | null | undefined): boolean {
  return !!value && String(value).trim() !== "";
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function resolveCuentaHonorarios(
  config: EstudioEscritosConfig | null | undefined,
): string {
  const v = config?.cuenta_honorarios;
  if (typeof v === "string") return nonEmpty(v) ? v : CUENTA_HONORARIOS;
  const compuesta = formatCuentaHonorarios(v);
  if (compuesta !== "") return compuesta;
  if (nonEmpty(v?.texto)) return v!.texto as string;
  return CUENTA_HONORARIOS;
}

/** The stored value as parts, whichever shape it is in, for the settings form. */
export function cuentaHonorariosPartes(
  config: EstudioEscritosConfig | null | undefined,
): CuentaHonorariosConfig {
  const vacia: CuentaHonorariosConfig = {
    tipo: "", banco: "", numero: "", cbu: "", alias: "", dni: "", titular: "",
  };
  const v = config?.cuenta_honorarios;
  if (typeof v === "string") return { ...vacia, texto: v };
  return { ...vacia, ...(v ?? {}) };
}

export type Genero = "F" | "M";

/**
 * The treatment that precedes a name in section IX. Two axes, because the source
 * demanda uses both: "la Dra. María Victoria Iñurrieta" is a female lawyer,
 * "Sr. Lautaro Moyano" is a man who is not one.
 *
 *   abogado + F -> Dra.      abogado + M -> Dr.
 *      otro + F -> Sra.         otro + M -> Sr.
 *
 * An unknown genero prints a bare name rather than guessing at it.
 */
export function tratamientoDe(
  genero: string | null | undefined,
  esAbogado: boolean | null | undefined = false,
): string {
  if (genero === "F") return esAbogado ? "Dra." : "Sra.";
  if (genero === "M") return esAbogado ? "Dr." : "Sr.";
  return "";
}

/**
 * The definite article the treatment needs in running text: section IX reads
 * "…con las presentes actuaciones la Dra. María Victoria Iñurrieta…", and
 * without it the sentence is ungrammatical.
 *
 * The source demanda is inconsistent about this — it writes "la Dra. …" but then
 * a bare "Sr. Lautaro Moyano". Applied uniformly here (gotcha #35: read the
 * firm's models for sense, do not carry their defects forward).
 */
export function articuloDe(genero: string | null | undefined): string {
  if (genero === "F") return "la";
  if (genero === "M") return "el";
  return "";
}

/** "la Dra. María Victoria Iñurrieta", or a bare name when genero is unknown. */
export function nombreConTratamiento(m: MiembroAutorizado): string {
  const nombre = (m.nombre ?? "").trim();
  if (nombre === "") return "";
  const tratamiento = tratamientoDe(m.genero, m.es_abogado);
  if (tratamiento === "") return nombre;
  return `${articuloDe(m.genero)} ${tratamiento} ${nombre}`;
}

export type MiembroAutorizado = {
  nombre: string | null;
  genero?: string | null;
  es_abogado?: boolean | null;
};

/**
 * Section IX of the demanda ("Quedan autorizados a realizar cualquier trámite…
 * {{AUTORIZADOS}} y/o quienes ellos designen"), so this resolves to a name list
 * only — the sentence around it lives in the template.
 *
 * Derived from the estudio's own members (Fran, 2026-08-22), head first, the
 * presenting lawyer included. A member with no nombre is skipped: a blank profile
 * must not leave a dangling " y/o ". An empty result returns "" so the caller can
 * leave the token unset and let the [AUTORIZADOS] marker show — the designed
 * escape hatch, and the right answer when nobody has filled in a profile.
 */
export function formatAutorizados(miembros: MiembroAutorizado[]): string {
  return miembros
    .map(nombreConTratamiento)
    .filter((n) => n !== "")
    .join(" y/o ");
}

export function resolveEmpresa(
  config: EstudioEscritosConfig | null | undefined,
  key: Empresa | null,
): EmpresaConfig | null {
  if (!key) return null;
  const override = config?.empresas?.[key];
  if (!override) return null;
  return {
    razonSocial: override.razonSocial ?? "",
    domicilioLegal: override.domicilioLegal ?? "",
    cuit: override.cuit ?? "",
    cuentaBancaria: override.cuentaBancaria ?? "",
  };
}

export function resolveDomicilioProcesal(
  config: EstudioEscritosConfig | null | undefined,
  departamento: string | null | undefined,
): string {
  const map = config?.domicilios_procesales;
  if (!departamento || !map) return "";
  const target = normalizeKey(departamento);
  if (!target) return "";
  const direct = map[departamento.trim()];
  if (nonEmpty(direct)) return direct as string;
  for (const [key, value] of Object.entries(map)) {
    if (normalizeKey(key) === target && nonEmpty(value)) return value;
  }
  return "";
}

/**
 * The apoderado for the encabezado. Any field the estudio has not filled in
 * falls back to a visible placeholder, so an unconfigured estudio produces
 * "NOMBRE Y APELLIDO DEL ABOGADO, abogado inscripto al Tº __ Fº ___…" rather
 * than a sentence with holes in it.
 */
export function resolveEncargado(
  config: EstudioEscritosConfig | null | undefined,
): AbogadoConfig {
  return resolveAbogado(config?.encargado);
}

export function resolveAbogado(
  profile: Partial<AbogadoConfig> | null | undefined,
): AbogadoConfig {
  if (!profile) return ABOGADO_DEFAULT;
  const pick = (key: keyof AbogadoConfig) => {
    const v = profile[key];
    return v && String(v).trim() ? String(v) : ABOGADO_DEFAULT[key];
  };
  return {
    nombre: pick("nombre"),
    matricula: pick("matricula"),
    legajo: pick("legajo"),
    cuit: pick("cuit"),
    ibm: pick("ibm"),
    ivaCondicion: pick("ivaCondicion"),
    domicilioElectronico: pick("domicilioElectronico"),
    telefono: pick("telefono"),
    email: pick("email"),
  };
}

export type EncabezadoInput = {
  abogado: AbogadoConfig;
  empresa: EmpresaConfig | null;
  domicilioProcesal: string;
  demandado: string;
  expediente: string;
  /** Demanda only: drop the "en autos caratulados … (Expt. N° …)" caption. */
  sinAutos?: boolean;
};

export function buildEncabezado({
  abogado,
  empresa,
  domicilioProcesal,
  demandado,
  expediente,
  sinAutos = false,
}: EncabezadoInput): string {
  const razonSocial = empresa?.razonSocial || "[EMPRESA]";
  const domicilioLegal = empresa?.domicilioLegal || "[DOMICILIO_LEGAL_EMPRESA]";
  const procesal = domicilioProcesal || "[DOMICILIO_PROCESAL]";
  const demandadoUpper = (demandado || "[DEMANDADO]").toUpperCase();
  const expt = expediente || "[EXPEDIENTE]";

  const comparecencia = sinAutos
    ? // A demanda is the document filed to OBTAIN a case number, so there are no
      // autos to caption and no expediente to cite — DEMANDA.docx ends the
      // header exactly here. Including the caption would print an [EXPEDIENTE]
      // marker on every demanda the firm ever generates.
      `, ante V.S. me presento y respetuosamente digo:`
    : `; en autos caratulados "${razonSocial} C/ ${demandadoUpper} S/ COBRO EJECUTIVO" ` +
      `(Expt. N° ${expt}) ante V.S. respetuosamente digo:`;

  return (
    `${abogado.nombre}, abogado inscripto al ${abogado.matricula}, ` +
    `Legajo Previsional nº ${abogado.legajo}, CUIT Nº ${abogado.cuit}, ` +
    `IBM Nº ${abogado.ibm}, IVA ${abogado.ivaCondicion}, en mi carácter de ` +
    `apoderado de ${razonSocial} con domicilio legal en ${domicilioLegal}, ` +
    `constituyendo domicilio procesal en la ${procesal} y domicilio electrónico ` +
    `en ${abogado.domicilioElectronico}, Teléfono de contacto: ${abogado.telefono}` +
    comparecencia
  );
}
