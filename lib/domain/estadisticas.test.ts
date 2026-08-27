import { describe, it, expect } from "vitest";
import { DIAS_PARA_RECLAMAR, diasDesde, textoDeAtraso, urgencia } from "./estadisticas";

describe("diasDesde", () => {
  const hoy = new Date(2026, 7, 27); // 27/08/2026, local

  it("counts calendar days, not 24-hour periods", () => {
    expect(diasDesde("2026-08-27", hoy)).toBe(0);
    expect(diasDesde("2026-08-26", hoy)).toBe(1);
    expect(diasDesde("2026-07-17", hoy)).toBe(41);
  });

  it("is unaffected by the time of day", () => {
    const manana = new Date(2026, 7, 27, 8, 0, 0);
    const noche = new Date(2026, 7, 27, 23, 30, 0);
    expect(diasDesde("2026-08-26", manana)).toBe(diasDesde("2026-08-26", noche));
  });

  it("crosses a month boundary correctly", () => {
    expect(diasDesde("2026-07-28", hoy)).toBe(30);
  });

  it("survives a DST-style shift without drifting a day", () => {
    expect(diasDesde("2026-03-01", new Date(2026, 2, 31))).toBe(30);
  });

  it("returns a negative for a future date rather than throwing", () => {
    expect(diasDesde("2026-09-01", hoy)).toBe(-5);
  });
});

describe("textoDeAtraso", () => {
  it("distinguishes never-paid from merely late", () => {
    expect(textoDeAtraso(null)).toBe("Nunca se cobró");
    expect(textoDeAtraso(45)).toBe("Hace 45 días");
  });

  it("handles the small numbers in Spanish", () => {
    expect(textoDeAtraso(0)).toBe("Hoy");
    expect(textoDeAtraso(1)).toBe("Hace 1 día");
    expect(textoDeAtraso(2)).toBe("Hace 2 días");
  });

  it("switches to months once days stop being useful", () => {
    expect(textoDeAtraso(60)).toBe("Hace 2 meses");
    expect(textoDeAtraso(95)).toBe("Hace 3 meses");
  });

  it("does not say a negative number of days", () => {
    expect(textoDeAtraso(-3)).toBe("Pago futuro");
  });
});

describe("urgencia", () => {
  it("ranks never-paid above any lateness", () => {
    expect(urgencia(null)).toBe("nunca");
  });

  it("escalates past two chase periods", () => {
    expect(urgencia(DIAS_PARA_RECLAMAR)).toBe("media");
    expect(urgencia(DIAS_PARA_RECLAMAR * 2)).toBe("alta");
    expect(urgencia(200)).toBe("alta");
  });
});

describe("DIAS_PARA_RECLAMAR", () => {
  it("is the firm's monthly cadence", () => {
    expect(DIAS_PARA_RECLAMAR).toBe(30);
  });
});
