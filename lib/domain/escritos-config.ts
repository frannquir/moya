

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

export const EMPRESAS: Record<string, EmpresaConfig> = {
  Tartan: {
    razonSocial: "EMPRESA TARTAN S.A.",
    domicilioLegal: "Domicilio legal de la empresa",
    cuit: "00-00000000-0",
  },
  Contar: {
    razonSocial: "EMPRESA CONTAR S.A.",
    domicilioLegal: "Domicilio legal de la empresa",
    cuit: "00-00000000-0",
  },
  Promaq: {
    razonSocial: "EMPRESA PROMAQ S.A.",
    domicilioLegal: "Domicilio legal de la empresa",
    cuit: "00-00000000-0",
  },
};

export const DOMICILIOS_PROCESALES: Record<string, string> = {
  "Mar del Plata": "calle __________ Nº ____",
  Necochea: "calle __________ Nº ____",
  Dolores: "calle __________ Nº ____",
  Azul: "calle __________ Nº ____",
  Tandil: "calle __________ Nº ____",
  Olavarría: "calle __________ Nº ____",
};

export const DEFAULT_DEPARTAMENTOS = Object.keys(DOMICILIOS_PROCESALES);

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

export function resolveCuentaHonorarios(
  config: EstudioEscritosConfig | null | undefined,
): string {
  const v = config?.cuenta_honorarios;
  return nonEmpty(v) ? (v as string) : CUENTA_HONORARIOS;
}

// Resolve an empresa clave: estudio override first, then the seed default, then
// empty (so the encabezado shows [EMPRESA] for an unconfigured clave).
export function resolveEmpresa(
  config: EstudioEscritosConfig | null | undefined,
  key: Empresa | null,
): EmpresaConfig | null {
  if (!key) return null;
  const base = EMPRESAS[key] as EmpresaConfig | undefined;
  const override = config?.empresas?.[key] as Partial<EmpresaConfig> | undefined;
  return {
    razonSocial: nonEmpty(override?.razonSocial)
      ? override!.razonSocial!
      : (base?.razonSocial ?? ""),
    domicilioLegal: nonEmpty(override?.domicilioLegal)
      ? override!.domicilioLegal!
      : (base?.domicilioLegal ?? ""),
    cuit: nonEmpty(override?.cuit) ? override!.cuit! : (base?.cuit ?? ""),
  };
}

export function resolveDomicilioProcesal(
  config: EstudioEscritosConfig | null | undefined,
  departamento: string | null | undefined,
): string {
  if (!departamento) return "";
  const key = departamento.trim();
  const override = config?.domicilios_procesales?.[key];
  if (nonEmpty(override)) return override as string;
  return DOMICILIOS_PROCESALES[key] ?? "";
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
