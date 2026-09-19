

import { type Empresa } from "./escritos";
import { formatCuil, isValidCuil } from "./cuil";

/**
 * The IVA conditions a lawyer can be under, in the order the forms show them.
 * Lived as three separate copies (the profile page, the profile action and the
 * encargado editor); the action's copy is what a submitted value is validated
 * against, so a drift between them silently rewrote the user's choice to
 * "Responsable Inscripto".
 */
export const IVA_OPTIONS = [
  "Responsable Inscripto",
  "Monotributista",
  "Exento",
  "Consumidor Final",
] as const;

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
  texto?: string;
};

/**
 * Placeholders for the form's inputs ONLY — never a fallback for a document.
 *
 * There used to be a `CUENTA_HONORARIOS` built from these, which is what an
 * unconfigured estudio printed into a filing: "CBU: 0000000000000000000000,
 * DNI: 00000000, Alias de CBU: ALIAS.CBU, de titularidad de NOMBRE Y APELLIDO",
 * with nothing warning about it. That is the same defect buildEncabezado already
 * removed for "CUIT Nº 00-00000000-0" — a visible marker is ugly, a plausible
 * false account number in a court filing is not recoverable. It is gone; an
 * unconfigured account resolves to "" so [CUENTA_HONORARIOS] shows.
 */
export const CUENTA_HONORARIOS_DEFAULT: CuentaHonorariosConfig = {
  tipo: "Caja de ahorro",
  banco: "__________",
  numero: "0000000-0 000-0",
  cbu: "0000000000000000000000",
  alias: "ALIAS.CBU",
};

/**
 * The one line the templates expect. Both call sites need a noun phrase — "a la
 * {{CUENTA_HONORARIOS}}" and "en la siguiente cuenta: {{CUENTA_HONORARIOS}}" —
 * so an empty part drops its whole clause instead of leaving "CBU: ,".
 *
 * The holder is the APODERADO, not a second pair of fields (Fran, 2026-09-17:
 * *"we should change dni inside honorarios for cuit, it should be the
 * encargado's cuit"*). A CUIT and a name typed twice are a CUIT and a name that
 * can disagree, and this one is printed into a filing — so both are read from
 * `escritos_config.encargado` at resolve time and the form no longer asks.
 *
 * Their two markers are deliberate and are the one exception to "an empty part
 * drops its clause": a configured account whose holder is unknown must say so
 * out loud, and Part 4 lists it before the lawyer generates anything. An account
 * with no parts of its own at all still returns "" — that is the whole
 * [CUENTA_HONORARIOS] marker, which is louder still.
 */
export function formatCuentaHonorarios(
  cuenta: Partial<CuentaHonorariosConfig> | null | undefined,
  apoderado?: Partial<AbogadoConfig> | null,
): string {
  const v = (s: string | null | undefined) => (s ?? "").trim();
  if (!cuenta) return "";

  const banco = v(cuenta.banco);
  // "del Banco " + "Banco Galicia" printed "del Banco Banco Galicia" in a real
  // convenio. The stored value is whatever the estudio calls its bank, so the
  // prefix is what gives way — accents and case included, because "BANCO
  // NACIÓN" is the same word.
  const conBanco =
    banco === ""
      ? ""
      : /^banco\b/.test(normalizeKey(banco))
        ? `del ${banco}`
        : `del Banco ${banco}`;

  const cabecera = [v(cuenta.tipo), conBanco].filter(Boolean).join(" ");
  const propias = [
    cabecera,
    v(cuenta.numero) && `Cuenta Nro: ${v(cuenta.numero)}`,
    v(cuenta.cbu) && `CBU: ${v(cuenta.cbu)}`,
    v(cuenta.alias) && `Alias de CBU: ${v(cuenta.alias)}`,
  ].filter(Boolean);
  if (propias.length === 0) return "";

  const cuit = formatCuil(v(apoderado?.cuit));
  const titular = v(apoderado?.nombre);

  return [
    cabecera,
    v(cuenta.numero) && `Cuenta Nro: ${v(cuenta.numero)}`,
    v(cuenta.cbu) && `CBU: ${v(cuenta.cbu)}`,
    `CUIT: ${isValidCuil(cuit) ? cuit : "[ABOGADO_CUIT]"}`,
    v(cuenta.alias) && `Alias de CBU: ${v(cuenta.alias)}`,
    `de titularidad de ${titular !== "" ? titular : "[ABOGADO_NOMBRE]"}`,
  ]
    .filter(Boolean)
    .join(", ");
}

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
  /**
   * juzgados.id -> the judge's name as it must be printed.
   *
   * Section XII of the demanda (recusación sin expresión de causa) renders only
   * for a case whose juzgado_id is a key here, and prints this value. It is
   * deliberately NOT read from `juzgados.juez`: that column is populated for
   * essentially all 292 courts, so falling back to it would recuse a judge on
   * every demanda, which is the bug this map exists to fix (Fran, 2026-08-31).
   *
   * Keyed by the court's real id rather than by name so a rename cannot silently
   * change who gets recused. Civil y Comercial only — a Juzgado de Paz is never
   * recused.
   */
  jueces_recusados?: Record<string, string>;
  /**
   * The estudio's own autorizados for section IX, in printed order — an ARRAY,
   * because the order is what the document prints and an object would not keep
   * it.
   *
   * ABSENT and EMPTY mean different things. Absent is "no override": the list
   * is derived from the estudio's members exactly as it was before this key
   * existed, so every estudio keeps working with no migration and no data
   * entry. An empty array is a head who emptied the list on purpose, and prints
   * the [AUTORIZADOS] marker rather than quietly bringing the members back.
   */
  autorizados?: AutorizadoConfig[];
};

/**
 * Every key of EstudioEscritosConfig, exhaustively.
 *
 * Typed as a Record so the compiler enforces BOTH directions: a key added to
 * the type but not listed here fails the build, and a key listed here that the
 * type does not have fails too. That is the whole point — the settings action
 * used to rebuild the entire column from a hand-written spread, so a key the
 * form did not render was deleted on every save, and nothing but a comment
 * stood between the sixth key and a repeat of that bug.
 */
const CLAVES_DE_CONFIG: Record<keyof Required<EstudioEscritosConfig>, true> = {
  cuenta_honorarios: true,
  encargado: true,
  domicilios_procesales: true,
  empresas: true,
  jueces_recusados: true,
  autorizados: true,
};

export const ESCRITOS_CONFIG_KEYS = Object.keys(
  CLAVES_DE_CONFIG,
) as (keyof EstudioEscritosConfig)[];

/**
 * Apply one form's worth of changes to the stored escritos_config.
 *
 * A key ABSENT from the patch is left exactly as it was, which is what makes a
 * form that does not render a given editor harmless. A key PRESENT with
 * `undefined` is removed — that is how the autorizados override goes back to
 * the derived member list. Anything already in the column that this version of
 * the app does not know about is carried through untouched.
 */
export function mergeEscritosConfig(
  previa: EstudioEscritosConfig | null | undefined,
  patch: Partial<EstudioEscritosConfig>,
): EstudioEscritosConfig {
  const out: Record<string, unknown> = { ...(previa ?? {}) };
  for (const key of ESCRITOS_CONFIG_KEYS) {
    if (!Object.hasOwn(patch, key)) continue;
    const value = patch[key];
    if (value === undefined) delete out[key];
    else out[key] = value;
  }
  return out as EstudioEscritosConfig;
}

/**
 * One thing wrong with a submitted config, tied to BOTH the form field that
 * caused it and the config key it blocks.
 *
 * `campo` is an anchor, not a label: the editors match on it to show the message
 * next to the offending input. Free-form by design — the action names it and the
 * editor that renders that input matches it, and nothing else reads it.
 */
export type ErrorDeConfig = {
  /** The key this problem keeps out of the patch. */
  clave: keyof EstudioEscritosConfig;
  /** Where the form puts the message: "encargado.cuit", "empresa.2.cuit", "cuenta.cbu"… */
  campo: string;
  mensaje: string;
  /**
   * Present only for an EMPRESA ROW problem, carrying that row's clave. The row
   * keeps whatever was stored for it (or is dropped, when nothing was) and the
   * rest of the empresas still save. An empresa error WITHOUT this blocks the
   * whole `empresas` key — which is what the "empresa in use" guard needs: a
   * rename spans rows, so keeping the old row and adding the new one would
   * silently leave the estudio with two empresas where it wanted one.
   */
  fila?: { empresa: string };
};

export type ConfigParcial = {
  /** What mergeEscritosConfig should be called with. */
  patch: Partial<EstudioEscritosConfig>;
  /** Keys the form posted and that were written, for the "se guardó" message. */
  guardadas: (keyof EstudioEscritosConfig)[];
  /** Keys the form posted and that kept their stored value. */
  rechazadas: (keyof EstudioEscritosConfig)[];
};

/**
 * Decide what a rejected value costs: itself, and nothing else.
 *
 * Until 2026-09-17 `updateEstudioEscritosConfig` wrote NOTHING when any value
 * failed, so one empresa CUIT with a bad check digit meant the head could not
 * save a recused judge, an autorizado or a phone number — and package A found
 * that this is exactly what happened (gotcha #51). Fran's rule after reading
 * that report: *"todo lo que es config no debería importar si el sistema está
 * bien hecho"*. A bad value may be rejected and flagged; it may not take
 * unrelated keys down with it.
 *
 * So: a key with an error stays out of the patch and keeps its stored value,
 * and every other posted key is written. `empresas` goes one level finer,
 * because a catalogue of several companies is not one value — see `fila` above.
 *
 * Pure on purpose: the action parses FormData, this decides, and the decision is
 * covered by Vitest rather than only by clicking through a long form.
 */
export function aplicarConfigParcial(
  previa: EstudioEscritosConfig | null | undefined,
  candidatos: Partial<EstudioEscritosConfig>,
  errores: ErrorDeConfig[],
): ConfigParcial {
  const patch: Partial<EstudioEscritosConfig> = {};
  const guardadas: (keyof EstudioEscritosConfig)[] = [];
  const rechazadas: (keyof EstudioEscritosConfig)[] = [];

  for (const clave of ESCRITOS_CONFIG_KEYS) {
    if (!Object.hasOwn(candidatos, clave)) continue;
    const propios = errores.filter((e) => e.clave === clave);

    if (propios.length === 0) {
      patch[clave] = candidatos[clave] as never;
      guardadas.push(clave);
      continue;
    }

    if (clave !== "empresas" || propios.some((e) => !e.fila)) {
      rechazadas.push(clave);
      continue;
    }

    // Row by row: the offending empresa keeps its stored version — or is left
    // out entirely when it was never stored, which is the only honest answer
    // for a brand-new row whose CUIT does not check out.
    const propuestas = { ...((candidatos.empresas ?? {}) as Record<string, EmpresaConfig>) };
    const guardada = previa?.empresas ?? {};
    for (const e of propios) {
      const key = e.fila!.empresa;
      if (key !== "" && Object.hasOwn(guardada, key)) propuestas[key] = guardada[key];
      else delete propuestas[key];
    }
    patch.empresas = propuestas;
    guardadas.push(clave);
  }

  return { patch, guardadas, rechazadas };
}

/** One thing the escritos will print as a [MARCADOR] until somebody fills it. */
export type FaltanteConfig = {
  /** In the firm's words, not the token's. */
  label: string;
  /** Which block of /estudio to look in. */
  seccion: "Encargado" | "Empresas" | "Cuenta de honorarios" | "Autorizados";
};

/**
 * Los campos del Encargado que un escrito imprime, con el nombre que tienen en
 * el formulario. `ivaCondicion` no está porque tiene un default legítimo
 * ("Responsable Inscripto") y nunca sale como marcador.
 */
const CAMPOS_ENCARGADO: [keyof AbogadoConfig, string][] = [
  ["nombre", "Nombre y apellido"],
  ["matricula", "Matrícula"],
  ["legajo", "Legajo previsional"],
  ["cuit", "CUIT"],
  ["ibm", "IBM"],
  ["domicilioElectronico", "Domicilio electrónico"],
  ["telefono", "Teléfono de contacto"],
  ["email", "Correo del estudio"],
];

const CAMPOS_EMPRESA: [keyof EmpresaConfig, string][] = [
  ["razonSocial", "razón social"],
  ["domicilioLegal", "domicilio legal"],
  ["cuit", "CUIT"],
  ["cuentaBancaria", "cuenta bancaria"],
];

/**
 * Lo que la configuración del estudio todavía no tiene, antes de que un escrito
 * lo imprima entre corchetes.
 *
 * Pura a propósito: los departamentos sin domicilio procesal necesitan una
 * consulta y los agrega quien llama. Aquí solo vive lo que se puede decidir
 * mirando el JSONB, que es lo que hace que esto se pueda testear.
 *
 * El paquete A se salteó este aviso porque la config del estudio real estaba
 * cargada. Bajo la regla de Fran (2026-09-17) eso es el motivo equivocado: un
 * sistema bien hecho avisa qué le va a faltar al documento, tenga los datos que
 * tenga hoy.
 */
export function faltantesDeConfig(
  config: EstudioEscritosConfig | null | undefined,
): FaltanteConfig[] {
  const out: FaltanteConfig[] = [];
  const v = (x: string | null | undefined) => String(x ?? "").trim();

  const enc = config?.encargado ?? {};
  for (const [campo, label] of CAMPOS_ENCARGADO) {
    if (v(enc[campo]) === "") out.push({ label, seccion: "Encargado" });
  }

  for (const [clave, empresa] of Object.entries(config?.empresas ?? {})) {
    for (const [campo, label] of CAMPOS_EMPRESA) {
      if (v(empresa?.[campo]) === "") {
        out.push({ label: `${clave}: ${label}`, seccion: "Empresas" });
      }
    }
  }

  // La misma función que arma el token: si resuelve a "", el escrito imprime
  // [CUENTA_HONORARIOS]. No se repite la regla, se pregunta.
  if (resolveCuentaHonorarios(config) === "") {
    out.push({ label: "Sin cargar", seccion: "Cuenta de honorarios" });
  }

  // Una lista propia VACÍA es distinta de no tener lista: la segunda deriva de
  // los miembros, la primera imprime [AUTORIZADOS].
  if (Array.isArray(config?.autorizados) && config.autorizados.length === 0) {
    out.push({ label: "La lista quedó vacía", seccion: "Autorizados" });
  }

  return out;
}

/**
 * The recused judge for a court, or "" when that court is not on the list.
 * An empty result means section XII is omitted entirely — not that a name is
 * missing, so it is never a [TOKEN] and never a warning.
 */
export function resolveJuezRecusado(
  config: EstudioEscritosConfig | null | undefined,
  juzgadoId: string | null | undefined,
): string {
  if (!juzgadoId) return "";
  return String(config?.jueces_recusados?.[juzgadoId] ?? "").trim();
}

/**
 * A free-text config line, ready to be interpolated mid-sentence.
 *
 * `cuentaBancaria`, `domicilioLegal` and each `domicilios_procesales` value are
 * dropped into templates that supply their own punctuation, so a value stored
 * with a trailing comma printed "…CBU 2990…0006,, de titularidad de" in a real
 * convenio. The template cannot know, and there are thirty of them; the value is
 * cleaned where it is resolved instead.
 *
 * Commas and semicolons only — a trailing PERIOD is left alone on purpose. It is
 * how a Spanish address ends an abbreviation ("… Prov. de Bs. As."), and
 * stripping it would silently corrupt the text to fix punctuation that reads
 * fine either way. The doubling that actually happens is the comma.
 */
export function sinPuntuacionFinal(valor: string | null | undefined): string {
  return String(valor ?? "").trim().replace(/[\s,;]+$/u, "");
}

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
  if (typeof v === "string") return nonEmpty(v) ? sinPuntuacionFinal(v) : "";
  const compuesta = formatCuentaHonorarios(v, config?.encargado);
  if (compuesta !== "") return compuesta;
  if (nonEmpty(v?.texto)) return sinPuntuacionFinal(v!.texto as string);
  // "" and not a placeholder account: an unconfigured estudio prints the
  // [CUENTA_HONORARIOS] marker, which the Demanda card and /estudio both list.
  return "";
}

/** The stored value as parts, whichever shape it is in, for the settings form. */
export function cuentaHonorariosPartes(
  config: EstudioEscritosConfig | null | undefined,
): CuentaHonorariosConfig {
  const vacia: CuentaHonorariosConfig = {
    tipo: "", banco: "", numero: "", cbu: "", alias: "",
  };
  const v = config?.cuenta_honorarios;
  if (typeof v === "string") return { ...vacia, texto: v };
  return { ...vacia, ...(v ?? {}) };
}

export type Genero = "F" | "M";

/**
 * The treatment that precedes a name in section IX. Two axes, because the source
 * demanda uses both: "la Dra. María Laura Fernández" is a female lawyer,
 * "Sr. Julián Ortega" is a man who is not one.
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
 * "…con las presentes actuaciones la Dra. María Laura Fernández…", and
 * without it the sentence is ungrammatical.
 *
 * The source demanda is inconsistent about this — it writes "la Dra. …" but then
 * a bare "Sr. Julián Ortega". Applied uniformly here (gotcha #35: read the
 * firm's models for sense, do not carry their defects forward).
 */
export function articuloDe(genero: string | null | undefined): string {
  if (genero === "F") return "la";
  if (genero === "M") return "el";
  return "";
}

/** "la Dra. María Laura Fernández", or a bare name when genero is unknown. */
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

/**
 * One line of the estudio's own autorizados list.
 *
 * Deliberately NOT MiembroAutorizado: that type describes a row of
 * get_estudio_members(), and the entire reason this list exists is that an
 * autorizado usually has no Moya account at all — a procurador, an empleado de
 * mesa de entradas, a paralegal. Those are the people who actually do the
 * trámites section IX authorises, and none of them can be invited to the
 * estudio just to be named in a demanda.
 */
export type AutorizadoConfig = {
  nombre: string;
  genero: Genero | null;
  es_abogado: boolean;
};

/**
 * The autorizados line for section IX: the estudio's own list when it has one,
 * otherwise derived from its members exactly as before this key existed.
 *
 * Both halves go through nombreConTratamiento, so the treatment printed in a
 * filing can never drift from the one the members list shows.
 */
export function resolveAutorizados(
  config: EstudioEscritosConfig | null | undefined,
  miembros: MiembroAutorizado[],
): string {
  const propios = config?.autorizados;
  return formatAutorizados(Array.isArray(propios) ? propios : miembros);
}

/**
 * What the editor posts when the estudio wants no list of its own.
 *
 * A sentinel rather than an empty string, because "" is also what an emptied
 * field posts and the two must not collapse into one meaning: one is "go back
 * to the members", the other would be "the head deliberately removed everyone".
 */
export const AUTORIZADOS_DERIVADO = "derivado";

/**
 * A row with nothing in it: no name, no gender, not marked as abogado.
 *
 * The parser DROPS these instead of rejecting the save — "Agregar autorizado"
 * appends a blank row, and leaving it blank is a change of mind, not a mistake.
 * Exported so the editor warns with the same rule the parser applies: it used
 * to say "sin nombre no se puede guardar" on exactly the rows that DO save
 * (silently, minus the row). "Restaurar por defecto" produces one of these for
 * every member whose profile has no nombre, so the mismatch was not
 * hypothetical.
 */
export function autorizadoVacio(row: {
  nombre?: string | null;
  genero?: string | null;
  es_abogado?: boolean | null;
}): boolean {
  const genero = row.genero === "F" || row.genero === "M" ? row.genero : null;
  return (row.nombre ?? "").trim() === "" && genero === null && row.es_abogado !== true;
}

export type AutorizadosParse = {
  /** `undefined` means: drop the key and go back to the derived member list. */
  autorizados: AutorizadoConfig[] | undefined;
  errors: string[];
};

/**
 * Parse the autorizados editor's hidden field.
 *
 * Parsing and validation are separate passes on purpose (gotcha #40): a
 * rejection thrown inside the JSON catch would be swallowed, and the list would
 * vanish from the config instead of reporting why.
 */
export function parseAutorizados(raw: string): AutorizadosParse {
  const texto = String(raw ?? "").trim();
  if (texto === "" || texto === AUTORIZADOS_DERIVADO) {
    return { autorizados: undefined, errors: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(texto);
  } catch {
    parsed = null;
  }
  if (!Array.isArray(parsed)) {
    // NOT silently "no override": that would delete a list the head still has
    // on screen. An error means the caller writes nothing at all.
    return {
      autorizados: undefined,
      errors: [
        "No se pudo leer la lista de autorizados. Recargá la página y volvé a cargarla.",
      ],
    };
  }

  const errors: string[] = [];
  const autorizados: AutorizadoConfig[] = [];
  const vistos = new Set<string>();

  for (const row of parsed) {
    const o = (row ?? {}) as Record<string, unknown>;
    const nombre = String(o.nombre ?? "").trim();
    const generoRaw = String(o.genero ?? "");
    const genero: Genero | null =
      generoRaw === "F" || generoRaw === "M" ? generoRaw : null;
    const es_abogado = o.es_abogado === true;

    // "Agregar autorizado" appends a blank row, so a row with nothing at all in
    // it is a change of mind rather than a mistake worth stopping the save for.
    // Same rule the editor uses to word its warning.
    if (autorizadoVacio({ nombre, genero, es_abogado })) continue;

    if (nombre === "") {
      errors.push(
        "Falta el nombre de un autorizado. Sin nombre no se puede imprimir en el escrito.",
      );
      continue;
    }

    const clave = normalizeKey(nombre);
    if (vistos.has(clave)) {
      errors.push(`"${nombre}" está dos veces en los autorizados. Dejá uno solo.`);
      continue;
    }
    vistos.add(clave);

    autorizados.push({ nombre, genero, es_abogado });
  }

  return { autorizados, errors };
}

export function resolveEmpresa(
  config: EstudioEscritosConfig | null | undefined,
  key: Empresa | null,
): EmpresaConfig | null {
  if (!key) return null;
  const override = config?.empresas?.[key];
  if (!override) return null;
  // Every one of these is interpolated mid-sentence by some template, so the
  // template's own punctuation is what follows them.
  return {
    razonSocial: sinPuntuacionFinal(override.razonSocial),
    domicilioLegal: sinPuntuacionFinal(override.domicilioLegal),
    cuit: override.cuit ?? "",
    cuentaBancaria: sinPuntuacionFinal(override.cuentaBancaria),
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
  if (nonEmpty(direct)) return sinPuntuacionFinal(direct);
  for (const [key, value] of Object.entries(map)) {
    if (normalizeKey(key) === target && nonEmpty(value)) return sinPuntuacionFinal(value);
  }
  return "";
}


/**
 * The apoderado's SCBA notification address, or a message saying what is wrong.
 *
 * Nothing validated this until 2026-09-17, and it is printed in the encabezado of
 * every escrito the firm files — which is how a value carrying "scva" for "scba"
 * reached a real estudio and stayed there.
 *
 * The rule is Fran's (2026-09-17): the domain has to be the SCBA's, and nothing
 * else is checked. Deliberately NOT stricter — the local part is the eleven
 * digits of a CUIT today, but that is a convention of the portal and not
 * something this app should refuse a filing over, and both `notificacion` and
 * `notificaciones` subdomains are accepted because the constituted address is
 * whatever the portal issued.
 *
 * Empty returns null: an unfilled address is a [ABOGADO_DOMICILIO_ELECTRONICO]
 * marker, not an error.
 */
export function validarDomicilioElectronico(
  valor: string | null | undefined,
): string | null {
  const v = String(valor ?? "").trim();
  if (v === "") return null;

  const at = v.lastIndexOf("@");
  const dominio = at === -1 ? "" : v.slice(at + 1).toLowerCase();
  if (dominio === "scba.gov.ar" || dominio.endsWith(".scba.gov.ar")) return null;

  // The typo that actually happened, named outright — "revisá el dominio" sent
  // a reader looking at the number instead.
  if (dominio.includes("scva")) {
    return "El domicilio electrónico dice scva y el dominio de la SCBA es scba.";
  }
  return "El domicilio electrónico tiene que terminar en scba.gov.ar.";
}

export type EncabezadoInput = {
  /**
   * The estudio's Encargado AS CONFIGURED — not run through a defaults filler.
   * A missing field has to reach the page as a [ABOGADO_*] marker: the whole
   * point is that extractUnresolved sees it, escrito-editor badges it, and the
   * badge links to /estudio. Substituting ABOGADO_DEFAULT here printed
   * "CUIT Nº 00-00000000-0" in a filing with no warning anywhere (Fran,
   * 2026-08-31), while the empresa half of this very sentence has always used
   * markers.
   */
  abogado: Partial<AbogadoConfig>;
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

  // Same treatment the empresa fields above already get. Every one of these has
  // a matching TOKEN_DESTINO entry, so an unconfigured estudio produces badges
  // that link to /estudio instead of a plausible-looking wrong CUIT.
  const ab = (key: keyof AbogadoConfig, token: string) =>
    String(abogado[key] ?? "").trim() || `[${token}]`;

  const nombre = ab("nombre", "ABOGADO_NOMBRE");
  const matricula = ab("matricula", "ABOGADO_MATRICULA");
  const legajo = ab("legajo", "ABOGADO_LEGAJO");
  const cuit = ab("cuit", "ABOGADO_CUIT");
  const ibm = ab("ibm", "ABOGADO_IBM");
  const domicilioElectronico = ab(
    "domicilioElectronico",
    "ABOGADO_DOMICILIO_ELECTRONICO",
  );
  const telefono = ab("telefono", "ABOGADO_TELEFONO");
  // NOT a marker: "Responsable Inscripto" is a real value and the ordinary case,
  // not a 0000 placeholder standing in for something nobody entered.
  const iva = String(abogado.ivaCondicion ?? "").trim() || ABOGADO_DEFAULT.ivaCondicion;

  const comparecencia = sinAutos
    ? // A demanda is the document filed to OBTAIN a case number, so there are no
      // autos to caption and no expediente to cite — DEMANDA.docx ends the
      // header exactly here. Including the caption would print an [EXPEDIENTE]
      // marker on every demanda the firm ever generates.
      `, ante V.S. me presento y respetuosamente digo:`
    : `; en autos caratulados "${razonSocial} C/ ${demandadoUpper} S/ COBRO EJECUTIVO" ` +
      `(Expt. N° ${expt}) ante V.S. respetuosamente digo:`;

  return (
    `${nombre}, abogado inscripto al ${matricula}, ` +
    `Legajo Previsional nº ${legajo}, CUIT Nº ${cuit}, ` +
    `IBM Nº ${ibm}, IVA ${iva}, en mi carácter de ` +
    `apoderado de ${razonSocial} con domicilio legal en ${domicilioLegal}, ` +
    `constituyendo domicilio procesal en la ${procesal} y domicilio electrónico ` +
    `en ${domicilioElectronico}, Teléfono de contacto: ${telefono}` +
    comparecencia
  );
}
