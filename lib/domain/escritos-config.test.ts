import { describe, it, expect } from "vitest";
import {
  ABOGADO_DEFAULT,
  CUENTA_HONORARIOS,
  CUENTA_HONORARIOS_DEFAULT,
  cuentaHonorariosPartes,
  formatCuentaHonorarios,
  resolveCuentaHonorarios,
  articuloDe,
  formatAutorizados,
  resolveDomicilioProcesal,
  buildEncabezado,
  resolveJuezRecusado,
  tratamientoDe,
  type EstudioEscritosConfig,
} from "./escritos-config";

const config: EstudioEscritosConfig = {
  domicilios_procesales: {
    "Depto Uno": "domicilio uno",
    "Dépto Dós": "domicilio dos",
  },
};

describe("resolveDomicilioProcesal", () => {
  it("resolves an exact key", () => {
    expect(resolveDomicilioProcesal(config, "Depto Uno")).toBe("domicilio uno");
  });

  it("matches case-insensitively", () => {
    expect(resolveDomicilioProcesal(config, "depto uno")).toBe("domicilio uno");
  });

  it("matches when accents drift in either direction", () => {
    expect(resolveDomicilioProcesal(config, "Depto Dos")).toBe("domicilio dos");
    expect(
      resolveDomicilioProcesal({ domicilios_procesales: { "Depto Dos": "x" } }, "Dépto Dós"),
    ).toBe("x");
  });

  it("tolerates surrounding whitespace", () => {
    expect(resolveDomicilioProcesal(config, "  Depto Uno  ")).toBe("domicilio uno");
  });

  it("returns empty for missing departamento, config, or unconfigured key", () => {
    expect(resolveDomicilioProcesal(config, null)).toBe("");
    expect(resolveDomicilioProcesal(config, "")).toBe("");
    expect(resolveDomicilioProcesal(null, "Depto Uno")).toBe("");
    expect(resolveDomicilioProcesal(config, "Depto Tres")).toBe("");
  });

  it("ignores an empty configured value", () => {
    expect(
      resolveDomicilioProcesal({ domicilios_procesales: { "Depto Uno": "" } }, "Depto Uno"),
    ).toBe("");
  });
});

// Week 2C: section IX lists the estudio's own members rather than a free-text
// config field. The treatment splits on TWO axes (Fran, 2026-08-22), because the
// source demanda uses both: "la Dra. María Victoria Iñurrieta" is a female
// lawyer, "Sr. Lautaro Moyano" is a man who is not one.
describe("tratamientoDe", () => {
  it("covers all four cases", () => {
    expect(tratamientoDe("F", true)).toBe("Dra.");
    expect(tratamientoDe("M", true)).toBe("Dr.");
    expect(tratamientoDe("F", false)).toBe("Sra.");
    expect(tratamientoDe("M", false)).toBe("Sr.");
  });

  it("defaults to non-lawyer, the conservative error", () => {
    // Calling a lawyer "Sr." is a discourtesy; calling a non-lawyer "Dr."
    // misstates a professional qualification in a court filing.
    expect(tratamientoDe("F")).toBe("Sra.");
    expect(tratamientoDe("M")).toBe("Sr.");
    expect(tratamientoDe("M", null)).toBe("Sr.");
  });

  it("returns nothing for an unknown genero rather than guessing", () => {
    for (const g of [null, undefined, "", "X", "f", "m"]) {
      expect(tratamientoDe(g, true)).toBe("");
      expect(tratamientoDe(g, false)).toBe("");
    }
  });
});

describe("articuloDe", () => {
  it("agrees with genero", () => {
    expect(articuloDe("F")).toBe("la");
    expect(articuloDe("M")).toBe("el");
  });

  it("returns nothing when genero is unknown, so the name stands bare", () => {
    for (const g of [null, undefined, "", "X"]) expect(articuloDe(g)).toBe("");
  });
});

describe("formatAutorizados", () => {
  // Section IX is running text: "…con las presentes actuaciones la Dra. María
  // Victoria Iñurrieta…". Without the article the sentence is ungrammatical.
  // The source writes "la Dra." but then a bare "Sr. Lautaro Moyano"; the article
  // is applied uniformly here rather than carrying that inconsistency forward.
  it("reproduces the source demanda's list, with the article on every name", () => {
    expect(
      formatAutorizados([
        { nombre: "María Victoria Iñurrieta", genero: "F", es_abogado: true },
        { nombre: "Lautaro Moyano", genero: "M", es_abogado: false },
        { nombre: "Matias Prusso", genero: "M", es_abogado: false },
      ]),
    ).toBe(
      "la Dra. María Victoria Iñurrieta y/o el Sr. Lautaro Moyano y/o el Sr. Matias Prusso",
    );
  });

  it("reads as a sentence when dropped into the template text", () => {
    const lista = formatAutorizados([
      { nombre: "María Victoria Iñurrieta", genero: "F", es_abogado: true },
    ]);
    expect(
      `Quedan autorizados a realizar cualquier trámite relacionado con las presentes actuaciones ${lista} y/o quienes ellos designen.-`,
    ).toBe(
      "Quedan autorizados a realizar cualquier trámite relacionado con las presentes " +
        "actuaciones la Dra. María Victoria Iñurrieta y/o quienes ellos designen.-",
    );
  });

  it("gets a male lawyer right, which a gender-only rule could not", () => {
    expect(formatAutorizados([{ nombre: "Juan Pérez", genero: "M", es_abogado: true }])).toBe(
      "el Dr. Juan Pérez",
    );
  });

  it("prints a bare name when genero is unknown", () => {
    expect(formatAutorizados([{ nombre: "Sin Genero" }])).toBe("Sin Genero");
    expect(formatAutorizados([{ nombre: "Sin Genero", genero: null }])).toBe("Sin Genero");
  });

  it("skips a member with no nombre, leaving no dangling y/o", () => {
    expect(
      formatAutorizados([
        { nombre: "Uno", genero: "M", es_abogado: true },
        { nombre: "", genero: "F" },
        { nombre: "   " },
        { nombre: null },
        { nombre: "Dos", genero: "F", es_abogado: true },
      ]),
    ).toBe("el Dr. Uno y/o la Dra. Dos");
  });

  it("returns empty when nobody has a nombre, so the caller can show the marker", () => {
    expect(formatAutorizados([])).toBe("");
    expect(formatAutorizados([{ nombre: "" }, { nombre: null }])).toBe("");
  });

  it("handles a single member without a separator", () => {
    expect(formatAutorizados([{ nombre: "Solo", genero: "F", es_abogado: true }])).toBe(
      "la Dra. Solo",
    );
  });

  it("trims stored whitespace", () => {
    expect(formatAutorizados([{ nombre: "  Espaciado  ", genero: "M" }])).toBe(
      "el Sr. Espaciado",
    );
  });

  it("preserves the order it is given — head first, from the RPC", () => {
    expect(
      formatAutorizados([{ nombre: "Head" }, { nombre: "Member" }]),
    ).toBe("Head y/o Member");
  });
});

describe("buildEncabezado — the encargado half", () => {
  const empresa = {
    razonSocial: "TARTAN S.A.",
    domicilioLegal: "Av. Independencia 1502",
    cuit: "30-70918460-8",
    cuentaBancaria: "",
  };
  const base = {
    empresa,
    domicilioProcesal: "calle falsa 123",
    demandado: "Juan Pérez",
    expediente: "MP-1234-2026",
  };

  it("emits a [TOKEN] for every unconfigured field, never a placeholder value", () => {
    const out = buildEncabezado({ ...base, abogado: {} });

    // The whole point: extractUnresolved sees these, escrito-editor badges them,
    // and each badge links to /estudio. ABOGADO_DEFAULT would have printed a
    // plausible-looking "00-00000000-0" that nothing could detect.
    expect(out).toContain("[ABOGADO_NOMBRE]");
    expect(out).toContain("[ABOGADO_MATRICULA]");
    expect(out).toContain("[ABOGADO_LEGAJO]");
    expect(out).toContain("[ABOGADO_CUIT]");
    expect(out).toContain("[ABOGADO_IBM]");
    expect(out).toContain("[ABOGADO_DOMICILIO_ELECTRONICO]");
    expect(out).toContain("[ABOGADO_TELEFONO]");

    expect(out).not.toContain(ABOGADO_DEFAULT.nombre);
    expect(out).not.toContain(ABOGADO_DEFAULT.cuit);
    expect(out).not.toContain(ABOGADO_DEFAULT.legajo);
  });

  it("keeps IVA Responsable Inscripto, which is a real value and not a placeholder", () => {
    const out = buildEncabezado({ ...base, abogado: {} });
    expect(out).toContain("IVA Responsable Inscripto");
    expect(out).not.toContain("[ABOGADO_IVA");
  });

  it("marks only the blanks, so a half-filled encargado keeps what it has", () => {
    const out = buildEncabezado({
      ...base,
      abogado: { nombre: "RUBEN ADRIAN GALANTE", cuit: "20-22341849-0" },
    });
    expect(out).toContain("RUBEN ADRIAN GALANTE");
    expect(out).toContain("CUIT Nº 20-22341849-0");
    expect(out).toContain("[ABOGADO_LEGAJO]");
    expect(out).not.toContain("[ABOGADO_NOMBRE]");
  });

  it("treats whitespace as unconfigured", () => {
    const out = buildEncabezado({ ...base, abogado: { nombre: "   " } });
    expect(out).toContain("[ABOGADO_NOMBRE]");
  });

  it("still marks the empresa half the same way it always did", () => {
    const out = buildEncabezado({
      ...base,
      empresa: null,
      domicilioProcesal: "",
      abogado: {},
    });
    expect(out).toContain("[EMPRESA]");
    expect(out).toContain("[DOMICILIO_LEGAL_EMPRESA]");
    expect(out).toContain("[DOMICILIO_PROCESAL]");
  });
});

describe("formatCuentaHonorarios", () => {
  const cuenta = {
    tipo: "Caja de ahorro",
    banco: "Nación",
    numero: "123-4",
    cbu: "0000000000000000000001",
    alias: "MI.ALIAS",
    dni: "12345678",
    titular: "Juana Pérez",
  };

  it("reads as a noun phrase, the way both templates use it", () => {
    // "...transferir el saldo a la {{CUENTA_HONORARIOS}}" and "en la siguiente
    // cuenta: {{CUENTA_HONORARIOS}}".
    expect(formatCuentaHonorarios(cuenta)).toBe(
      "Caja de ahorro del Banco Nación, Cuenta Nro: 123-4, " +
        "CBU: 0000000000000000000001, DNI: 12345678, " +
        "Alias de CBU: MI.ALIAS, de titularidad de Juana Pérez",
    );
  });

  it("drops the whole clause for a part that is empty", () => {
    expect(formatCuentaHonorarios({ ...cuenta, cbu: "", dni: "" })).toBe(
      "Caja de ahorro del Banco Nación, Cuenta Nro: 123-4, " +
        "Alias de CBU: MI.ALIAS, de titularidad de Juana Pérez",
    );
  });

  it("returns an empty string when nothing is filled", () => {
    expect(formatCuentaHonorarios({})).toBe("");
    expect(formatCuentaHonorarios(undefined)).toBe("");
  });

  it("still composes the placeholder constant", () => {
    // CUENTA_HONORARIOS is built from the parts, so the two cannot drift.
    expect(CUENTA_HONORARIOS).toBe(formatCuentaHonorarios(CUENTA_HONORARIOS_DEFAULT));
    expect(CUENTA_HONORARIOS).toContain("Alias de CBU: ALIAS.CBU");
  });
});

describe("resolveCuentaHonorarios", () => {
  it("composes the parts", () => {
    expect(
      resolveCuentaHonorarios({
        cuenta_honorarios: { tipo: "Caja de ahorro", banco: "Nación", numero: "", cbu: "", alias: "", dni: "", titular: "" },
      }),
    ).toBe("Caja de ahorro del Banco Nación");
  });

  it("renders a value saved before the split", () => {
    expect(resolveCuentaHonorarios({ cuenta_honorarios: "cuenta vieja en una línea" })).toBe(
      "cuenta vieja en una línea",
    );
  });

  it("falls back to texto while every part is empty", () => {
    expect(
      resolveCuentaHonorarios({
        cuenta_honorarios: { tipo: "", banco: "", numero: "", cbu: "", alias: "", dni: "", titular: "", texto: "lo de antes" },
      }),
    ).toBe("lo de antes");
  });

  it("shows the placeholder when there is nothing at all", () => {
    expect(resolveCuentaHonorarios({})).toBe(CUENTA_HONORARIOS);
    expect(resolveCuentaHonorarios({ cuenta_honorarios: "" })).toBe(CUENTA_HONORARIOS);
  });
});

describe("cuentaHonorariosPartes", () => {
  it("keeps a pre-split string as texto so the form does not lose it", () => {
    expect(cuentaHonorariosPartes({ cuenta_honorarios: "una línea" })).toMatchObject({
      tipo: "",
      texto: "una línea",
    });
  });

  it("fills every part, so no input goes uncontrolled", () => {
    const p = cuentaHonorariosPartes({});
    expect(Object.values(p).every((v) => v === "")).toBe(true);
  });
});

describe("resolveJuezRecusado", () => {
  const config = {
    jueces_recusados: {
      "aaaaaaaa-0000-0000-0000-000000000001": "Dra. Marta Lopez",
      "aaaaaaaa-0000-0000-0000-000000000002": "   ",
    },
  };

  it("returns the configured name for a listed court", () => {
    expect(
      resolveJuezRecusado(config, "aaaaaaaa-0000-0000-0000-000000000001"),
    ).toBe("Dra. Marta Lopez");
  });

  it("returns empty for a court that is not listed", () => {
    // Not a missing value: an unlisted court means the demanda simply omits the
    // section, so this must never become a [TOKEN] or a warning.
    expect(resolveJuezRecusado(config, "aaaaaaaa-0000-0000-0000-00000000ffff")).toBe("");
  });

  it("returns empty for a case with no court at all", () => {
    expect(resolveJuezRecusado(config, null)).toBe("");
    expect(resolveJuezRecusado(config, undefined)).toBe("");
    expect(resolveJuezRecusado(config, "")).toBe("");
  });

  it("treats a whitespace-only name as not recused", () => {
    expect(
      resolveJuezRecusado(config, "aaaaaaaa-0000-0000-0000-000000000002"),
    ).toBe("");
  });

  it("survives a config that predates the feature", () => {
    expect(resolveJuezRecusado({}, "any")).toBe("");
    expect(resolveJuezRecusado(null, "any")).toBe("");
    expect(resolveJuezRecusado(undefined, "any")).toBe("");
  });

  it("never falls back to the court's sitting judge", () => {
    // The whole reason the map exists: juzgados.juez is populated for essentially
    // every court, so a fallback would recuse someone on every demanda.
    expect(resolveJuezRecusado({ jueces_recusados: {} }, "cualquiera")).toBe("");
  });
});
