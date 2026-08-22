import { describe, it, expect } from "vitest";
import {
  CAUTELAR_CLAVES,
  cautelarScope,
  parteRecord,
  resolveCautelar,
  rolDeParte,
  separadoresDeLista,
  type ParteCautelar,
} from "./cautelar";
import { renderTemplate, type TemplateRecord } from "./template-engine";

// Synthetic parties. CUILs are check-digit-valid but belong to nobody.
function parte(over: Partial<ParteCautelar> = {}): ParteCautelar {
  return {
    nombre: "PARTE DE PRUEBA",
    cuil: "20-12345678-6",
    domicilio: "Calle Sintética 1 de la ciudad de Tandil",
    trabaja: false,
    empleador: null,
    ...over,
  };
}

function trabajador(over: Partial<ParteCautelar> = {}): ParteCautelar {
  return parte({
    trabaja: true,
    empleador: {
      nombre: "EMPRESA SINTÉTICA S.A.",
      cuit: "30-70123456-8",
      domicilio: "Parque Industrial 2, La Plata",
    },
    ...over,
  });
}

describe("resolveCautelar — fragment selection", () => {
  it("picks haberes when every party works", () => {
    expect(resolveCautelar([trabajador()]).clave).toBe("cautelar.haberes");
    expect(resolveCautelar([trabajador(), trabajador()]).clave).toBe("cautelar.haberes");
    expect(resolveCautelar([trabajador(), trabajador(), trabajador()]).clave).toBe(
      "cautelar.haberes",
    );
  });

  it("picks mercadopago when no party works", () => {
    expect(resolveCautelar([parte()]).clave).toBe("cautelar.mercadopago");
    expect(resolveCautelar([parte(), parte()]).clave).toBe("cautelar.mercadopago");
  });

  it("picks mixto when the parties disagree, in either order", () => {
    expect(resolveCautelar([trabajador(), parte()]).clave).toBe("cautelar.mixto");
    expect(resolveCautelar([parte(), trabajador()]).clave).toBe("cautelar.mixto");
    expect(resolveCautelar([trabajador(), parte(), trabajador()]).clave).toBe(
      "cautelar.mixto",
    );
  });

  it("never returns a clave outside the seeded set", () => {
    const inputs: ParteCautelar[][] = [
      [],
      [parte()],
      [trabajador()],
      [parte(), parte()],
      [trabajador(), trabajador()],
      [parte(), trabajador()],
    ];
    for (const partes of inputs) {
      expect(CAUTELAR_CLAVES).toContain(resolveCautelar(partes).clave);
    }
  });

  it("falls back to mercadopago for an empty party list rather than throwing", () => {
    const plan = resolveCautelar([]);
    expect(plan.clave).toBe("cautelar.mercadopago");
    expect(plan.plural).toBe(false);
    expect(plan.partes).toEqual([]);
  });
});

describe("resolveCautelar — plural and order", () => {
  it("is singular for one party and plural beyond that", () => {
    expect(resolveCautelar([parte()]).plural).toBe(false);
    expect(resolveCautelar([parte(), parte()]).plural).toBe(true);
    expect(resolveCautelar([parte(), parte(), parte()]).plural).toBe(true);
  });

  it("preserves the caller's order — the demandado has to lead", () => {
    const a = parte({ nombre: "DEMANDADO" });
    const b = parte({ nombre: "CODEMANDADO 1" });
    const c = parte({ nombre: "CODEMANDADO 2" });
    expect(resolveCautelar([a, b, c]).partes.map((p) => p.nombre)).toEqual([
      "DEMANDADO",
      "CODEMANDADO 1",
      "CODEMANDADO 2",
    ]);
  });
});

describe("rolDeParte", () => {
  it("names the first party demandado and the rest codemandado", () => {
    expect(rolDeParte(0)).toBe("demandado");
    expect(rolDeParte(1)).toBe("codemandado");
    expect(rolDeParte(2)).toBe("codemandado");
  });
});

describe("parteRecord", () => {
  it("derives the dot-grouped DNI from the CUIL", () => {
    const r = parteRecord(parte({ cuil: "20-12345678-6" }), 0);
    expect(r.CUIL).toBe("20-12345678-6");
    expect(r.DNI).toBe("12.345.678");
  });

  it("strips the zero pad on a 7-digit DNI", () => {
    expect(parteRecord(parte({ cuil: "20-09876543-4" }), 0).DNI).toBe("9.876.543");
  });

  it("leaves a missing field empty so the engine shows the marker", () => {
    const r = parteRecord(parte({ cuil: "", domicilio: "" }), 0);
    expect(r.CUIL).toBe("");
    expect(r.DNI).toBe("");
    expect(r.DOMICILIO).toBe("");
    expect(renderTemplate("{{CUIL}}/{{DNI}}/{{DOMICILIO}}", r as TemplateRecord)).toBe(
      "[CUIL]/[DNI]/[DOMICILIO]",
    );
  });

  it("blanks the employer block when the party does not work", () => {
    const r = parteRecord(parte(), 0);
    expect(r.TRABAJA).toBe(false);
    expect(r.EMPLEADOR).toBe("");
    expect(r.EMPLEADOR_CUIT).toBe("");
    expect(r.EMPLEADOR_DOMICILIO).toBe("");
  });

  it("carries the employer block when the party works", () => {
    const r = parteRecord(trabajador(), 1);
    expect(r.TRABAJA).toBe(true);
    expect(r.EMPLEADOR).toBe("EMPRESA SINTÉTICA S.A.");
    expect(r.EMPLEADOR_CUIT).toBe("30-70123456-8");
    expect(r.ROL).toBe("codemandado");
  });
});

describe("cautelarScope", () => {
  it("exposes the agreement flags the fragments switch on", () => {
    const solo = cautelarScope(resolveCautelar([trabajador()]));
    expect(solo.PLURAL).toBe(false);
    expect(solo.ALGUNO_TRABAJA).toBe(true);
    expect(solo.VARIOS_TRABAJAN).toBe(false);
    expect(solo.HAY_CODEMANDADOS).toBe(false);

    const mixto = cautelarScope(resolveCautelar([trabajador(), parte()]));
    expect(mixto.PLURAL).toBe(true);
    expect(mixto.ALGUNO_TRABAJA).toBe(true);
    expect(mixto.VARIOS_TRABAJAN).toBe(false);
    expect(mixto.HAY_CODEMANDADOS).toBe(true);

    const ambosTrabajan = cautelarScope(resolveCautelar([trabajador(), trabajador()]));
    expect(ambosTrabajan.VARIOS_TRABAJAN).toBe(true);

    const ninguno = cautelarScope(resolveCautelar([parte(), parte()]));
    expect(ninguno.ALGUNO_TRABAJA).toBe(false);
    expect(ninguno.VARIOS_TRABAJAN).toBe(false);
  });

  it("hands the engine a list it can iterate", () => {
    const scope = cautelarScope(
      resolveCautelar([parte({ nombre: "UNO" }), parte({ nombre: "DOS" })]),
    );
    expect(renderTemplate("{{#each PARTES}}{{NOMBRE}};{{/each}}", scope)).toBe("UNO;DOS;");
  });
});

// The wording lives in the DB so the firm can reword it without a deploy. These
// stand-ins only prove the composer feeds the engine the shape the real bodies
// rely on — the seeded text itself is Fran's to diff against the Word models.
describe("composer + engine together", () => {
  const HABERES =
    "{{#if PLURAL}}solicito se decreten embargos sobre los haberes que los demandados perciben" +
    "{{else}}solicito se decrete embargo sobre los haberes que el demandado percibe{{/if}}: " +
    "{{#each PARTES}}{{NOMBRE}}, D.N.I. Nº {{DNI}}, C.U.I.L. N° {{CUIL}} con domicilio real en " +
    "{{DOMICILIO}} y trabaja para {{EMPLEADOR}} (C.U.I.T. {{EMPLEADOR_CUIT}}). {{/each}}";

  const MIXTO =
    "{{#each PARTES}}{{#if TRABAJA}}Se decrete embargo sobre los haberes que el {{ROL}} " +
    "{{NOMBRE}} percibe como empleado para {{EMPLEADOR}}. {{else}}Se trabe embargo sobre la " +
    'cuenta personal de "Mercado Pago" a nombre del {{ROL}} {{NOMBRE}}. {{/if}}{{/each}}';

  it("agrees in number for a single working party", () => {
    const out = renderTemplate(
      HABERES,
      cautelarScope(resolveCautelar([trabajador({ nombre: "UNO" })])),
    );
    expect(out).toContain("solicito se decrete embargo sobre los haberes que el demandado percibe");
    expect(out).not.toContain("perciben");
    expect(out).toContain("UNO, D.N.I. Nº 12.345.678");
  });

  it("agrees in number for two working parties", () => {
    const out = renderTemplate(
      HABERES,
      cautelarScope(resolveCautelar([trabajador({ nombre: "UNO" }), trabajador({ nombre: "DOS" })])),
    );
    expect(out).toContain("se decreten embargos sobre los haberes que los demandados perciben");
    expect(out).toContain("UNO,");
    expect(out).toContain("DOS,");
  });

  it("emits one clause per party, in role order, for a mixed case", () => {
    const out = renderTemplate(
      MIXTO,
      cautelarScope(
        resolveCautelar([trabajador({ nombre: "TITULAR" }), parte({ nombre: "ADICIONAL" })]),
      ),
    );
    expect(out).toBe(
      "Se decrete embargo sobre los haberes que el demandado TITULAR percibe como empleado " +
        // Two periods: the razón social ends in one and the template adds its own.
        "para EMPRESA SINTÉTICA S.A.. " +
        'Se trabe embargo sobre la cuenta personal de "Mercado Pago" a nombre del codemandado ' +
        "ADICIONAL. ",
    );
  });

  it("shows a missing CUIL as a marker rather than swallowing it", () => {
    const out = renderTemplate(
      HABERES,
      cautelarScope(resolveCautelar([trabajador({ nombre: "UNO", cuil: "" })])),
    );
    expect(out).toContain("D.N.I. Nº [DNI]");
    expect(out).toContain("C.U.I.L. N° [CUIL]");
  });
});

describe("separadoresDeLista", () => {
  function join(names: string[]): string {
    return names
      .map((n, i) => {
        const { SEP_Y, SEP_COMA } = separadoresDeLista(i, names.length);
        return `${n}${SEP_Y ? " y " : ""}${SEP_COMA ? ", " : ""}`;
      })
      .join("");
  }

  it("joins the way prose does", () => {
    expect(join(["A"])).toBe("A");
    expect(join(["A", "B"])).toBe("A y B");
    expect(join(["A", "B", "C"])).toBe("A, B y C");
    expect(join(["A", "B", "C", "D"])).toBe("A, B, C y D");
  });

  it("never asks for an empty token", () => {
    // The last item gets both flags false, so the template emits nothing rather
    // than resolving an empty {{SEP}} — which the engine would show as [SEP].
    for (const total of [1, 2, 3, 5]) {
      const last = separadoresDeLista(total - 1, total);
      expect(last.SEP_Y).toBe(false);
      expect(last.SEP_COMA).toBe(false);
    }
  });

  it("renders through the engine without leaving a marker", () => {
    const PARTES = ["UNO", "DOS", "TRES"].map((NOMBRE, i) => ({
      NOMBRE,
      ...separadoresDeLista(i, 3),
    }));
    const out = renderTemplate(
      "{{#each PARTES}}{{NOMBRE}}{{#if SEP_Y}} y {{/if}}{{#if SEP_COMA}}, {{/if}}{{/each}}",
      { PARTES },
    );
    expect(out).toBe("UNO, DOS y TRES");
    expect(out).not.toMatch(/\[[A-Z_]+\]/);
  });
});
