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
    clave: null,
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

// The 1b/1c sets Fran locked with the client. These encode the exact orderings;
// the pinned layer exists to make them hold.
describe("rankEscritos — pinned sets (movimiento × diligenciada)", () => {
  // A stand-in library carrying the real tags of the templates involved.
  const LIBRARY: ScorerTemplate[] = [
    tmpl({ clave: "preparar-via-cautelar", sugerido_movimiento: ["Inicio Causa"] }),
    tmpl({
      clave: "sentencia-trance-remate",
      sugerido_movimiento: ["Pedir Sentencia"],
      sugerido_evento: ["mandamiento.diligenciado"],
      sugerido_diligenciada: true,
    }),
    tmpl({
      clave: "oficio-renaper",
      sugerido_movimiento: ["Enviar Cédula"],
      sugerido_evento: ["cedula.revocada"],
      sugerido_diligenciada: false,
    }),
    tmpl({
      clave: "cedula-habilitacion",
      sugerido_movimiento: ["Enviar Cédula"],
      sugerido_evento: ["cedula.revocada"],
      sugerido_diligenciada: false,
    }),
    tmpl({
      clave: "cedula-bajo-responsabilidad",
      sugerido_movimiento: ["Enviar Cédula"],
      sugerido_evento: ["cedula.revocada"],
      sugerido_diligenciada: false,
    }),
    tmpl({
      clave: "nuevo-mandamiento",
      sugerido_movimiento: ["Enviar Mandamiento"],
      sugerido_diligenciada: false,
    }),
    // Noise: scores 100 against En Cobro, must never displace a pin.
    tmpl({ clave: "solicita-saldo", sugerido_movimiento: ["En Cobro"] }),
  ];

  function pinnedOf(s: EscritoSignalState): (string | null)[] {
    return rankEscritos(LIBRARY, s)
      .filter((t) => t.reasons.includes("fijado"))
      .map((t) => t.clave);
  }

  it("Cédula diligenciada → Preparar vía first, RENAPER second, no cédula variants", () => {
    expect(
      pinnedOf(state({ movimiento: "Enviar Cédula", diligenciada: true })),
    ).toEqual(["preparar-via-cautelar", "oficio-renaper"]);
  });

  it("Cédula NOT diligenciada → both variants (habilitación first), RENAPER third", () => {
    expect(
      pinnedOf(state({ movimiento: "Enviar Cédula", diligenciada: false })),
    ).toEqual(["cedula-habilitacion", "cedula-bajo-responsabilidad", "oficio-renaper"]);
  });

  it("Cédula NOT diligenciada does not offer Preparar vía", () => {
    const ranked = rankEscritos(
      LIBRARY,
      state({ movimiento: "Enviar Cédula", diligenciada: false }),
    );
    const preparar = ranked.find((t) => t.clave === "preparar-via-cautelar")!;
    expect(preparar.reasons).not.toContain("fijado");
    expect(preparar.recomendado).toBe(false);
  });

  it("Mandamiento diligenciada → Sentencia de trance y remate", () => {
    expect(
      pinnedOf(state({ movimiento: "Enviar Mandamiento", diligenciada: true })),
    ).toEqual(["sentencia-trance-remate"]);
  });

  it("Mandamiento NOT diligenciada → Solicita nuevo mandamiento", () => {
    expect(
      pinnedOf(state({ movimiento: "Enviar Mandamiento", diligenciada: false })),
    ).toEqual(["nuevo-mandamiento"]);
  });

  it("pinned templates lead the ranking, ahead of higher-scoring ones", () => {
    const ranked = rankEscritos(
      LIBRARY,
      state({ movimiento: "Enviar Cédula", diligenciada: false }),
    );
    expect(ranked.slice(0, 3).map((t) => t.clave)).toEqual([
      "cedula-habilitacion",
      "cedula-bajo-responsabilidad",
      "oficio-renaper",
    ]);
  });

  it("pinning rescues templates the scorer would hide", () => {
    // This is why the layer exists. Against a diligenciada cédula, Preparar vía
    // only scores stage-adjacent (35) and RENAPER is dragged to 10 by
    // diligUnmet — both below the threshold, yet both are what to file next.
    const ranked = rankEscritos(
      LIBRARY,
      state({ movimiento: "Enviar Cédula", diligenciada: true }),
    );
    const [first, second] = ranked;
    expect(first.clave).toBe("preparar-via-cautelar");
    expect(second.clave).toBe("oficio-renaper");
    expect(first.score).toBe(WEIGHTS.stageAdjacent);
    expect(second.score).toBe(WEIGHTS.stagePrimary + WEIGHTS.diligUnmet);
    expect(first.score).toBeLessThan(RECOMENDADO_THRESHOLD);
    expect(second.score).toBeLessThan(RECOMENDADO_THRESHOLD);
    expect(first.recomendado).toBe(true);
    expect(second.recomendado).toBe(true);
  });

  it("the /escritos feed's top-3 slice is exactly the cédula pinned set", () => {
    // The feed card renders PER_CARD = 3 recomendados; the three pins must fill
    // it rather than being cut by an unrelated high scorer.
    const top3 = rankEscritos(
      LIBRARY,
      state({ movimiento: "Enviar Cédula", diligenciada: false }),
    )
      .filter((t) => t.recomendado)
      .slice(0, 3)
      .map((t) => t.clave);
    expect(top3).toEqual([
      "cedula-habilitacion",
      "cedula-bajo-responsabilidad",
      "oficio-renaper",
    ]);
  });

  it("never lists a pinned template twice", () => {
    const ranked = rankEscritos(
      LIBRARY,
      state({ movimiento: "Enviar Cédula", diligenciada: false }),
    );
    const claves = ranked.map((t) => t.clave);
    expect(new Set(claves).size).toBe(claves.length);
    expect(ranked).toHaveLength(LIBRARY.length);
  });

  it("unknown diligenciada pins nothing and falls back to pure scoring", () => {
    const ranked = rankEscritos(
      LIBRARY,
      state({ movimiento: "Enviar Cédula", diligenciada: null }),
    );
    expect(ranked.every((t) => !t.reasons.includes("fijado"))).toBe(true);
  });

  it("a movimiento with no pinned rule falls back to pure scoring", () => {
    const ranked = rankEscritos(
      LIBRARY,
      state({ movimiento: "En Cobro", diligenciada: true }),
    );
    expect(ranked.every((t) => !t.reasons.includes("fijado"))).toBe(true);
    expect(ranked[0].clave).toBe("solicita-saldo");
  });
});

// 1a end-to-end at the scoring layer: a confirmed liquidación evento must lift
// BOTH liquidación escritos over the threshold, whichever of the pair the
// lawyer confirmed on /mail/[id].
describe("rankEscritos — liquidación evento surfaces both escritos", () => {
  const LIQ_TAGS = ["liquidacion.practicable", "liquidacion.aprobada"];
  const LIBRARY: ScorerTemplate[] = [
    tmpl({
      clave: "solicita-aprobacion-liquidacion",
      sugerido_movimiento: ["Pedir Sentencia", "En Cobro"],
      sugerido_evento: LIQ_TAGS,
    }),
    tmpl({
      clave: "practica-nueva-liquidacion-oficio",
      sugerido_movimiento: ["En Cobro"],
      sugerido_evento: LIQ_TAGS,
    }),
    tmpl({ clave: "otro", sugerido_movimiento: ["Inicio Causa"] }),
  ];

  it.each(["liquidacion.practicable", "liquidacion.aprobada"])(
    "both are recomendado after confirming %s",
    (evento) => {
      const ranked = rankEscritos(
        LIBRARY,
        // Deliberately a stage neither template is tagged for: the evento alone
        // has to carry them over the threshold.
        state({ movimiento: "Enviar Mandamiento", ultimo_evento: evento }),
      );
      const recomendados = ranked.filter((t) => t.recomendado).map((t) => t.clave);
      expect(recomendados).toContain("solicita-aprobacion-liquidacion");
      expect(recomendados).toContain("practica-nueva-liquidacion-oficio");
      expect(recomendados).not.toContain("otro");
    },
  );

  it("neither is recomendado without a confirmed liquidación evento", () => {
    const ranked = rankEscritos(
      LIBRARY,
      state({ movimiento: "Enviar Mandamiento", ultimo_evento: null }),
    );
    expect(ranked.filter((t) => t.recomendado)).toHaveLength(0);
  });
});

// 1a: "Cumple intimación – Caducidad" is tagged caducidad.intimada and carries
// no stage constraint, so the evento alone must surface it.
describe("rankEscritos — intimación evento surfaces the caducidad escrito", () => {
  it("baseline + evento clears the threshold", () => {
    const t = tmpl({
      clave: "cumple-intimacion-caducidad",
      sugerido_evento: ["caducidad.intimada"],
    });
    const ranked = rankEscritos(
      [t],
      state({ movimiento: "En Cobro", ultimo_evento: "caducidad.intimada" }),
    );
    expect(ranked[0].score).toBe(WEIGHTS.baseline + WEIGHTS.evento);
    expect(ranked[0].recomendado).toBe(true);
  });
});

// Week 2B: the library and the recommendation feed hold only 'escrito' rows.
// A cautelar fragmento is a piece of another document, and a demanda opens a
// case — offering either against an ejecutado that already exists is nonsense.
// The queries filter on tipo, and rankEscritos filters again so the guarantee
// belongs to the scorer rather than to every call site that might be added.
describe("rankEscritos — tipo discriminator", () => {
  const EVENTOS = [
    null,
    "sentencia.dictada",
    "mandamiento.diligenciado",
    "traslado.notificado",
    "liquidacion.practicable",
    "liquidacion.aprobada",
    "liquidacion.impugnada",
    "intimacion.caducidad",
  ];

  // Every signal state the UI can produce.
  function allStates(): EscritoSignalState[] {
    const out: EscritoSignalState[] = [];
    for (const movimiento of [
      null,
      "Inicio Causa",
      "Enviar Cédula",
      "Enviar Mandamiento",
      "Pedir Sentencia",
      "En Cobro",
    ] as const) {
      for (const medida of [null, "embargo", "igb"] as const) {
        for (const diligenciada of [null, true, false]) {
          for (const ultimo_evento of EVENTOS) {
            out.push(
              state({ movimiento, medida_cautelar: medida, diligenciada, ultimo_evento }),
            );
          }
        }
      }
    }
    return out;
  }

  it("never returns the demanda, for any signal state", () => {
    const demanda = tmpl({ clave: "demanda.cobro-ejecutivo", tipo: "demanda" });
    const normal = tmpl({ clave: "practica-liquidacion", tipo: "escrito" });
    for (const s of allStates()) {
      const claves = rankEscritos([demanda, normal], s).map((t) => t.clave);
      expect(claves).not.toContain("demanda.cobro-ejecutivo");
    }
  });

  it("never returns a cautelar fragmento, for any signal state", () => {
    const fragmentos = [
      tmpl({ clave: "cautelar.haberes", tipo: "fragmento" }),
      tmpl({ clave: "cautelar.mercadopago", tipo: "fragmento" }),
      tmpl({ clave: "cautelar.mixto", tipo: "fragmento" }),
    ];
    const normal = tmpl({ clave: "practica-liquidacion", tipo: "escrito" });
    for (const s of allStates()) {
      const claves = rankEscritos([...fragmentos, normal], s).map((t) => t.clave);
      for (const f of fragmentos) expect(claves).not.toContain(f.clave);
    }
  });

  it("excludes them even when a pinned rule names their clave", () => {
    // A fragmento cannot be smuggled in through the pinned set either.
    const smuggled = tmpl({ clave: "preparar-via-cautelar", tipo: "fragmento" });
    const ranked = rankEscritos(
      [smuggled],
      state({ movimiento: "Enviar Cédula", diligenciada: true }),
    );
    expect(ranked).toHaveLength(0);
  });

  it("keeps ranking rows whose tipo is absent (they predate the column)", () => {
    const legacy = tmpl({ clave: "practica-liquidacion" });
    expect(rankEscritos([legacy], state()).map((t) => t.clave)).toEqual([
      "practica-liquidacion",
    ]);
  });
});
