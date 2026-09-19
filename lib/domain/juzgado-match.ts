/**
 * Resolve the free-text `juzgado` of a migrated ejecutado to one row of
 * `public.juzgados`.
 *
 * EXACT OR NOTHING. A court guessed wrong is a court named wrong in a signed
 * convenio and in a recusación, so this module never picks "the closest one": a
 * text that does not land on exactly one court returns `unmatched` with a reason,
 * and the caller leaves `juzgado_id` NULL.
 *
 * The old app stored two free-text fields per case: the firm's own shorthand for
 * the court ("JCYC Nº2", "Juzgado de Paz") and a `departamento` that is really the
 * SEAT CITY (Tandil, Olavarría, Balcarce…), not one of the 20 judicial
 * departments. That distinction is what makes the match safe: inside the Azul
 * department, Azul has Civil courts 1–4, Olavarría 1–2 and Tandil 1–3, each
 * numbered from one. Matching on the judicial department alone would make "N° 1"
 * mean three different courts. `lib/data/juzgados.ts` keys its picker on
 * `localidad` for the same reason.
 */

import { normalize } from "@/lib/domain/mail-match";

/** The columns of `public.juzgados` the match needs. */
export type CourtRow = {
  id: string;
  organismo: string;
  tipo: string;
  numero: number | null;
  localidad: string;
  departamento_judicial: string;
};

/** The two free-text columns an old case carries. */
export type CaseCourtText = {
  juzgado: string | null;
  departamento: string | null;
};

/** The court kinds a case text can name. Receptorías are not courts of trámite. */
export type TextoTipo = "civil" | "paz" | "receptoria" | null;

export type UnmatchedReason =
  | "sin-texto"
  | "tipo-no-reconocido"
  | "receptoria"
  | "sin-lugar"
  | "sin-candidatos"
  | "ambiguo";

export type MatchResult =
  | {
      status: "matched";
      juzgadoId: string;
      organismo: string;
      /** Which side of the court row the case's `departamento` matched. */
      via: "localidad" | "departamento-judicial";
    }
  | {
      status: "unmatched";
      reason: UnmatchedReason;
      /** Courts that survived every rule but uniqueness — only for "ambiguo". */
      candidatos: CourtRow[];
    };

// The `tipo` values used by public.juzgados (written by scripts/import-juzgados.ts
// from the SCBA scrape). PICKER_TIPOS in lib/data/juzgados.ts is the same pair.
const TIPO_CIVIL = "Juzgado Civil y Comercial";
const TIPO_PAZ = "Juzgado de Paz";

/**
 * Normalise a court or city string. `normalize` already lowercases, strips
 * accents and turns every non-alphanumeric character into a space — which is what
 * flattens "Nº" and "N°" (two different characters the SCBA and the estudio each
 * prefer) to a bare "n". The extra step here is the spelled-out variants.
 */
export function normalizeCourtText(s: string | null | undefined): string {
  return normalize(s)
    .replace(/\b(nro|nros|nr|num|nums|numero|numeros)\b/g, "n")
    .replace(/\s+/g, " ")
    .trim();
}

/** Accent- and space-free key for comparing city / department names. */
function placeKey(s: string | null | undefined): string {
  return normalize(s).replace(/\s+/g, "");
}

/** Which kind of court the case's own text names. */
export function tipoDeTexto(juzgado: string | null | undefined): TextoTipo {
  const t = normalizeCourtText(juzgado);
  if (t === "") return null;
  // Receptorías first: they are a filing desk, never the court a case is before.
  if (/\brecept/.test(t)) return "receptoria";
  if (/\bpaz\b/.test(t)) return "paz";
  if (/\bjcyc\b|\bcyc\b|\bcivil\b/.test(t)) return "civil";
  return null;
}

/**
 * The court number the text carries, or null when it carries none.
 *
 * Only an explicit "n <digits>" or a standalone number counts. Two digits max —
 * the largest court number in the province is 16, and a longer run of digits in a
 * court field is something else (a year, an expediente) that must not be read as
 * a court number.
 */
export function numeroDeTexto(juzgado: string | null | undefined): number | null {
  const t = normalizeCourtText(juzgado);
  const marked = t.match(/\bn (\d{1,2})\b/);
  if (marked) return Number(marked[1]);
  const bare = t.match(/(?:^| )(\d{1,2})(?: |$)/);
  return bare ? Number(bare[1]) : null;
}

/**
 * Propose a `juzgado_id` for one case, or explain why it stays NULL.
 *
 * Rules, in order, and nothing looser:
 *  1. the case text has to name a recognisable court kind;
 *  2. the case's `departamento` has to equal the court's `localidad` — and only
 *     when no court sits in that city, the court's `departamento_judicial`;
 *  3. when the text carries a number, the court's `numero` has to equal it
 *     exactly (which is why a "Juzgado de Paz N° 2" matches nothing: Paz courts
 *     have no number);
 *  4. the `tipo` has to agree — a Juzgado de Paz never matches a Civil y
 *     Comercial;
 *  5. exactly one court has to survive. Two or zero mean NULL.
 */
export function matchJuzgado(caso: CaseCourtText, courts: CourtRow[]): MatchResult {
  const unmatched = (reason: UnmatchedReason, candidatos: CourtRow[] = []): MatchResult => ({
    status: "unmatched",
    reason,
    candidatos,
  });

  if (normalizeCourtText(caso.juzgado) === "") return unmatched("sin-texto");

  const tipo = tipoDeTexto(caso.juzgado);
  if (tipo === "receptoria") return unmatched("receptoria");
  if (tipo === null) return unmatched("tipo-no-reconocido");

  const lugar = placeKey(caso.departamento);
  if (lugar === "") return unmatched("sin-lugar");

  const tipoDestino = tipo === "paz" ? TIPO_PAZ : TIPO_CIVIL;
  const numero = numeroDeTexto(caso.juzgado);

  const delTipo = courts.filter((c) => c.tipo === tipoDestino);
  const conNumero = (rows: CourtRow[]) =>
    numero === null ? rows : rows.filter((c) => c.numero === numero);

  // Tier 1 — the seat city, which is what the estudio means by "departamento".
  const enCiudad = delTipo.filter((c) => placeKey(c.localidad) === lugar);
  if (enCiudad.length > 0) {
    const exactos = conNumero(enCiudad);
    if (exactos.length === 1) {
      const c = exactos[0];
      return { status: "matched", juzgadoId: c.id, organismo: c.organismo, via: "localidad" };
    }
    // A city that has courts of this kind but none with this number is a wrong
    // number, not a reason to widen the search to the whole department.
    return exactos.length === 0
      ? unmatched("sin-candidatos")
      : unmatched("ambiguo", exactos);
  }

  // Tier 2 — no court of that kind sits in the city, so read the text as naming
  // the judicial department. Still exact: one survivor or nothing.
  const enDepartamento = conNumero(
    delTipo.filter((c) => placeKey(c.departamento_judicial) === lugar),
  );
  if (enDepartamento.length === 1) {
    const c = enDepartamento[0];
    return {
      status: "matched",
      juzgadoId: c.id,
      organismo: c.organismo,
      via: "departamento-judicial",
    };
  }
  return enDepartamento.length === 0
    ? unmatched("sin-candidatos")
    : unmatched("ambiguo", enDepartamento);
}

/** One-line Spanish explanation of an unmatched result, for the report. */
export function explicarUnmatched(
  reason: UnmatchedReason,
  candidatos: CourtRow[] = [],
): string {
  switch (reason) {
    case "sin-texto":
      return "el caso no tiene juzgado escrito";
    case "tipo-no-reconocido":
      return "el texto no dice si es Civil y Comercial o de Paz";
    case "receptoria":
      return "es una Receptoría, no un juzgado de trámite";
    case "sin-lugar":
      return "el caso no tiene departamento";
    case "sin-candidatos":
      return "no hay ningún juzgado de ese tipo y número en ese lugar";
    case "ambiguo":
      return `cae en ${candidatos.length} juzgados a la vez`;
  }
}
