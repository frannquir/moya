import { describe, it, expect } from "vitest";
import { formatMontoNumerico, montoALetras, numeroALetras } from "./numero-a-letras";

describe("numeroALetras — boundaries", () => {
  const cases: [number, string][] = [
    [0, "CERO"],
    [1, "UNO"],
    [2, "DOS"],
    [9, "NUEVE"],
    [10, "DIEZ"],
    [11, "ONCE"],
    [15, "QUINCE"],
    [16, "DIECISÉIS"],
    [17, "DIECISIETE"],
    [18, "DIECIOCHO"],
    [19, "DIECINUEVE"],
    [20, "VEINTE"],
    [21, "VEINTIUNO"],
    [22, "VEINTIDÓS"],
    [23, "VEINTITRÉS"],
    [26, "VEINTISÉIS"],
    [29, "VEINTINUEVE"],
    [30, "TREINTA"],
    [31, "TREINTA Y UNO"],
    [99, "NOVENTA Y NUEVE"],
    [100, "CIEN"],
    [101, "CIENTO UNO"],
    [115, "CIENTO QUINCE"],
    [200, "DOSCIENTOS"],
    [500, "QUINIENTOS"],
    [700, "SETECIENTOS"],
    [900, "NOVECIENTOS"],
    [999, "NOVECIENTOS NOVENTA Y NUEVE"],
    [1000, "MIL"],
    [1001, "MIL UNO"],
    [1100, "MIL CIEN"],
    [2000, "DOS MIL"],
    [1000000, "UN MILLÓN"],
    [2000000, "DOS MILLONES"],
  ];

  for (const [n, expected] of cases) {
    it(`${n} -> ${expected}`, () => {
      expect(numeroALetras(n)).toBe(expected);
    });
  }
});

describe("numeroALetras — the apocopation rule", () => {
  it("keeps UNO in terminal position", () => {
    expect(numeroALetras(1)).toBe("UNO");
    expect(numeroALetras(21)).toBe("VEINTIUNO");
    expect(numeroALetras(31)).toBe("TREINTA Y UNO");
    expect(numeroALetras(101)).toBe("CIENTO UNO");
    expect(numeroALetras(1001)).toBe("MIL UNO");
  });

  it("apocopates before a masculine noun", () => {
    expect(numeroALetras(1, { apocopar: true })).toBe("UN");
    expect(numeroALetras(21, { apocopar: true })).toBe("VEINTIÚN");
    expect(numeroALetras(31, { apocopar: true })).toBe("TREINTA Y UN");
    expect(numeroALetras(101, { apocopar: true })).toBe("CIENTO UN");
  });

  it("apocopates before the multiplier MIL", () => {
    expect(numeroALetras(21000)).toBe("VEINTIÚN MIL");
    expect(numeroALetras(101000)).toBe("CIENTO UN MIL");
    expect(numeroALetras(31000)).toBe("TREINTA Y UN MIL");
    expect(numeroALetras(201000)).toBe("DOSCIENTOS UN MIL");
  });

  it("says MIL, never UN MIL", () => {
    expect(numeroALetras(1000)).toBe("MIL");
    expect(numeroALetras(1500)).toBe("MIL QUINIENTOS");
  });

  it("apocopates before the multiplier MILLÓN / MILLONES", () => {
    expect(numeroALetras(1000000)).toBe("UN MILLÓN");
    expect(numeroALetras(21000000)).toBe("VEINTIÚN MILLONES");
    expect(numeroALetras(101000000)).toBe("CIENTO UN MILLONES");
  });

  it("keeps the terminal group unapocopated even when an earlier group is not", () => {
    // The MIL group apocopates; the trailing 101 is terminal and does not.
    expect(numeroALetras(21101)).toBe("VEINTIÚN MIL CIENTO UNO");
    expect(numeroALetras(1000001)).toBe("UN MILLÓN UNO");
  });
});

describe("numeroALetras — composition", () => {
  it("composes millones, miles and unidades", () => {
    expect(numeroALetras(1132015)).toBe("UN MILLÓN CIENTO TREINTA Y DOS MIL QUINCE");
    expect(numeroALetras(999999)).toBe(
      "NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE",
    );
    expect(numeroALetras(1000100)).toBe("UN MILLÓN CIEN");
    expect(numeroALetras(2500000)).toBe("DOS MILLONES QUINIENTOS MIL");
  });

  it("truncates a fractional input and ignores the sign", () => {
    expect(numeroALetras(15.9)).toBe("QUINCE");
    expect(numeroALetras(-15)).toBe("QUINCE");
  });

  it("returns empty for a non-finite input rather than throwing", () => {
    expect(numeroALetras(Number.NaN)).toBe("");
    expect(numeroALetras(Number.POSITIVE_INFINITY)).toBe("");
  });
});

describe("montoALetras — the canonical form", () => {
  // The three real amounts from the firm's documents. Amounts are not PII.
  it("renders the amounts from the source demandas", () => {
    expect(montoALetras(437101)).toBe(
      "PESOS CUATROCIENTOS TREINTA Y SIETE MIL CIENTO UNO ($437.101,00.-)",
    );
    expect(montoALetras(303153)).toBe(
      "PESOS TRESCIENTOS TRES MIL CIENTO CINCUENTA Y TRES ($303.153,00.-)",
    );
    expect(montoALetras(270000)).toBe("PESOS DOSCIENTOS SETENTA MIL ($270.000,00.-)");
  });

  it("always hardcodes ,00 for a whole amount", () => {
    expect(montoALetras(0)).toBe("PESOS CERO ($0,00.-)");
    expect(montoALetras(1)).toBe("PESOS UNO ($1,00.-)");
    expect(montoALetras(1000000)).toBe("PESOS UN MILLÓN ($1.000.000,00.-)");
  });

  it("spells centavos out so the letters and the digits agree", () => {
    expect(montoALetras(303153.5)).toBe(
      "PESOS TRESCIENTOS TRES MIL CIENTO CINCUENTA Y TRES CON CINCUENTA CENTAVOS ($303.153,50.-)",
    );
    expect(montoALetras(100.01)).toBe("PESOS CIEN CON UN CENTAVO ($100,01.-)");
    expect(montoALetras(100.21)).toBe("PESOS CIEN CON VEINTIÚN CENTAVOS ($100,21.-)");
    expect(montoALetras(100.99)).toBe(
      "PESOS CIEN CON NOVENTA Y NUEVE CENTAVOS ($100,99.-)",
    );
  });

  it("rounds centavos rather than truncating, and carries into the peso", () => {
    // Float arithmetic upstream must not turn 50 centavos into 49.
    expect(montoALetras(0.1 + 0.2)).toBe("PESOS CERO CON TREINTA CENTAVOS ($0,30.-)");
    expect(montoALetras(10.999)).toBe("PESOS ONCE ($11,00.-)");
  });

  it("ignores the sign", () => {
    expect(montoALetras(-270000)).toBe("PESOS DOSCIENTOS SETENTA MIL ($270.000,00.-)");
  });
});

describe("formatMontoNumerico", () => {
  it("groups thousands with dots and uses a comma decimal", () => {
    expect(formatMontoNumerico(437101)).toBe("$437.101,00.-");
    expect(formatMontoNumerico(1132015.5)).toBe("$1.132.015,50.-");
    expect(formatMontoNumerico(0)).toBe("$0,00.-");
  });
});
