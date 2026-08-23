import { describe, it, expect } from "vitest";
import {
  CONVENIO_CLAVE,
  addMonthsClamped,
  cuotasTexto,
  fechaEnLetras,
  montosCuotas,
  planDePagos,
  vencimientos,
} from "./convenio";
import { CUOTAS_OPTIONS } from "./ejecutado";

const d = (iso: string) => {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
};

describe("addMonthsClamped", () => {
  it("keeps the day of month when the target month is long enough", () => {
    expect(addMonthsClamped(d("2026-03-20"), 1)).toEqual(d("2026-04-20"));
    expect(addMonthsClamped(d("2026-03-20"), 5)).toEqual(d("2026-08-20"));
  });

  it("clamps into a short month instead of overflowing into the next one", () => {
    // Date's own arithmetic gives 03/03 here, which would silently skip February.
    expect(addMonthsClamped(d("2026-01-31"), 1)).toEqual(d("2026-02-28"));
    expect(addMonthsClamped(d("2026-01-31"), 3)).toEqual(d("2026-04-30"));
  });

  it("knows about leap years", () => {
    expect(addMonthsClamped(d("2028-01-31"), 1)).toEqual(d("2028-02-29"));
  });

  it("clamps per step from the original day, so one short month does not drag the rest", () => {
    // 31/01 → 28/02 → 31/03, not 28/03.
    expect(addMonthsClamped(d("2026-01-31"), 2)).toEqual(d("2026-03-31"));
  });

  it("rolls the year over", () => {
    expect(addMonthsClamped(d("2026-11-15"), 3)).toEqual(d("2027-02-15"));
  });
});

describe("vencimientos", () => {
  it("a single payment is just the date entered", () => {
    expect(vencimientos("2026-03-20", 1)).toEqual(["2026-03-20"]);
  });

  it("steps one month at a time from the entered date", () => {
    expect(vencimientos("2026-03-20", 3)).toEqual([
      "2026-03-20",
      "2026-04-20",
      "2026-05-20",
    ]);
  });

  it("produces exactly one date per cuota, for every offered count", () => {
    for (const n of CUOTAS_OPTIONS) {
      expect(vencimientos("2026-03-20", n)).toHaveLength(n);
    }
  });

  it("twelve cuotas land on the same day of the following year", () => {
    const fechas = vencimientos("2026-03-20", 12);
    expect(fechas[0]).toBe("2026-03-20");
    expect(fechas[11]).toBe("2027-02-20");
  });

  it("a 31st vencimiento never skips a month", () => {
    const fechas = vencimientos("2026-01-31", 6);
    expect(fechas).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
    ]);
    // One vencimiento per calendar month, no repeats, no gaps.
    expect(new Set(fechas.map((f) => f.slice(0, 7))).size).toBe(6);
  });
});

describe("montosCuotas", () => {
  it("splits evenly when it divides", () => {
    expect(montosCuotas(270000, 3)).toEqual([90000, 90000, 90000]);
  });

  it("always adds back up to exactly the settlement amount", () => {
    for (const monto of [270000, 100000, 99999.99, 1, 333333.33, 0.05]) {
      for (const n of CUOTAS_OPTIONS) {
        const partes = montosCuotas(monto, n);
        const suma = Math.round(partes.reduce((a, b) => a + b, 0) * 100);
        expect(suma).toBe(Math.round(monto * 100));
      }
    }
  });

  it("puts the residue on the last cuota", () => {
    const partes = montosCuotas(100, 3);
    expect(partes).toEqual([33.33, 33.33, 33.34]);
  });

  it("a single cuota is the whole amount", () => {
    expect(montosCuotas(270000, 1)).toEqual([270000]);
  });
});

describe("cuotasTexto", () => {
  it("one cuota renders UN PAGO", () => {
    expect(cuotasTexto(270000, 1)).toBe("UN PAGO");
  });

  it("an even split names the per-cuota amount once", () => {
    expect(cuotasTexto(270000, 3)).toBe(
      "TRES CUOTAS de PESOS NOVENTA MIL ($90.000,00.-) cada una",
    );
  });

  it("spells the count out rather than printing a digit", () => {
    expect(cuotasTexto(600000, 6)).toContain("SEIS CUOTAS");
    expect(cuotasTexto(1200000, 12)).toContain("DOCE CUOTAS");
  });

  it("an uneven split names the last cuota separately rather than lying with 'cada una'", () => {
    const texto = cuotasTexto(100, 3);
    expect(texto).not.toContain("cada una");
    expect(texto).toContain("DOS de PESOS TREINTA Y TRES CON TREINTA Y TRES CENTAVOS");
    expect(texto).toContain("y una última de PESOS TREINTA Y TRES CON TREINTA Y CUATRO CENTAVOS");
  });

  it("every offered cuota count produces text, and only 1 says UN PAGO", () => {
    for (const n of CUOTAS_OPTIONS) {
      const texto = cuotasTexto(1200000, n);
      expect(texto).not.toBe("");
      expect(texto === "UN PAGO").toBe(n === 1);
    }
  });
});

describe("planDePagos", () => {
  it("pairs every amount with its own vencimiento, in order", () => {
    expect(planDePagos(270000, 3, "2026-03-20")).toEqual([
      { NRO: "1", MONTO: "PESOS NOVENTA MIL ($90.000,00.-)", FECHA: "20/03/2026" },
      { NRO: "2", MONTO: "PESOS NOVENTA MIL ($90.000,00.-)", FECHA: "20/04/2026" },
      { NRO: "3", MONTO: "PESOS NOVENTA MIL ($90.000,00.-)", FECHA: "20/05/2026" },
    ]);
  });

  it("numbers the rows from 1", () => {
    const plan = planDePagos(1200000, 12, "2026-03-20");
    expect(plan).toHaveLength(12);
    expect(plan[0].NRO).toBe("1");
    expect(plan[11].NRO).toBe("12");
  });
});

describe("fechaEnLetras", () => {
  it("spells the day and names the month", () => {
    expect(fechaEnLetras(d("2026-03-19"))).toBe(
      "a los DIECINUEVE días del mes de Marzo de 2026",
    );
  });

  it("uses the ordinal on the first of the month", () => {
    // "a los UNO días" is not Spanish.
    expect(fechaEnLetras(d("2026-03-01"))).toBe("al PRIMER día del mes de Marzo de 2026");
  });

  it("apocopates before the masculine 'días'", () => {
    expect(fechaEnLetras(d("2026-05-21"))).toBe(
      "a los VEINTIÚN días del mes de Mayo de 2026",
    );
  });
});

describe("CONVENIO_CLAVE", () => {
  it("matches the clave the migration seeds", () => {
    // Templates are referenced by clave, never by título (gotcha #31). If this
    // drifts from 20260823130000_convenio_reconocimiento.sql the pin resolves to
    // nothing and the recommendation silently disappears.
    expect(CONVENIO_CLAVE).toBe("convenio.reconocimiento-deuda");
  });
});
