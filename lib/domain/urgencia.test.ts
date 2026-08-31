import { describe, it, expect } from "vitest";
import {
  DIAS_ATENCION,
  DIAS_URGENTE,
  diasInactivo,
  textoDeInactividad,
  urgenciaDeCaso,
} from "./urgencia";

const HOY = new Date(2026, 7, 31, 12, 0, 0); // 31/08/2026, midday

/** An ISO timestamp `dias` before HOY, at midday so no boundary is straddled. */
function haceDias(dias: number): string {
  const d = new Date(HOY);
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

describe("diasInactivo", () => {
  it("counts whole local days", () => {
    expect(diasInactivo(haceDias(0), HOY)).toBe(0);
    expect(diasInactivo(haceDias(1), HOY)).toBe(1);
    expect(diasInactivo(haceDias(45), HOY)).toBe(45);
  });

  it("floors both sides to midnight, so last night counts as a day", () => {
    const anoche = new Date(2026, 7, 30, 23, 50, 0).toISOString();
    expect(diasInactivo(anoche, HOY)).toBe(1);
  });

  it("returns null rather than NaN for missing or unparseable input", () => {
    expect(diasInactivo(null, HOY)).toBeNull();
    expect(diasInactivo(undefined, HOY)).toBeNull();
    expect(diasInactivo("no es una fecha", HOY)).toBeNull();
  });
});

describe("urgenciaDeCaso", () => {
  it("is ok until the atención threshold", () => {
    expect(urgenciaDeCaso(haceDias(0), HOY)).toBe("ok");
    expect(urgenciaDeCaso(haceDias(DIAS_ATENCION - 1), HOY)).toBe("ok");
  });

  it("turns at each threshold, inclusive", () => {
    expect(urgenciaDeCaso(haceDias(DIAS_ATENCION), HOY)).toBe("atencion");
    expect(urgenciaDeCaso(haceDias(DIAS_URGENTE - 1), HOY)).toBe("atencion");
    expect(urgenciaDeCaso(haceDias(DIAS_URGENTE), HOY)).toBe("urgente");
    expect(urgenciaDeCaso(haceDias(400), HOY)).toBe("urgente");
  });

  it("reads a missing updated_at as ok, not as neglect", () => {
    // Migrated rows can land without one; a permanent red bar on every such row
    // would make the signal worthless.
    expect(urgenciaDeCaso(null, HOY)).toBe("ok");
  });
});

describe("textoDeInactividad", () => {
  it("says nothing while the case is still fresh", () => {
    expect(textoDeInactividad(haceDias(5), HOY)).toBeNull();
    expect(textoDeInactividad(null, HOY)).toBeNull();
  });

  it("counts days below two months and months above", () => {
    expect(textoDeInactividad(haceDias(45), HOY)).toBe("Sin movimiento hace 45 días");
    expect(textoDeInactividad(haceDias(70), HOY)).toBe("Sin movimiento hace 2 meses");
  });
});
