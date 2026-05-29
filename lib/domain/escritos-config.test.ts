import { describe, it, expect } from "vitest";
import { resolveDomicilioProcesal, type EstudioEscritosConfig } from "./escritos-config";

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
