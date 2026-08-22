// The scorer: score(escrito, state) = Σ weights of matched conditions.

import { MOVIMIENTO_OPTIONS } from "./ejecutado";
import { type EscritoSignalState, type ScorerTemplate } from "./escritos";
import { pinnedClavesFor } from "./escritos-pinned";

export const WEIGHTS = {
  stagePrimary: 100,
  stageAdjacent: 35,
  baseline: 10,
  cautelarMatch: 40,
  cautelarMismatch: -50,
  diligMet: 60,
  diligUnmet: -90,
  evento: 80,
} as const;

const STAGES: readonly string[] = MOVIMIENTO_OPTIONS;

export const RECOMENDADO_THRESHOLD = 60;

export type ScoreResult = { score: number; reasons: string[] };

function adjacent(stage: string | null, sugeridos: string[]): boolean {
  if (!stage) return false;
  const i = STAGES.indexOf(stage);
  if (i === -1) return false;
  return sugeridos.some((s) => {
    const j = STAGES.indexOf(s);
    return j !== -1 && Math.abs(j - i) === 1;
  });
}

export function scoreEscrito(
  t: ScorerTemplate,
  state: EscritoSignalState,
): ScoreResult {
  let s = 0;
  const reasons: string[] = [];

  // stage
  if (t.sugerido_movimiento.length === 0) {
    s += WEIGHTS.baseline;
  } else if (state.movimiento && t.sugerido_movimiento.includes(state.movimiento)) {
    s += WEIGHTS.stagePrimary;
    reasons.push("etapa");
  } else if (adjacent(state.movimiento, t.sugerido_movimiento)) {
    s += WEIGHTS.stageAdjacent;
  }

  // medida cautelar
  if (t.sugerido_medida_cautelar.length > 0) {
    if (
      state.medida_cautelar &&
      t.sugerido_medida_cautelar.includes(state.medida_cautelar)
    ) {
      s += WEIGHTS.cautelarMatch;
      reasons.push("medida");
    } else {
      s += WEIGHTS.cautelarMismatch;
    }
  }

  // diligenciada precondition
  if (t.sugerido_diligenciada !== null && t.sugerido_diligenciada !== undefined) {
    if (state.diligenciada === t.sugerido_diligenciada) {
      s += WEIGHTS.diligMet;
      reasons.push("diligenciada");
    } else {
      s += WEIGHTS.diligUnmet;
    }
  }

  // evento (mail-era)
  if (
    t.sugerido_evento.length > 0 &&
    state.ultimo_evento &&
    t.sugerido_evento.includes(state.ultimo_evento)
  ) {
    s += WEIGHTS.evento;
    reasons.push("evento");
  }

  return { score: s, reasons };
}

export type RankedEscrito<T extends ScorerTemplate> = T & {
  score: number;
  reasons: string[];
  recomendado: boolean;
};

// Two-layer ranking: the pinned set for the current movimiento + diligenciada
// comes first, in its declared order and always flagged recomendado; everything
// else follows, scored and sorted as before. A pinned template is removed from
// the scored tail so it can't appear twice.
/**
 * Only 'escrito' rows are rankable. The queries that feed this already filter on
 * tipo, so this is belt and braces — but it is the belt that makes "the demanda
 * is never recommended" a property of the scorer rather than of every call site
 * that might be added later. A row with no tipo predates the column and counts
 * as an escrito.
 */
export function isRankable(t: ScorerTemplate): boolean {
  return t.tipo == null || t.tipo === "escrito";
}

export function rankEscritos<T extends ScorerTemplate>(
  all: T[],
  state: EscritoSignalState,
): RankedEscrito<T>[] {
  const templates = all.filter(isRankable);

  const byClave = new Map<string, T>();
  for (const t of templates) {
    if (t.clave) byClave.set(t.clave, t);
  }

  const pinned: RankedEscrito<T>[] = [];
  const pinnedClaves = new Set<string>();
  for (const clave of pinnedClavesFor(state)) {
    const t = byClave.get(clave);
    if (!t || pinnedClaves.has(clave)) continue;
    pinnedClaves.add(clave);
    // Keep the real score/reasons for transparency in the UI, but the pin is
    // what decides both placement and recomendado.
    const { score, reasons } = scoreEscrito(t, state);
    pinned.push({ ...t, score, reasons: [...reasons, "fijado"], recomendado: true });
  }

  const rest = templates
    .filter((t) => !(t.clave && pinnedClaves.has(t.clave)))
    .map((t) => {
      const { score, reasons } = scoreEscrito(t, state);
      return { ...t, score, reasons, recomendado: score >= RECOMENDADO_THRESHOLD };
    })
    .sort((a, b) => b.score - a.score);

  return [...pinned, ...rest];
}
