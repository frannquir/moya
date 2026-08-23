import { describe, it, expect } from "vitest";
import {
  CUOTAS_OPTIONS,
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

describe("normalizeNumeroExpediente — one consistent stored shape", () => {
  it("bare causa stays bare", () => {
    expect(normalizeNumeroExpediente("1513")).toBe("1513");
  });
  it("glued/spaced composite → DEPTO-causa-año", () => {
    expect(normalizeNumeroExpediente("TD1436 2021")).toBe("TD-1436-2021");
    expect(normalizeNumeroExpediente("OL 840 2019")).toBe("OL-840-2019");
  });
  it("causa with year but no depto → causa/año", () => {
    expect(normalizeNumeroExpediente("16183 - 2024")).toBe("16183/2024");
  });
  it("empty stays empty", () => {
    expect(normalizeNumeroExpediente("  ")).toBe("");
  });
  it("unparseable is returned verbatim (so the validator can reject it)", () => {
    expect(normalizeNumeroExpediente("sin numero")).toBe("sin numero");
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
