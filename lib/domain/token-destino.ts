// Where each unresolved escrito token gets filled in. A raw `[DOMICILIO_PROCESAL]`
// badge reads as a broken feature rather than as missing config, so every token
// carries a label and a destination.

export type TokenDestino = {
  /** What the missing thing is called, in the firm's words. */
  label: string;
  /**
   * `caso` — a field on this ejecutado, editable by any member.
   * `estudio` — estudio config, owner only; a member is told who to ask.
   * `perfil` — the member's own profile.
   */
  donde: "caso" | "estudio" | "perfil";
};

export const TOKEN_DESTINO: Record<string, TokenDestino> = {
  // --- per case ---
  EMPRESA: { label: "Empresa del ejecutado", donde: "caso" },
  DEMANDADO: { label: "Nombre del demandado", donde: "caso" },
  DEMANDADO_MAYUSCULA: { label: "Nombre del demandado", donde: "caso" },
  DOMICILIO: { label: "Domicilio del demandado", donde: "caso" },
  CUIL_DEMANDADO: { label: "CUIL del demandado", donde: "caso" },
  DNI_DEMANDADO: { label: "Documento del demandado", donde: "caso" },
  DOCUMENTO: { label: "Documento del demandado", donde: "caso" },
  EXPEDIENTE: { label: "N° de expediente", donde: "caso" },
  FECHA_MORA: { label: "Fecha de mora", donde: "caso" },
  FECHA_CONTRATO: { label: "Fecha del contrato", donde: "caso" },
  FOJAS_RESUMENES: { label: "Fojas de resúmenes", donde: "caso" },
  CUENTA_CLIPER: { label: "Cuenta Cliper", donde: "caso" },
  TARJETA_CABAL: { label: "Tarjeta Cabal", donde: "caso" },
  CAPITAL: { label: "Liquidación del caso", donde: "caso" },
  TOTAL_LIQUIDACION: { label: "Liquidación del caso", donde: "caso" },
  MONTO: { label: "Monto reclamado", donde: "caso" },
  MONTO_LETRAS: { label: "Monto reclamado", donde: "caso" },
  JUZGADO: { label: "Juzgado del caso", donde: "caso" },
  JUEZ: { label: "Juez del caso", donde: "caso" },
  DEPARTAMENTO: { label: "Departamento judicial", donde: "caso" },

  // --- estudio config, head only ---
  DOMICILIO_LEGAL_EMPRESA: { label: "Domicilio legal de la empresa", donde: "estudio" },
  CUIT_EMPRESA: { label: "CUIT de la empresa", donde: "estudio" },
  DOMICILIO_PROCESAL: { label: "Domicilio procesal del departamento", donde: "estudio" },
  CUENTA_HONORARIOS: { label: "Cuenta de honorarios del estudio", donde: "estudio" },
  CUENTA_ACREEDOR: { label: "Cuenta bancaria de la empresa", donde: "estudio" },
  ABOGADO_NOMBRE: { label: "Encargado del estudio", donde: "estudio" },
  ABOGADO_DNI: { label: "CUIT del encargado", donde: "estudio" },
  ABOGADO_TELEFONO: { label: "Teléfono del encargado", donde: "estudio" },
  ABOGADO_EMAIL: { label: "Correo del estudio", donde: "estudio" },
  HONORARIOS_JUS: { label: "Honorario del caso", donde: "caso" },
  HONORARIOS_TOTAL_LETRAS: { label: "Honorario del caso", donde: "caso" },

  // --- members ---
  AUTORIZADOS: { label: "Miembros del estudio", donde: "perfil" },
};

export function destinoDe(token: string): TokenDestino | null {
  return TOKEN_DESTINO[token] ?? null;
}

/** The href, or null when the reader cannot act on it. */
export function hrefDe(
  destino: TokenDestino,
  { ejecutadoId, isHead }: { ejecutadoId: string | null; isHead: boolean },
): string | null {
  switch (destino.donde) {
    case "caso":
      return ejecutadoId ? `/ejecutados/${ejecutadoId}` : null;
    case "estudio":
      return isHead ? "/estudio" : null;
    case "perfil":
      return "/settings/profile";
  }
}
