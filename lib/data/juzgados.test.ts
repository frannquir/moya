import { describe, it, expect } from "vitest";
import { formatOrganismo } from "./juzgados";

// El nombre del juzgado se imprime en la carátula del convenio y en el apartado
// de recusación de la demanda, así que la diferencia entre º y ° termina en un
// documento presentado. Fran eligió esta forma el 2026-09-17.
describe("formatOrganismo", () => {
  it("cambia el ordinal masculino de la SCBA por el símbolo de grado", () => {
    expect(formatOrganismo("Juzgado en lo Civil y Comercial Nº 2 - Azul")).toBe(
      "Juzgado en lo Civil y Comercial N° 2 - Azul",
    );
  });

  it("no toca nada más del nombre oficial", () => {
    // Ni la ciudad después del guion, ni las mayúsculas, ni los espacios: es el
    // nombre del organismo, no una descripción que podamos reescribir.
    expect(formatOrganismo("Juzgado de Paz Letrado - Balcarce")).toBe(
      "Juzgado de Paz Letrado - Balcarce",
    );
  });

  it("deja igual un nombre que ya venía con el símbolo de grado", () => {
    expect(formatOrganismo("Juzgado Civil y Comercial N° 1 - Tandil")).toBe(
      "Juzgado Civil y Comercial N° 1 - Tandil",
    );
  });

  it("cambia todas las apariciones, no solo la primera", () => {
    expect(formatOrganismo("Nº 1 y Nº 2")).toBe("N° 1 y N° 2");
  });

  it("aguanta un juzgado sin nombre", () => {
    expect(formatOrganismo(null)).toBe("");
    expect(formatOrganismo(undefined)).toBe("");
    expect(formatOrganismo("")).toBe("");
  });
});
