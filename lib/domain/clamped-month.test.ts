import { describe, it, expect } from "vitest";
import { calcularLiquidacion } from "./liquidaciones";
import { TASAS_BASE } from "./tasas-base";

describe("clamped month fix", () => {
  it("should include January 2026 when fechaHasta is Feb 2026 and tasas end at Jan 2026", () => {
    const result = calcularLiquidacion(
      {
        cuenta: "TEST",
        apynom: "TEST",
        ultVenc: new Date(2024, 3, 18), // 18/04/2024
        fechaHasta: new Date(2026, 1, 9), // 09/02/2026
        capital: 173280,
        gastos: 0,
      },
      TASAS_BASE,
    );

    const months = result.rows.map((r) => {
      const m = r.periodo.getMonth();
      const y = r.periodo.getFullYear();
      return `${y}-${String(m + 1).padStart(2, "0")}`;
    });

    expect(months).toContain("2026-01");
    expect(months[months.length - 1]).toBe("2026-02");
    expect(months.length).toBeGreaterThanOrEqual(23);
  });
});