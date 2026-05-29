import { describe, it, expect } from "vitest";
import {
  scoreEscrito,
  rankEscritos,
  WEIGHTS,
  RECOMENDADO_THRESHOLD,
} from "./escritos-scorer";
import { type EscritoSignalState, type ScorerTemplate } from "./escritos";

function tmpl(overrides: Partial<ScorerTemplate> = {}): ScorerTemplate {
  return {
    sugerido_movimiento: [],
    sugerido_medida_cautelar: [],
    sugerido_evento: [],
    sugerido_diligenciada: null,
    ...overrides,
  };
}

function state(overrides: Partial<EscritoSignalState> = {}): EscritoSignalState {
  return {
    movimiento: null,
    medida_cautelar: null,
    diligenciada: null,
    ultimo_evento: null,
    ...overrides,
  };
}

describe("scoreEscrito — stage", () => {
  it("universal (no movimiento constraint) gets baseline only", () => {
    const r = scoreEscrito(tmpl(), state({ movimiento: "En Cobro" }));
    expect(r.score).toBe(WEIGHTS.baseline);
    expect(r.reasons).toEqual([]);
  });

  it("exact stage match gets stagePrimary + 'etapa' reason", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_movimiento: ["En Cobro"] }),
      state({ movimiento: "En Cobro" }),
    );
    expect(r.score).toBe(WEIGHTS.stagePrimary);
    expect(r.reasons).toContain("etapa");
  });

  it("adjacent stage gets stageAdjacent without 'etapa' reason", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_movimiento: ["Enviar Mandamiento"] }),
      state({ movimiento: "Pedir Sentencia" }),
    );
    expect(r.score).toBe(WEIGHTS.stageAdjacent);
    expect(r.reasons).not.toContain("etapa");
  });

  it("non-adjacent stage gets nothing for the stage axis", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_movimiento: ["Inicio Causa"] }),
      state({ movimiento: "En Cobro" }),
    );
    expect(r.score).toBe(0);
  });

  it("null movimiento does not count as adjacent to 'Inicio Causa'", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_movimiento: ["Inicio Causa"] }),
      state({ movimiento: null }),
    );
    expect(r.score).toBe(0);
  });
});

describe("scoreEscrito — medida cautelar", () => {
  it("match adds cautelarMatch + 'medida' reason", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_medida_cautelar: ["embargo"] }),
      state({ medida_cautelar: "embargo" }),
    );
    expect(r.score).toBe(WEIGHTS.baseline + WEIGHTS.cautelarMatch);
    expect(r.reasons).toContain("medida");
  });

  it("mismatch (wrong value) penalizes with cautelarMismatch", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_medida_cautelar: ["igb"] }),
      state({ medida_cautelar: "embargo" }),
    );
    expect(r.score).toBe(WEIGHTS.baseline + WEIGHTS.cautelarMismatch);
  });

  it("mismatch (unknown/null) also penalizes", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_medida_cautelar: ["embargo"] }),
      state({ medida_cautelar: null }),
    );
    expect(r.score).toBe(WEIGHTS.baseline + WEIGHTS.cautelarMismatch);
  });
});

describe("scoreEscrito — diligenciada precondition", () => {
  it("met adds diligMet + reason", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_diligenciada: true }),
      state({ diligenciada: true }),
    );
    expect(r.score).toBe(WEIGHTS.baseline + WEIGHTS.diligMet);
    expect(r.reasons).toContain("diligenciada");
  });

  it("unmet penalizes heavily with diligUnmet", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_diligenciada: true }),
      state({ diligenciada: false }),
    );
    expect(r.score).toBe(WEIGHTS.baseline + WEIGHTS.diligUnmet);
  });

  it("false precondition met (diligenciada=false) is rewarded", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_diligenciada: false }),
      state({ diligenciada: false }),
    );
    expect(r.score).toBe(WEIGHTS.baseline + WEIGHTS.diligMet);
  });

  it("unknown (null) state does not satisfy a true precondition", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_diligenciada: true }),
      state({ diligenciada: null }),
    );
    expect(r.score).toBe(WEIGHTS.baseline + WEIGHTS.diligUnmet);
  });
});

describe("scoreEscrito — evento", () => {
  it("matching ultimo_evento adds evento + reason", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_evento: ["mandamiento.diligenciado"] }),
      state({ ultimo_evento: "mandamiento.diligenciado" }),
    );
    expect(r.score).toBe(WEIGHTS.baseline + WEIGHTS.evento);
    expect(r.reasons).toContain("evento");
  });

  it("no event present → only the universal baseline remains", () => {
    const r = scoreEscrito(
      tmpl({ sugerido_evento: ["mandamiento.diligenciado"] }),
      state({ ultimo_evento: null }),
    );
    expect(r.score).toBe(WEIGHTS.baseline);
  });
});

describe("scoreEscrito — composite (template #8 IGB diligenciada)", () => {
  const t8 = tmpl({
    sugerido_movimiento: ["Enviar Mandamiento"],
    sugerido_medida_cautelar: ["igb"],
    sugerido_evento: ["oficio.diligenciado"],
    sugerido_diligenciada: true,
  });

  it("all signals aligned → sum of all matched weights", () => {
    const r = scoreEscrito(
      t8,
      state({
        movimiento: "Enviar Mandamiento",
        medida_cautelar: "igb",
        diligenciada: true,
        ultimo_evento: "oficio.diligenciado",
      }),
    );
    expect(r.score).toBe(
      WEIGHTS.stagePrimary +
        WEIGHTS.cautelarMatch +
        WEIGHTS.diligMet +
        WEIGHTS.evento,
    );
    expect(r.reasons).toEqual(["etapa", "medida", "diligenciada", "evento"]);
  });

  it("right stage but undiligenciada is dragged below threshold", () => {
    const r = scoreEscrito(
      t8,
      state({
        movimiento: "Enviar Mandamiento",
        medida_cautelar: "igb",
        diligenciada: false,
      }),
    );
    // 100 + 40 - 90 = 50 < 60
    expect(r.score).toBeLessThan(RECOMENDADO_THRESHOLD);
  });
});

describe("rankEscritos", () => {
  it("sorts by score desc and flags recomendado at the threshold", () => {
    const templates: ScorerTemplate[] = [
      tmpl({ sugerido_movimiento: ["Inicio Causa"] }), // non-matching → 0
      tmpl({ sugerido_movimiento: ["En Cobro"] }), // exact → 100
      tmpl(), // universal → baseline 10
    ];
    const ranked = rankEscritos(templates, state({ movimiento: "En Cobro" }));

    expect(ranked.map((r) => r.score)).toEqual([100, 10, 0]);
    expect(ranked[0].recomendado).toBe(true);
    expect(ranked[1].recomendado).toBe(false);
  });
});
