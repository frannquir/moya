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
  // Every field the encabezado prints about the apoderado. They are all here
  // because buildEncabezado emits a marker for each one rather than filling it
  // with ABOGADO_DEFAULT — an unconfigured estudio used to file "CUIT Nº
  // 00-00000000-0" with no warning at all (Fran, 2026-08-31).
  ABOGADO_NOMBRE: { label: "Nombre del encargado", donde: "estudio" },
  ABOGADO_MATRICULA: { label: "Matrícula del encargado", donde: "estudio" },
  ABOGADO_LEGAJO: { label: "Legajo previsional del encargado", donde: "estudio" },
  ABOGADO_CUIT: { label: "CUIT del encargado", donde: "estudio" },
  // Derived from the CUIT, so it goes missing with it and shares its label —
  // escrito-editor collapses the pair into one badge.
  ABOGADO_DNI: { label: "CUIT del encargado", donde: "estudio" },
  ABOGADO_IBM: { label: "IBM del encargado", donde: "estudio" },
  ABOGADO_DOMICILIO_ELECTRONICO: {
    label: "Domicilio electrónico del encargado",
    donde: "estudio",
  },
  ABOGADO_TELEFONO: { label: "Teléfono del encargado", donde: "estudio" },
  ABOGADO_EMAIL: { label: "Correo del estudio", donde: "estudio" },
  // Belt and braces: the config form refuses to save a recused court without a
  // name, so this should never go unresolved. If it ever does, the badge is the
  // difference between noticing and filing "recusar sin expresión de causa a []".
  JUEZ_RECUSADO: { label: "Jueces recusados", donde: "estudio" },
  HONORARIOS_JUS: { label: "Honorario del caso", donde: "caso" },
  HONORARIOS_TOTAL_LETRAS: { label: "Honorario del caso", donde: "caso" },

  // The estudio's own autorizados list since 2026-09-16. It used to point at
  // /settings/profile, which was only ever half an answer: a member could fix
  // their own name there but nobody could add the procurador who actually does
  // the trámite, and no member could fix another member's blank profile. The
  // list is now editable in one place, and that place is head-only.
  AUTORIZADOS: { label: "Autorizados de los escritos", donde: "estudio" },
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
