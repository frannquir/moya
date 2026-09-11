import { describe, it, expect } from "vitest";
import {
  calcularLiquidacion,
  parseSpanishNumber,
  formatCurrency,
  formatPeriodo,
  fechaUltDia,
  parsePastedTasaLine,
  parseTasaNumber,
  parseTasaRow,
  parseTasasBlock,
  tasaRowFromFields,
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

  describe("parseTasasBlock", () => {
    // Written as line arrays so the tab and newline separators stay visible.
    const block = (...lines: string[]) => lines.join("\n");

    it("parses a pasted block, in chronological order", () => {
      const { parsed, rejected } = parseTasasBlock(
        block("AGOSTO\t2026\t74,20", "JULIO\t2026\t78,50", ""),
      );
      expect(rejected).toEqual([]);
      expect(parsed.map((t) => t.mes)).toEqual(["JULIO", "AGOSTO"]);
      expect(parsed[0].tna).toBe(78.5);
    });

    it("skips blank lines and reports the ones it could not read", () => {
      const { parsed, rejected } = parseTasasBlock(
        block("JULIO 2026 78,50", "", "   ", "basura"),
      );
      expect(parsed).toHaveLength(1);
      expect(rejected).toEqual(["basura"]);
    });

    it("keeps the last line when a month is repeated", () => {
      // Pasting a correction underneath is how a typo gets fixed; the upsert
      // would land the last one anyway, so the preview has to show that one.
      const { parsed } = parseTasasBlock(
        block("JULIO 2026 78,50", "JULIO 2026 79,10"),
      );
      expect(parsed).toHaveLength(1);
      expect(parsed[0].tna).toBe(79.1);
    });

    it("normalises SEPTIEMBRE so it cannot duplicate SETIEMBRE", () => {
      const { parsed } = parseTasasBlock(
        block("SEPTIEMBRE 2026 70", "SETIEMBRE 2026 71"),
      );
      expect(parsed).toHaveLength(1);
      expect(parsed[0].mes).toBe("SETIEMBRE");
    });

    it("reads a Spanish decimal when the fields are tab-separated", () => {
      // The failure this guards against is silent: split on the comma and
      // 78,50 becomes a perfectly plausible 78.
      const { parsed } = parseTasasBlock("JULIO\t2026\t78,50");
      expect(parsed[0].tna).toBe(78.5);
      expect(parseTasasBlock("JULIO   2026   78,50").parsed[0].tna).toBe(78.5);
    });

    it("still treats the comma as a separator in the CSV form", () => {
      const { parsed } = parseTasasBlock("ENERO,2026,90.52,45.26,109.5292");
      expect(parsed[0]).toEqual({
        mes: "ENERO",
        anio: 2026,
        tna: 90.52,
        intsPunitorios: 45.26,
        tea: 109.5292,
        cft: null,
      });
    });

    it("skips the header the BCRA table is copied with", () => {
      const { parsed, rejected } = parseTasasBlock(
        block(
          "MES\tAÑO\tFin. Saldos\tInts. Punitorios\tT.E.A.\tC.F.T.",
          "JUNIO\t2025\t90.5200 \t45.2600 \t109.5292 \t109.5292",
        ),
      );
      expect(rejected).toEqual([]);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].mes).toBe("JUNIO");
    });
  });

  describe("parseTasaNumber", () => {
    it("reads the four decimals the BCRA publishes, with either mark", () => {
      // parseSpanishNumber returns 905200 for the first of these: it only
      // accepts a comma decimal with one or two digits after it, because it
      // parses money. A rate a thousand times too large would sail through
      // every check downstream.
      expect(parseTasaNumber("90,5200")).toBeCloseTo(90.52);
      expect(parseTasaNumber("90.5200")).toBeCloseTo(90.52);
      expect(parseSpanishNumber("90,5200")).toBe(905200);
    });

    it("takes the rightmost mark as the decimal when both appear", () => {
      expect(parseTasaNumber("1.234,5678")).toBeCloseTo(1234.5678);
      expect(parseTasaNumber("1,234.5678")).toBeCloseTo(1234.5678);
    });

    it("handles whole numbers and blanks", () => {
      expect(parseTasaNumber("78")).toBe(78);
      expect(parseTasaNumber("")).toBeNaN();
      expect(parseTasaNumber("   ")).toBeNaN();
    });
  });

  describe("parseTasaRow", () => {
    it("reads the whole BCRA line, trailing spaces and all", () => {
      // The exact shape of a copy-paste off the BCRA page.
      expect(parseTasaRow("JUNIO\t2025\t90.5200 \t45.2600 \t109.5292 \t109.5292")).toEqual({
        mes: "JUNIO",
        anio: 2025,
        tna: 90.52,
        intsPunitorios: 45.26,
        tea: 109.5292,
        cft: 109.5292,
      });
    });

    it("keeps the rates in published order, not sorted or deduplicated", () => {
      // T.E.A. and C.F.T. are equal whenever there are no extra charges; two
      // equal numbers are two fields, not one.
      const row = parseTasaRow("JUNIO 2025 90.52 45.26 109.5292 109.5292")!;
      expect(row.tea).toBe(109.5292);
      expect(row.cft).toBe(109.5292);
    });

    it("leaves the missing rates null instead of guessing them", () => {
      // The old three-column paste. Punitorios is half the financiación in
      // practice, but deriving it here would invent a figure for a document.
      expect(parseTasaRow("JULIO 2026 78.50")).toEqual({
        mes: "JULIO",
        anio: 2026,
        tna: 78.5,
        intsPunitorios: null,
        tea: null,
        cft: null,
      });
    });

    it("does not mistake a later four-digit number for the year", () => {
      const row = parseTasaRow("ENERO 2026 90.52 45.26 2050")!;
      expect(row.anio).toBe(2026);
      expect(row.tea).toBe(2050);
    });

    it("rejects a line missing the month, the year or every rate", () => {
      expect(parseTasaRow("2025 90.52")).toBeNull();
      expect(parseTasaRow("JUNIO 90.52")).toBeNull();
      expect(parseTasaRow("JUNIO 2025")).toBeNull();
    });
  });

  describe("tasaRowFromFields", () => {
    const campos = {
      mes: "junio",
      anio: "2025",
      tna: "90,5200",
      intsPunitorios: "45,2600",
      tea: "109.5292",
      cft: "109.5292",
    };

    it("accepts the typed fields, in either decimal convention", () => {
      const out = tasaRowFromFields(campos);
      expect(out).toEqual({
        row: {
          mes: "JUNIO",
          anio: 2025,
          tna: 90.52,
          intsPunitorios: 45.26,
          tea: 109.5292,
          cft: 109.5292,
        },
      });
    });

    it("keeps each rate in its own field when the middle one is blank", () => {
      // The reason this does not re-join the fields into a line and re-parse:
      // positionally, an empty punitorios box would promote T.E.A. into it.
      const out = tasaRowFromFields({ ...campos, intsPunitorios: "" });
      expect(out).toEqual({
        row: {
          mes: "JUNIO",
          anio: 2025,
          tna: 90.52,
          intsPunitorios: null,
          tea: 109.5292,
          cft: 109.5292,
        },
      });
    });

    it("normalises SEPTIEMBRE typed by hand", () => {
      const out = tasaRowFromFields({ ...campos, mes: "Septiembre" });
      expect("row" in out && out.row.mes).toBe("SETIEMBRE");
    });

    it("names the field that is wrong instead of failing generically", () => {
      expect(tasaRowFromFields({ ...campos, mes: "JUNIOO" })).toEqual({
        error: "Elegí un mes válido.",
      });
      expect(tasaRowFromFields({ ...campos, anio: "1999" })).toEqual({
        error: "El año tiene que estar entre 2001 y 2099.",
      });
      expect(tasaRowFromFields({ ...campos, tna: "" })).toEqual({
        error: "Ingresá la financiación de saldos.",
      });
      expect(tasaRowFromFields({ ...campos, tea: "ochenta" })).toEqual({
        error: "T.E.A. no es un número válido.",
      });
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

