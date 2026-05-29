

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
};

export function buildEncabezado({
  abogado,
  empresa,
  domicilioProcesal,
  demandado,
  expediente,
}: EncabezadoInput): string {
  const razonSocial = empresa?.razonSocial || "[EMPRESA]";
  const domicilioLegal = empresa?.domicilioLegal || "[DOMICILIO_LEGAL_EMPRESA]";
  const procesal = domicilioProcesal || "[DOMICILIO_PROCESAL]";
  const demandadoUpper = (demandado || "[DEMANDADO]").toUpperCase();
  const expt = expediente || "[EXPEDIENTE]";

  return (
    `${abogado.nombre}, abogado inscripto al ${abogado.matricula}, ` +
    `Legajo Previsional nº ${abogado.legajo}, CUIT Nº ${abogado.cuit}, ` +
    `IBM Nº ${abogado.ibm}, IVA ${abogado.ivaCondicion}, en mi carácter de ` +
    `apoderado de ${razonSocial} con domicilio legal en ${domicilioLegal}, ` +
    `constituyendo domicilio procesal en la ${procesal} y domicilio electrónico ` +
    `en ${abogado.domicilioElectronico}, Teléfono de contacto: ${abogado.telefono}; ` +
    `en autos caratulados "${razonSocial} C/ ${demandadoUpper} S/ COBRO EJECUTIVO" ` +
    `(Expt. N° ${expt}) ante V.S. respetuosamente digo:`
  );
}
