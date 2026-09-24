import { describe, it, expect } from "vitest";
import {
  CUOTAS_OPTIONS,
  MOVIMIENTO_OPTIONS,
  etapaDe,
  parseCasoFormData,
  parseCautelarFormData,
  parseEjecutadoFormData,
  parseMontosFormData,
  parseMovimientoFormData,
  normalizeNumeroExpediente,
  parseViaFormData,
  validateEjecutadoFields,
  validateViaFields,
  viaOf,
} from "./ejecutado";
import type { EjecutadoFormFields, ViaFields } from "./ejecutado";

// Only the fields the validator inspects matter here.
function fields(over: Partial<EjecutadoFormFields> = {}): EjecutadoFormFields {
  return {
    nombre: "Perez, Juan",
    juzgado: "",
    juzgado_id: null,
    departamento: "",
    numero_expediente: "",
    documento: "",
    cuil: "",
    domicilio: "",
    telefono: "",
    deuda_inicial: 0,
    gastos: 0,
    fecha_gastos: null,
    interes_gastos: null,
    fecha_mora: null,
    fecha_deuda: null,
    dinero_en_cuenta: null,
    movimiento: null,
    movimiento_diligenciada: null,
    empresa: null,
    medida_cautelar: null,
    medida_cautelar_estado: null,
    medida_cautelar_diligenciada: false,
    medida_cautelar_nota: "",
    observaciones: "",
    ...over,
  };
}

describe("validateEjecutadoFields — interés sobre gastos", () => {
  it("accepts a blank interés (not entered)", () => {
    expect(validateEjecutadoFields(fields({ interes_gastos: null }))).toBeNull();
  });

  it("accepts zero and positive amounts", () => {
    expect(validateEjecutadoFields(fields({ interes_gastos: 0 }))).toBeNull();
    expect(validateEjecutadoFields(fields({ interes_gastos: 1234.56 }))).toBeNull();
  });

  it("rejects a negative amount", () => {
    expect(validateEjecutadoFields(fields({ interes_gastos: -1 }))).toMatch(/negativo/i);
  });
});

describe("normalizeNumeroExpediente — the causa and nothing else", () => {
  it("bare causa stays bare", () => {
    expect(normalizeNumeroExpediente("1513")).toBe("1513");
  });
  it("drops the departamento and the year from a composite", () => {
    expect(normalizeNumeroExpediente("TD1436 2021")).toBe("1436");
    expect(normalizeNumeroExpediente("OL 840 2019")).toBe("840");
    expect(normalizeNumeroExpediente("TD-1436-2021")).toBe("1436");
  });
  it("drops the year when there is no departamento", () => {
    expect(normalizeNumeroExpediente("16183 - 2024")).toBe("16183");
    expect(normalizeNumeroExpediente("826/2021")).toBe("826");
  });
  it("keeps the leading number of a causa/año that looks like two years", () => {
    // 1942/2025 and friends: the causa falls inside the range of the years, and
    // Fran's rule is that the FIRST number is always the causa.
    expect(normalizeNumeroExpediente("1942/2025")).toBe("1942");
  });
  it("strips leading zeros", () => {
    expect(normalizeNumeroExpediente("000826/2021")).toBe("826");
  });
  it("empty stays empty", () => {
    expect(normalizeNumeroExpediente("  ")).toBe("");
  });
  it("unparseable is returned verbatim (so the validator can reject it)", () => {
    expect(normalizeNumeroExpediente("sin numero")).toBe("sin numero");
    expect(normalizeNumeroExpediente("CCC")).toBe("CCC");
  });
  it("is idempotent — the stored shape normalises to itself", () => {
    for (const raw of ["1513", "TD1436 2021", "16183 - 2024", "826/2021"]) {
      const once = normalizeNumeroExpediente(raw);
      expect(normalizeNumeroExpediente(once)).toBe(once);
    }
  });
});

describe("validateEjecutadoFields", () => {
  it("accepts a parseable expediente", () => {
    expect(validateEjecutadoFields(fields({ numero_expediente: "1513" }))).toBeNull();
  });
  it("accepts an empty expediente (optional)", () => {
    expect(validateEjecutadoFields(fields({ numero_expediente: "" }))).toBeNull();
  });
  it("rejects an expediente with no causa number", () => {
    expect(
      validateEjecutadoFields(fields({ numero_expediente: "sin numero" })),
    ).toMatch(/expediente/i);
  });
  it("requires a nombre", () => {
    expect(validateEjecutadoFields(fields({ nombre: "" }))).toMatch(/nombre/i);
  });
});

// ---------------------------------------------------------------------------
// The extrajudicial axis (Phase 3)
// ---------------------------------------------------------------------------

function viaForm(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("viaOf", () => {
  it("reads a stored value", () => {
    expect(viaOf("extrajudicial")).toBe("extrajudicial");
    expect(viaOf("judicial")).toBe("judicial");
  });

  it("treats NULL and anything unrecognised as judicial", () => {
    // Every case starts judicial, and a row written before the column existed
    // must not read as a settlement.
    expect(viaOf(null)).toBe("judicial");
    expect(viaOf(undefined)).toBe("judicial");
    expect(viaOf("")).toBe("judicial");
    expect(viaOf("Extrajudicial")).toBe("judicial");
  });
});

describe("parseViaFormData", () => {
  it("reads the three settlement fields when going extrajudicial", () => {
    expect(
      parseViaFormData(
        viaForm({
          via: "extrajudicial",
          monto_acuerdo: "270000",
          cuotas: "3",
          fecha_vencimiento: "2026-03-20",
        }),
      ),
    ).toEqual({
      via: "extrajudicial",
      monto_acuerdo: 270000,
      cuotas: 3,
      fecha_vencimiento: "2026-03-20",
    });
  });

  it("reverting to judicial clears all three", () => {
    // They are only meaningful under an agreement; a stale monto left behind
    // would let the convenio generate against numbers nobody agreed to.
    expect(
      parseViaFormData(
        viaForm({
          via: "judicial",
          monto_acuerdo: "270000",
          cuotas: "3",
          fecha_vencimiento: "2026-03-20",
        }),
      ),
    ).toEqual({
      via: "judicial",
      monto_acuerdo: null,
      cuotas: null,
      fecha_vencimiento: null,
    });
  });

  it("an unknown via falls back to judicial rather than writing junk", () => {
    expect(parseViaFormData(viaForm({ via: "mediacion" })).via).toBe("judicial");
    expect(parseViaFormData(new FormData()).via).toBe("judicial");
  });

  it("a cuota count outside the offered set is dropped, not stored", () => {
    // The DB CHECK is (1,3,6,12); a hand-posted 4 must be rejected by the
    // validator, not blow up as a constraint violation.
    const parsed = parseViaFormData(
      viaForm({ via: "extrajudicial", monto_acuerdo: "1000", cuotas: "4" }),
    );
    expect(parsed.cuotas).toBeNull();
  });

  it("accepts every offered cuota count", () => {
    for (const n of CUOTAS_OPTIONS) {
      const parsed = parseViaFormData(
        viaForm({ via: "extrajudicial", monto_acuerdo: "1200000", cuotas: String(n) }),
      );
      expect(parsed.cuotas).toBe(n);
    }
  });
});

describe("validateViaFields", () => {
  const ok: ViaFields = {
    via: "extrajudicial",
    monto_acuerdo: 270000,
    cuotas: 3,
    fecha_vencimiento: "2026-03-20",
  };

  it("accepts a complete agreement", () => {
    expect(validateViaFields(ok)).toBeNull();
  });

  it("judicial needs nothing", () => {
    expect(
      validateViaFields({
        via: "judicial",
        monto_acuerdo: null,
        cuotas: null,
        fecha_vencimiento: null,
      }),
    ).toBeNull();
  });

  it("rejects a missing or zero monto", () => {
    expect(validateViaFields({ ...ok, monto_acuerdo: null })).toMatch(/monto/i);
    expect(validateViaFields({ ...ok, monto_acuerdo: 0 })).toMatch(/monto/i);
    expect(validateViaFields({ ...ok, monto_acuerdo: -1 })).toMatch(/monto/i);
  });

  it("rejects a missing cuota count", () => {
    expect(validateViaFields({ ...ok, cuotas: null })).toMatch(/cuotas/i);
  });

  it("rejects a missing first vencimiento", () => {
    // Without it there is no schedule at all, so the convenio would print a
    // marker where every due date belongs.
    expect(validateViaFields({ ...ok, fecha_vencimiento: null })).toMatch(/vencimiento/i);
  });
});

// The three-way form split.
//
// The guard against gotcha #41 that the type system cannot give: EjecutadoCaso-
// Fields is derived by Omit, so TypeScript cannot tell a dropped column from an
// excluded one. If a parser reaches outside its set, or a column falls between
// all three, a save silently blanks data.

describe("the caso / cautelar / montos / movimiento split", () => {
  // Every field the three forms can post, with values distinguishable from the
  // "absent" default.
  function fullForm(): FormData {
    const fd = new FormData();
    const entries: Record<string, string> = {
      nombre: "Demandado de Prueba",
      juzgado: "Juzgado Sintético",
      juzgado_id: "11111111-1111-1111-1111-111111111111",
      departamento: "Mar del Plata",
      numero_expediente: "1513/2019",
      documento: "12345678",
      cuil: "20-12345678-6",
      domicilio: "Calle Sintética 1",
      telefono: "223-1234567",
      deuda_inicial: "270000",
      gastos: "5000",
      fecha_gastos: "2026-01-10",
      interes_gastos: "1200",
      fecha_mora: "2021-12-09",
      fecha_deuda: "2026-03-01",
      dinero_en_cuenta: "9000",
      movimiento: "Enviar Cédula",
      movimiento_diligenciada: "si",
      empresa: "Tartan",
      medida_cautelar: "embargo",
      medida_cautelar_estado: "Solicitada",
      medida_cautelar_diligenciada: "si",
      medida_cautelar_nota: "Nota de prueba",
      observaciones: "Observación de prueba",
    };
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  }

  const MONTOS = [
    "deuda_inicial",
    "gastos",
    "fecha_gastos",
    "interes_gastos",
    "fecha_mora",
    "fecha_deuda",
  ];
  const CAUTELAR = [
    "medida_cautelar",
    "medida_cautelar_estado",
    "medida_cautelar_diligenciada",
    "medida_cautelar_nota",
    "dinero_en_cuenta",
  ];
  const MOVIMIENTO = ["movimiento", "movimiento_diligenciada"];

  it("the four sets are disjoint — no column is written by two forms", () => {
    const fd = fullForm();
    const caso = Object.keys(parseCasoFormData(fd));
    const cautelar = Object.keys(parseCautelarFormData(fd));
    const montos = Object.keys(parseMontosFormData(fd));
    const movimiento = Object.keys(parseMovimientoFormData(fd));

    expect(caso.filter((k) => montos.includes(k))).toEqual([]);
    expect(caso.filter((k) => cautelar.includes(k))).toEqual([]);
    expect(caso.filter((k) => movimiento.includes(k))).toEqual([]);
    expect(cautelar.filter((k) => montos.includes(k))).toEqual([]);
    expect(cautelar.filter((k) => movimiento.includes(k))).toEqual([]);
    expect(montos.filter((k) => movimiento.includes(k))).toEqual([]);
  });

  it("together they cover every column of EjecutadoFormFields — none falls through", () => {
    const fd = fullForm();
    const all = Object.keys(parseEjecutadoFormData(fd)).sort();
    const split = [
      ...Object.keys(parseCasoFormData(fd)),
      ...Object.keys(parseCautelarFormData(fd)),
      ...Object.keys(parseMontosFormData(fd)),
      ...Object.keys(parseMovimientoFormData(fd)),
    ].sort();
    expect(split).toEqual(all);
  });

  it("each parser claims exactly the columns it is supposed to", () => {
    const fd = fullForm();
    expect(Object.keys(parseMontosFormData(fd)).sort()).toEqual([...MONTOS].sort());
    expect(Object.keys(parseCautelarFormData(fd)).sort()).toEqual([...CAUTELAR].sort());
    expect(Object.keys(parseMovimientoFormData(fd)).sort()).toEqual([...MOVIMIENTO].sort());
  });

  it("the caso parser never reaches into money, cautelar or movimiento columns", () => {
    // Catches updateCaso spreading a montos key as undefined, which Postgres
    // writes as NULL over a real liquidación input. Same trap for movimiento
    // (gotcha #41) now that the header dropdown owns it instead of this form.
    const caso = parseCasoFormData(fullForm()) as Record<string, unknown>;
    for (const k of [...MONTOS, ...CAUTELAR, ...MOVIMIENTO]) {
      expect(Object.prototype.hasOwnProperty.call(caso, k)).toBe(false);
    }
  });

  it("each parser reads its own values correctly out of a shared form", () => {
    const fd = fullForm();
    expect(parseMontosFormData(fd)).toEqual({
      deuda_inicial: 270000,
      gastos: 5000,
      fecha_gastos: "2026-01-10",
      interes_gastos: 1200,
      fecha_mora: "2021-12-09",
      fecha_deuda: "2026-03-01",
    });
    expect(parseCautelarFormData(fd)).toEqual({
      medida_cautelar: "embargo",
      medida_cautelar_estado: "Solicitada",
      medida_cautelar_diligenciada: true,
      medida_cautelar_nota: "Nota de prueba",
      dinero_en_cuenta: 9000,
    });
    expect(parseMovimientoFormData(fd)).toEqual({
      movimiento: "Enviar Cédula",
      movimiento_diligenciada: true,
    });
    expect(parseCasoFormData(fd).nombre).toBe("Demandado de Prueba");
    expect(parseCasoFormData(fd).observaciones).toBe("Observación de prueba");
  });
});

describe("parseMovimientoFormData — the header dropdown", () => {
  function fd(movimiento: string, diligenciada: string): FormData {
    const f = new FormData();
    f.set("movimiento", movimiento);
    f.set("movimiento_diligenciada", diligenciada);
    return f;
  }

  it("__none__ reads as no movimiento", () => {
    expect(parseMovimientoFormData(fd("__none__", "__unknown__"))).toEqual({
      movimiento: null,
      movimiento_diligenciada: null,
    });
  });

  it("__unknown__ reads as diligenciada: null, not false — the dropdown's third state", () => {
    // This is the state the pinned layer (escritos-pinned.ts) treats as
    // "we don't know which branch applies" and pins nothing for. Feature 7
    // makes it a one-click choice rather than a value the form silently
    // defaults to, so it should stay reachable and distinct from "no".
    expect(parseMovimientoFormData(fd("Enviar Cédula", "__unknown__"))).toEqual({
      movimiento: "Enviar Cédula",
      movimiento_diligenciada: null,
    });
  });

  it("si / no map to true / false", () => {
    expect(parseMovimientoFormData(fd("Enviar Cédula", "si")).movimiento_diligenciada).toBe(
      true,
    );
    expect(parseMovimientoFormData(fd("Enviar Cédula", "no")).movimiento_diligenciada).toBe(
      false,
    );
  });

  it("an unrecognised movimiento value reads as null rather than being stored verbatim", () => {
    expect(parseMovimientoFormData(fd("Etapa Inventada", "si")).movimiento).toBeNull();
  });
});

describe("etapaDe", () => {
  it("keys every movimiento the form can store", () => {
    // The colour ramp is only complete if no option falls through to null —
    // a stage without a key renders grey in a table where everything else is
    // coloured, which reads as a bug rather than as "no stage".
    for (const m of MOVIMIENTO_OPTIONS) {
      expect(etapaDe(m)).not.toBeNull();
    }
  });

  it("maps the pipeline in ramp order", () => {
    expect(MOVIMIENTO_OPTIONS.map(etapaDe)).toEqual([
      "inicio",
      "cedula",
      "mandamiento",
      "sentencia",
      "cobro",
    ]);
  });

  it("reads an absent or unknown movimiento as no stage", () => {
    expect(etapaDe(null)).toBeNull();
    expect(etapaDe(undefined)).toBeNull();
    expect(etapaDe("")).toBeNull();
    // A value left behind by an older option list, or by the migration.
    expect(etapaDe("Trabada la litis")).toBeNull();
  });
});
