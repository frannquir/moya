import { describe, it, expect } from "vitest";
import {
  ABOGADO_DEFAULT,
  articuloDe,
  formatAutorizados,
  resolveDomicilioProcesal,
  resolveEncargado,
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

describe("resolveEncargado", () => {
  it("falls back to visible placeholders when the estudio has not configured one", () => {
    const e = resolveEncargado({});
    expect(e.nombre).toBe(ABOGADO_DEFAULT.nombre);
    expect(e.matricula).toBe(ABOGADO_DEFAULT.matricula);
  });

  it("fills only the blanks, so a half-filled block still reads as a sentence", () => {
    const e = resolveEncargado({ encargado: { nombre: "RUBEN ADRIAN GALANTE" } });
    expect(e.nombre).toBe("RUBEN ADRIAN GALANTE");
    expect(e.legajo).toBe(ABOGADO_DEFAULT.legajo);
  });

  it("treats an absent config the same as an empty one", () => {
    expect(resolveEncargado(null).nombre).toBe(ABOGADO_DEFAULT.nombre);
    expect(resolveEncargado(undefined).nombre).toBe(ABOGADO_DEFAULT.nombre);
  });
});
