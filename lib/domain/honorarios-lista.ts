/**
 * The axes `/honorarios` filters and searches on.
 *
 * Pure, so the rule that decides whether a honorario still has something to
 * collect lives in ONE place and can be tested against `saldoHonorario()` — the
 * function every other surface resolves a view row through. The list needs the
 * same question answered twice, in two languages: once in TypeScript to paint
 * the badge, and once as a PostgREST filter so the SERVER can narrow and page
 * 313 rows without shipping them all. Those two answers drifting apart is
 * exactly the bug gotcha #49 was: a screen saying "pendiente" next to a $0.
 *
 * Only the view columns that are exact per row are used:
 *
 *   * a NEGOTIATED ceiling (`max_acordado_ars` not null) is compared in pesos —
 *     `pendiente_cobrable_ars` is `max_acordado_ars - pagado_ars`, both
 *     historical amounts, nothing converted;
 *   * the ARANCEL's ceiling is compared in JUS — `pendiente_gross_jus` is
 *     `base x 1.31 - pagado_jus`, both sides JUS.
 *
 * The column that mixes the two (`pendiente_cobrable_ars` on a row with NO
 * negotiated ceiling, where the cap is converted at today's JUS) is never read.
 * That is the same split `techoHonorario()` makes, and the same one
 * `check_honorario_pago_cap()` enforces in the database.
 */

/** The columns of `honorarios_with_balance` this module reads. All nullable (gotcha #3). */
export type FilaHonorario = {
  monto_total_jus: number | null;
  pendiente_jus: number | null;
  max_acordado_ars: number | null;
  pendiente_gross_jus: number | null;
  pendiente_cobrable_ars: number | null;
};

export const HONORARIO_ESTADOS = ["pendiente", "cubierto", "pagado"] as const;
export type HonorarioEstado = (typeof HONORARIO_ESTADOS)[number];

export const ESTADO_LABELS: Record<HonorarioEstado, string> = {
  pendiente: "Pendiente",
  cubierto: "Honorario cubierto",
  pagado: "Pagado",
};

/** "" is "Todos" and stays out of the URL, same convention as /ejecutados' ?via=. */
export const ESTADO_FILTROS: { value: "" | HonorarioEstado; label: string }[] = [
  { value: "", label: "Todos" },
  ...HONORARIO_ESTADOS.map((e) => ({ value: e, label: ESTADO_LABELS[e] })),
];

export const BORRADORES_OPCIONES = ["todos", "ocultar", "solo"] as const;
export type BorradoresFiltro = (typeof BORRADORES_OPCIONES)[number];

/**
 * Drafts are IN the list by default (Fran, 2026-09-21: "/honorarios debería
 * mostrarlos"). They carry a badge of their own instead of being hidden — a
 * case nobody finished loading is still a case, and hiding it by default is how
 * it stays unfinished.
 */
export const BORRADORES_DEFAULT: BorradoresFiltro = "todos";

export const BORRADORES_FILTROS: { value: BorradoresFiltro; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "ocultar", label: "Sin borradores" },
  { value: "solo", label: "Sólo borradores" },
];

export function isEstado(v: string | null | undefined): v is HonorarioEstado {
  return (HONORARIO_ESTADOS as readonly string[]).includes(v ?? "");
}

/** Anything unrecognised reads as "Todos" — a hand-typed ?estado= must not 500. */
export function estadoFiltroDe(v: string | null | undefined): "" | HonorarioEstado {
  return isEstado(v) ? v : "";
}

export function borradoresFiltroDe(v: string | null | undefined): BorradoresFiltro {
  return (BORRADORES_OPCIONES as readonly string[]).includes(v ?? "")
    ? (v as BorradoresFiltro)
    : BORRADORES_DEFAULT;
}

/**
 * Is there still something collectable? The same question
 * `saldoHonorario(fila, jus).pendienteArs > 0` answers, without needing the JUS
 * of the day: whether a fee is still owed cannot depend on today's JUS value,
 * and reading it here would make the answer move when the JUS moves.
 */
export function quedaPorCobrar(fila: FilaHonorario): boolean {
  return fila.max_acordado_ars != null
    ? (fila.pendiente_cobrable_ars ?? 0) > 0
    : (fila.pendiente_gross_jus ?? 0) > 0;
}

/**
 * The three states the list shows, in the order the badge checks them:
 * everything collected -> "Pagado"; the fee proper covered but its IVA and
 * aportes not yet -> "Honorario cubierto"; anything else -> "Pendiente".
 */
export function estadoDe(fila: FilaHonorario): HonorarioEstado {
  if (!quedaPorCobrar(fila)) return "pagado";
  return (fila.pendiente_jus ?? 0) > 0 ? "pendiente" : "cubierto";
}

/**
 * The same branch, written as PostgREST's `or=` argument, so the server can
 * apply it. Kept in this file and next to `quedaPorCobrar()` on purpose: the
 * test asserts the two agree, and they only stay agreed if they are read
 * together.
 */
export const OR_COBRABLE =
  "and(max_acordado_ars.not.is.null,pendiente_cobrable_ars.gt.0)," +
  "and(max_acordado_ars.is.null,pendiente_gross_jus.gt.0)";

export const OR_SALDADO =
  "and(max_acordado_ars.not.is.null,pendiente_cobrable_ars.lte.0)," +
  "and(max_acordado_ars.is.null,pendiente_gross_jus.lte.0)";

/**
 * What a search term is allowed to look like inside a PostgREST filter value.
 *
 * The term travels inside an `or=(...)` list, where a bare comma or parenthesis
 * would be read as syntax — and names here really do carry commas ("VEGA, JORGE
 * ALAN"). PostgREST reads a double-quoted value literally, so the term is quoted
 * and the two characters that could close or corrupt the quote are escaped.
 *
 * `%` and `_` are deliberately NOT escaped. PostgREST unescapes the quoted value
 * before ILIKE ever sees it, so a `\%` written here arrives as a plain `%` and
 * goes back to being a wildcard — measured against the live API on 2026-09-21,
 * where searching "100%" returned exactly what searching "100" returned. Since
 * no nombre, expediente or documento in the estudio contains either character,
 * the practical effect is that a `%` typed into the box behaves as a wildcard
 * and nothing else. Writing a second layer of escaping for characters that can
 * never match anything would be guessing at a parser instead of describing it.
 */
export function escaparTerminoIlike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/["]/g, '\\"');
}

/** The `or=` argument that searches an ejecutado by name, expediente or documento. */
export function orBusquedaEjecutado(term: string): string {
  const t = escaparTerminoIlike(term);
  return [
    `nombre.ilike."%${t}%"`,
    `numero_expediente.ilike."%${t}%"`,
    `documento.ilike."%${t}%"`,
  ].join(",");
}
