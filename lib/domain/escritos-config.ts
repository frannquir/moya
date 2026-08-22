

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
};

export const CUENTA_HONORARIOS =
  "Caja de ahorro del Banco __________, " +
  "Cuenta Nro: 0000000-0 000-0, CBU: 0000000000000000000000, " +
  "DNI: 00000000, Alias de CBU: ALIAS.CBU, de titularidad de NOMBRE Y APELLIDO";

export type EmpresaConfig = {
  razonSocial: string;
  domicilioLegal: string;
  cuit: string;
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
  cuenta_honorarios?: string;
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
  return nonEmpty(v) ? (v as string) : CUENTA_HONORARIOS;
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
