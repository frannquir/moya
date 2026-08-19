import { describe, it, expect } from "vitest";
import {
  calcularLiquidacion,
  parseSpanishNumber,
  formatCurrency,
  formatPeriodo,
  fechaUltDia,
  parsePastedTasaLine,
} from "./liquidaciones";
import { TASAS_BASE } from "./tasas-base";

describe("liquidaciones", () => {
  describe("parseSpanishNumber", () => {
    it("should parse Spanish format with comma as decimal", () => {
      expect(parseSpanishNumber("1.234,56")).toBeCloseTo(1234.56);
      expect(parseSpanishNumber("1234,56")).toBeCloseTo(1234.56);
    });

    it("should parse English format with period as decimal", () => {
      expect(parseSpanishNumber("1,234.56")).toBeCloseTo(1234.56);
      expect(parseSpanishNumber("1234.56")).toBeCloseTo(1234.56);
    });

    it("should parse integer values", () => {
      expect(parseSpanishNumber("1234")).toBe(1234);
      expect(parseSpanishNumber("10000")).toBe(10000);
    });

    it("should handle invalid input", () => {
      expect(parseSpanishNumber("abc")).toBeNaN();
      expect(parseSpanishNumber("")).toBeNaN();
    });
  });

  describe("formatCurrency", () => {
    it("should format numbers with 2 decimals", () => {
      expect(formatCurrency(1234.56)).toBe("1.234,56");
      expect(formatCurrency(10000)).toBe("10.000,00");
    });
  });

  describe("formatPeriodo", () => {
    it("should format date as 'mes-yy' in Spanish", () => {
      const date = new Date(2026, 0, 15);
      expect(formatPeriodo(date)).toBe("enero-26");
    });

    it("should format October correctly", () => {
      const date = new Date(2025, 9, 5);
      expect(formatPeriodo(date)).toBe("octubre-25");
    });
  });

  describe("fechaUltDia", () => {
    it("should return last day of month", () => {
      const date = new Date(2005, 0, 15);
      const lastDay = fechaUltDia(date);
      expect(lastDay.getDate()).toBe(31);
      expect(lastDay.getMonth()).toBe(0);
      expect(lastDay.getFullYear()).toBe(2005);
    });

    it("should handle February", () => {
      const date = new Date(2005, 1, 5);
      const lastDay = fechaUltDia(date);
      expect(lastDay.getDate()).toBe(28);
      expect(lastDay.getMonth()).toBe(1);
    });

    it("should handle leap year", () => {
      const date = new Date(2024, 1, 5);
      const lastDay = fechaUltDia(date);
      expect(lastDay.getDate()).toBe(29);
      expect(lastDay.getMonth()).toBe(1);
    });
  });

  describe("parsePastedTasaLine", () => {
    it("should parse tab-separated line", () => {
      const result = parsePastedTasaLine("ENERO\t2026\t90.52\t45.26\t109.5292");
      expect(result).toEqual({ mes: "ENERO", anio: 2026, tna: 90.52 });
    });

    it("should parse comma-separated line", () => {
      const result = parsePastedTasaLine("ENERO,2026,90.52,45.26,109.5292");
      expect(result).toEqual({ mes: "ENERO", anio: 2026, tna: 90.52 });
    });

    it("should parse space-separated line", () => {
      const result = parsePastedTasaLine("ENERO    2026    90.52    45.26");
      expect(result).toEqual({ mes: "ENERO", anio: 2026, tna: 90.52 });
    });

    it("should handle year-first format", () => {
      const result = parsePastedTasaLine("2026 ENERO 90.52");
      expect(result).toEqual({ mes: "ENERO", anio: 2026, tna: 90.52 });
    });

    it("should return null for invalid input", () => {
      expect(parsePastedTasaLine("")).toBeNull();
      expect(parsePastedTasaLine("ENERO")).toBeNull();
      expect(parsePastedTasaLine("ENERO 2026")).toBeNull();
    });
  });

  describe("calcularLiquidacion", () => {
    it("should calculate Case A correctly (2005-01-15 to 2005-03-20)", () => {
      const result = calcularLiquidacion(
        {
          cuenta: "123456",
          apynom: "Test User",
          ultVenc: new Date(2005, 0, 15),
          fechaHasta: new Date(2005, 2, 20),
          capital: 10000,
          gastos: 500,
        },
        TASAS_BASE,
      );

      expect(result.capital).toBe(10000);
      expect(result.gastos).toBe(500);
      expect(result.totalIntereses).toBeCloseTo(875.6712328767, 2);
      expect(result.iva).toBeCloseTo(183.8909589041, 2);
      expect(result.total).toBeCloseTo(11559.5621917808, 2);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("should calculate Case B correctly (2025-10-05 to 2026-01-10)", () => {
      const result = calcularLiquidacion(
        {
          cuenta: "789012",
          apynom: "Another User",
          ultVenc: new Date(2025, 9, 5),
          fechaHasta: new Date(2026, 0, 10),
          capital: 250000,
          gastos: 0,
        },
        TASAS_BASE,
      );

      expect(result.capital).toBe(250000);
      expect(result.gastos).toBe(0);
      expect(result.totalIntereses).toBeCloseTo(100515, 0.5);
      expect(result.iva).toBeCloseTo(21108.15, 0.5);
      expect(result.total).toBeCloseTo(371623.15, 0.5);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("should handle same start and end date", () => {
      const result = calcularLiquidacion(
        {
          cuenta: "123",
          apynom: "Test",
          ultVenc: new Date(2025, 0, 15),
          fechaHasta: new Date(2025, 0, 20),
          capital: 10000,
          gastos: 0,
        },
        TASAS_BASE,
      );

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeGreaterThan(result.capital);
    });

    it("should throw error for invalid dates", () => {
      expect(() => {
        calcularLiquidacion(
          {
            cuenta: "123",
            apynom: "Test",
            ultVenc: new Date(1999, 0, 1),
            fechaHasta: new Date(2025, 0, 1),
            capital: 10000,
            gastos: 0,
          },
          TASAS_BASE,
        );
      }).toThrow("No se encontró la fecha de inicio");
    });

    it("should calculate interest rates correctly", () => {
      const result = calcularLiquidacion(
        {
          cuenta: "123",
          apynom: "Test",
          ultVenc: new Date(2025, 0, 15),
          fechaHasta: new Date(2025, 0, 31),
          capital: 10000,
          gastos: 0,
        },
        TASAS_BASE,
      );

      result.rows.forEach((row) => {
        expect(row.importeDeuda).toBe(10000);
        expect(row.tnaVigente).toBeGreaterThan(0);
        expect(row.tem).toBeCloseTo((row.tnaVigente / 365) * 30, 4);
        expect(row.diasDeMora).toBeGreaterThan(0);
        expect(row.intsPunitorios).toBeCloseTo(row.intsCompensatorios / 2, 4);
      });
    });
  });

  describe("calcularLiquidacion — interés sobre gastos", () => {
    const base = {
      cuenta: "123",
      apynom: "Test",
      ultVenc: new Date(2005, 0, 15),
      fechaHasta: new Date(2005, 2, 20),
      capital: 10000,
      gastos: 500,
    };

    function calc(interesGastos?: number | null) {
      return calcularLiquidacion({ ...base, interesGastos }, TASAS_BASE);
    }

    it("adds the manual interés to the total verbatim", () => {
      const without = calc(0);
      const withInteres = calc(1234.56);
      expect(withInteres.interesGastos).toBe(1234.56);
      expect(withInteres.total - without.total).toBeCloseTo(1234.56, 6);
    });

    it("treats a not-entered interés as zero without changing the total", () => {
      const omitted = calc(undefined);
      const nulled = calc(null);
      const zero = calc(0);
      expect(omitted.interesGastos).toBe(0);
      expect(nulled.interesGastos).toBe(0);
      expect(omitted.total).toBe(zero.total);
      expect(nulled.total).toBe(zero.total);
    });

    it("leaves capital, intereses, IVA and gastos untouched", () => {
      const without = calc(0);
      const withInteres = calc(5000);
      expect(withInteres.capital).toBe(without.capital);
      expect(withInteres.totalIntereses).toBe(without.totalIntereses);
      // Interés on gastos is NOT part of the base the 21% IVA is charged on.
      expect(withInteres.iva).toBe(without.iva);
      expect(withInteres.gastos).toBe(without.gastos);
    });

    it("total is capital + intereses + IVA + gastos + interés", () => {
      const r = calc(777);
      expect(r.total).toBeCloseTo(
        r.capital + r.totalIntereses + r.iva + r.gastos + r.interesGastos,
        6,
      );
    });
  });

  describe("calcularLiquidacion — compensatorios / punitorios split", () => {
    const result = calcularLiquidacion(
      {
        cuenta: "123",
        apynom: "Test",
        ultVenc: new Date(2005, 0, 15),
        fechaHasta: new Date(2005, 2, 20),
        capital: 10000,
        gastos: 0,
      },
      TASAS_BASE,
    );

    it("reports each half summed from the rows", () => {
      expect(result.totalCompensatorios).toBeCloseTo(
        result.rows.reduce((s, r) => s + r.intsCompensatorios, 0),
        6,
      );
      expect(result.totalPunitorios).toBeCloseTo(
        result.rows.reduce((s, r) => s + r.intsPunitorios, 0),
        6,
      );
    });

    it("the two halves add up to totalIntereses", () => {
      expect(result.totalCompensatorios + result.totalPunitorios).toBeCloseTo(
        result.totalIntereses,
        6,
      );
    });

    it("matches the 2/3 - 1/3 derivation while punitorios stay half of comp", () => {
      // The fallback in escritos-actions.ts relies on this for rows snapshotted
      // before the split columns existed. If this ever fails, that fallback is
      // lying and must be removed.
      expect(result.totalCompensatorios).toBeCloseTo((result.totalIntereses * 2) / 3, 6);
      expect(result.totalPunitorios).toBeCloseTo(result.totalIntereses / 3, 6);
    });
  });
});