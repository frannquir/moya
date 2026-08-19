import { describe, it, expect } from "vitest";
import { normalizeNumeroExpediente, validateEjecutadoFields } from "./ejecutado";
import type { EjecutadoFormFields } from "./ejecutado";

// Only the fields the validator inspects matter here.
function fields(over: Partial<EjecutadoFormFields> = {}): EjecutadoFormFields {
  return {
    nombre: "Perez, Juan",
    juzgado: "",
    juzgado_id: null,
    departamento: "",
    numero_expediente: "",
    documento: "",
    domicilio: "",
    codemandados: [],
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
