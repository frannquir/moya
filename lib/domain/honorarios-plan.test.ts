import { afterEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cuotasTexto, montosCuotas } from "./convenio";
import { techoHonorario } from "./honorarios";
import {
  PLAN_CUOTAS_MAX,
  PLAN_CUOTAS_MIN,
  PLAN_CUOTAS_OPTIONS,
  capLegalParaPlan,
  honorariosTexto,
  inicioDeudaSugerido,
  planDeFila,
  planHonorarios,
  techoDelPlan,
  validarPlanHonorarios,
  type PlanHonorarios,
} from "./honorarios-plan";
import { montoALetras } from "./numero-a-letras";

const centavos = (ars: number) => Math.round(ars * 100);

/** A plan that must exist — the tests below are about its contents. */
function plan(input: Parameters<typeof planHonorarios>[0]): PlanHonorarios {
  const p = planHonorarios(input);
  if (!p) throw new Error("se esperaba un plan");
  return p;
}

const fechas = (p: PlanHonorarios) => p.cuotas.map((c) => c.fecha);

describe("planHonorarios — la suma", () => {
  const TOTALES = [100000, 257102.5, 1];
  const CUOTAS = PLAN_CUOTAS_OPTIONS;

  it("anticipo + cuotas es exactamente el total, al centavo, en todas las combinaciones", () => {
    let armados = 0;
    for (const total of TOTALES) {
      for (const cuotas of CUOTAS) {
        for (const anticipoArs of [null, 1, total / 3]) {
          const input = { total, anticipoArs, cuotas, fechaPrimera: "2025-09-27" };
          if (anticipoArs !== null && centavos(anticipoArs) >= centavos(total)) {
            // total = 1 con anticipo = 1: no queda nada para las cuotas.
            expect(() => planHonorarios(input)).toThrow(RangeError);
            continue;
          }
          const p = plan(input);
          const suma = centavos(p.anticipo) + p.cuotas.reduce((s, c) => s + centavos(c.monto), 0);
          expect(suma, `total ${total}, ${cuotas} cuotas, anticipo ${anticipoArs}`).toBe(
            centavos(total),
          );
          expect(p.cuotas).toHaveLength(cuotas);
          armados++;
        }
      }
    }
    // 3 totales x 12 cantidades x 3 anticipos, menos las 12 de total = anticipo = 1.
    expect(armados).toBe(3 * 12 * 3 - 12);
  });

  it("el residuo va a la ÚLTIMA cuota, como en montosCuotas", () => {
    const p = plan({ total: 100000, anticipoArs: null, cuotas: 3, fechaPrimera: "2025-09-27" });
    expect(p.cuotas.map((c) => c.monto)).toEqual([33333.33, 33333.33, 33333.34]);
  });

  it("con anticipo, lo que se divide es el saldo, y el residuo sigue yendo a la última", () => {
    // 90.000 en 7: 1.285.714 centavos cada una y 2 de resto.
    const p = plan({ total: 100000, anticipoArs: 10000, cuotas: 7, fechaPrimera: "2025-09-27" });
    expect(p.anticipo).toBe(10000);
    expect(p.cuotas.slice(0, 6).every((c) => c.monto === 12857.14)).toBe(true);
    expect(p.cuotas[6].monto).toBe(12857.16);
  });

  it("es el mismo reparto que montosCuotas sobre el saldo — no hay una segunda división", () => {
    const p = plan({ total: 257102.5, anticipoArs: 50000, cuotas: 6, fechaPrimera: "2025-09-27" });
    expect(p.cuotas.map((c) => c.monto)).toEqual(montosCuotas(207102.5, 6));
  });

  it("un anticipo con fracciones de centavo se toma al centavo, y la suma igual cierra", () => {
    const p = plan({
      total: 257102.5,
      anticipoArs: 257102.5 / 3,
      cuotas: 3,
      fechaPrimera: "2025-09-27",
    });
    expect(p.anticipo).toBe(85700.83);
    expect(centavos(p.anticipo) + p.cuotas.reduce((s, c) => s + centavos(c.monto), 0)).toBe(
      25710250,
    );
  });

  it("sin anticipo, el anticipo es 0", () => {
    const p = plan({ total: 100000, anticipoArs: null, cuotas: 2, fechaPrimera: "2025-09-27" });
    expect(p.anticipo).toBe(0);
  });

  it("rechaza un anticipo igual o mayor al total: no quedaría nada para las cuotas", () => {
    for (const anticipoArs of [100000, 100000.001, 150000]) {
      const input = { total: 100000, anticipoArs, cuotas: 3, fechaPrimera: "2025-09-27" };
      expect(() => planHonorarios(input)).toThrow(RangeError);
      expect(validarPlanHonorarios(input)).toMatch(/anticipo/i);
    }
  });

  it("un centavo por debajo del total todavía es un anticipo válido", () => {
    const p = plan({ total: 100000, anticipoArs: 99999.99, cuotas: 1, fechaPrimera: "2025-09-27" });
    expect(p.cuotas).toEqual([{ nro: 1, monto: 0.01, fecha: "2025-09-27" }]);
  });

  it("rechaza un saldo que no alcanza para un centavo por cuota", () => {
    const input = { total: 100000, anticipoArs: 99999.99, cuotas: 2, fechaPrimera: "2025-09-27" };
    expect(() => planHonorarios(input)).toThrow(RangeError);
    expect(validarPlanHonorarios(input)).not.toBeNull();
  });
});

describe("planHonorarios — las fechas", () => {
  it("la cuota 1 cae en la fecha primera misma, no un mes después", () => {
    const p = plan({ total: 100000, anticipoArs: null, cuotas: 1, fechaPrimera: "2025-09-27" });
    expect(p.cuotas).toEqual([{ nro: 1, monto: 100000, fecha: "2025-09-27" }]);
    expect(p.ultimaFecha).toBe("2025-09-27");
  });

  it("el ejemplo de Fran: 27/09/2025 en 2 cuotas → 27/09 y 27/10, y la deuda el 27/11", () => {
    const p = plan({ total: 100000, anticipoArs: 20000, cuotas: 2, fechaPrimera: "2025-09-27" });
    expect(fechas(p)).toEqual(["2025-09-27", "2025-10-27"]);
    expect(p.cuotas.map((c) => c.nro)).toEqual([1, 2]);
    expect(p.ultimaFecha).toBe("2025-10-27");
    expect(inicioDeudaSugerido(p)).toBe("2025-11-27");
  });

  it("31/01 en 3 cuotas → 31/01, 28/02, 31/03: el febrero corto no arrastra a marzo", () => {
    const p = plan({ total: 90000, anticipoArs: null, cuotas: 3, fechaPrimera: "2026-01-31" });
    expect(fechas(p)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("en un año bisiesto el 31/01 pasa al 29/02", () => {
    const p = plan({ total: 90000, anticipoArs: null, cuotas: 3, fechaPrimera: "2028-01-31" });
    expect(fechas(p)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]);
  });

  it("la deuda de ese plan arranca el 30/04: un mes después del 31/03, recortado", () => {
    const p = plan({ total: 90000, anticipoArs: null, cuotas: 3, fechaPrimera: "2026-01-31" });
    expect(inicioDeudaSugerido(p)).toBe("2026-04-30");
  });

  it("la deuda sigue la serie del día original, no la última fecha recortada", () => {
    // 31/01 y 28/02: la deuda cae el 31/03 — el mismo ritmo mensual — y no el
    // 28/03 que saldría de sumarle un mes a una fecha que ya venía recortada.
    const p = plan({ total: 90000, anticipoArs: null, cuotas: 2, fechaPrimera: "2026-01-31" });
    expect(p.ultimaFecha).toBe("2026-02-28");
    expect(inicioDeudaSugerido(p)).toBe("2026-03-31");

    const bisiesto = plan({ total: 90000, anticipoArs: null, cuotas: 2, fechaPrimera: "2028-01-31" });
    expect(bisiesto.ultimaFecha).toBe("2028-02-29");
    expect(inicioDeudaSugerido(bisiesto)).toBe("2028-03-31");
  });

  it("cruza el año", () => {
    const p = plan({ total: 90000, anticipoArs: null, cuotas: 3, fechaPrimera: "2025-11-15" });
    expect(fechas(p)).toEqual(["2025-11-15", "2025-12-15", "2026-01-15"]);
    expect(inicioDeudaSugerido(p)).toBe("2026-02-15");
  });

  it("12 cuotas desde un 31 recortan cada mes corto por separado", () => {
    const p = plan({ total: 120000, anticipoArs: null, cuotas: 12, fechaPrimera: "2026-01-31" });
    expect(fechas(p)).toEqual([
      "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30",
      "2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31",
      "2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31",
    ]);
    expect(inicioDeudaSugerido(p)).toBe("2027-01-31");
  });
});

describe("planHonorarios — la zona horaria", () => {
  const tzOriginal = process.env.TZ;
  afterEach(() => {
    if (tzOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = tzOriginal;
  });

  it("cruzando un cambio de horario a medianoche, el día del mes no se corre", () => {
    // Buenos Aires tuvo horario de verano en 2008-2009, y el cambio era a las
    // 00:00: el 19/10/2008 no tuvo medianoche (00:00 → 01:00) y el 15/03/2009
    // la repitió. Es el peor caso para quien arma fechas con new Date(iso).
    process.env.TZ = "America/Argentina/Buenos_Aires";

    // Primero, que la zona esté de verdad puesta — si no, el test no prueba nada.
    expect(new Date(2008, 9, 19).getHours()).toBe(1);
    // Y lo que este módulo NO hace: new Date() sobre un ISO pelado lo lee en UTC
    // y en Buenos Aires cae el día anterior.
    expect(new Date("2008-10-19").getDate()).toBe(18);

    const p = plan({ total: 70000, anticipoArs: null, cuotas: 7, fechaPrimera: "2008-09-19" });
    expect(fechas(p)).toEqual([
      "2008-09-19", "2008-10-19", "2008-11-19", "2008-12-19",
      "2009-01-19", "2009-02-19", "2009-03-19",
    ]);
    expect(inicioDeudaSugerido(p)).toBe("2009-04-19");

    // Y arrancando justo en los dos días del cambio.
    const salto = plan({ total: 30000, anticipoArs: null, cuotas: 2, fechaPrimera: "2008-10-19" });
    expect(fechas(salto)).toEqual(["2008-10-19", "2008-11-19"]);
    const vuelta = plan({ total: 30000, anticipoArs: null, cuotas: 2, fechaPrimera: "2009-02-15" });
    expect(fechas(vuelta)).toEqual(["2009-02-15", "2009-03-15"]);
    expect(inicioDeudaSugerido(vuelta)).toBe("2009-04-15");
  });
});

describe("planHonorarios — sin plan", () => {
  it("con los cuatro datos en null no hay plan, ni fecha de deuda sugerida", () => {
    const input = { total: null, anticipoArs: null, cuotas: null, fechaPrimera: null };
    expect(planHonorarios(input)).toBeNull();
    expect(validarPlanHonorarios(input)).toBeNull();
    expect(inicioDeudaSugerido(null)).toBeNull();
    expect(honorariosTexto(null)).toBe("UN PAGO");
  });

  it("un honorario con techo pero sin plan sigue siendo un solo pago, como hoy", () => {
    const input = { total: 488137.44, anticipoArs: null, cuotas: null, fechaPrimera: null };
    expect(planHonorarios(input)).toBeNull();
    expect(validarPlanHonorarios(input)).toBeNull();
  });

  it("medio plan no es un plan: sin cuotas o sin fecha devuelve null, y validar lo dice", () => {
    const sinFecha = { total: 100000, anticipoArs: null, cuotas: 3, fechaPrimera: null };
    const sinCuotas = { total: 100000, anticipoArs: null, cuotas: null, fechaPrimera: "2025-09-27" };
    expect(planHonorarios(sinFecha)).toBeNull();
    expect(planHonorarios(sinCuotas)).toBeNull();
    expect(validarPlanHonorarios(sinFecha)).not.toBeNull();
    expect(validarPlanHonorarios(sinCuotas)).not.toBeNull();
  });

  it("una fecha vacía cuenta como ausente, que es lo que postea un DateField sin tocar", () => {
    expect(
      planHonorarios({ total: 100000, anticipoArs: null, cuotas: null, fechaPrimera: "" }),
    ).toBeNull();
  });

  it("un anticipo solo, sin cuotas, no arma plan y validar lo marca", () => {
    const input = { total: 100000, anticipoArs: 20000, cuotas: null, fechaPrimera: null };
    expect(planHonorarios(input)).toBeNull();
    expect(validarPlanHonorarios(input)).toMatch(/anticipo/i);
  });
});

describe("validarPlanHonorarios", () => {
  const base = { total: 100000, anticipoArs: null, cuotas: 3, fechaPrimera: "2025-09-27" };

  it("un plan completo y sano no tiene nada que decir", () => {
    expect(validarPlanHonorarios(base)).toBeNull();
    expect(validarPlanHonorarios({ ...base, anticipoArs: 20000 })).toBeNull();
  });

  it("cuotas libres de 1 a 12, enteras", () => {
    for (const cuotas of PLAN_CUOTAS_OPTIONS) {
      expect(validarPlanHonorarios({ ...base, cuotas })).toBeNull();
    }
    for (const cuotas of [0, 13, -1, 2.5, Number.NaN]) {
      const input = { ...base, cuotas };
      expect(validarPlanHonorarios(input), `cuotas ${cuotas}`).not.toBeNull();
      expect(() => planHonorarios(input)).toThrow(RangeError);
    }
  });

  it("la fecha tiene que ser un día que existe, en ISO", () => {
    for (const fechaPrimera of ["2025-02-30", "27/09/2025", "2025-9-27", "2025-13-01", "hoy"]) {
      const input = { ...base, fechaPrimera };
      expect(validarPlanHonorarios(input), fechaPrimera).not.toBeNull();
      expect(() => planHonorarios(input)).toThrow(RangeError);
    }
  });

  it("sin un total positivo no hay nada que dividir", () => {
    for (const total of [null, 0, -100, Number.NaN]) {
      const input = { ...base, total };
      expect(validarPlanHonorarios(input), `total ${total}`).not.toBeNull();
      expect(() => planHonorarios(input)).toThrow(RangeError);
    }
  });

  it("un anticipo de cero o negativo es un error, no un anticipo", () => {
    for (const anticipoArs of [0, -500]) {
      expect(validarPlanHonorarios({ ...base, anticipoArs })).toMatch(/anticipo/i);
    }
  });
});

describe("honorariosTexto", () => {
  it("un plan de 1 cuota sin anticipo es UN PAGO, igual que cuotasTexto", () => {
    const p = plan({ total: 100000, anticipoArs: null, cuotas: 1, fechaPrimera: "2025-09-27" });
    expect(honorariosTexto(p)).toBe("UN PAGO");
  });

  it("sin anticipo es exactamente cuotasTexto sobre el total", () => {
    for (const cuotas of PLAN_CUOTAS_OPTIONS) {
      const p = plan({ total: 257102.5, anticipoArs: null, cuotas, fechaPrimera: "2025-09-27" });
      expect(honorariosTexto(p)).toBe(cuotasTexto(257102.5, cuotas));
    }
  });

  it("con anticipo, el anticipo va adelante y el saldo en cuotas", () => {
    const p = plan({ total: 300000, anticipoArs: 120000, cuotas: 3, fechaPrimera: "2025-09-27" });
    expect(honorariosTexto(p)).toBe(
      `UN ANTICIPO de ${montoALetras(120000)} a la firma del presente y el saldo en ` +
        `TRES CUOTAS de ${montoALetras(60000)} cada una`,
    );
  });

  it("con anticipo y una sola cuota, el saldo va en UN PAGO", () => {
    const p = plan({ total: 300000, anticipoArs: 120000, cuotas: 1, fechaPrimera: "2025-09-27" });
    expect(honorariosTexto(p)).toBe(
      `UN ANTICIPO de ${montoALetras(120000)} a la firma del presente y el saldo en UN PAGO`,
    );
  });

  it("los montos del texto son los de las cuotas del plan, también cuando no dividen parejo", () => {
    for (const cuotas of PLAN_CUOTAS_OPTIONS.filter((n) => n > 1)) {
      const p = plan({ total: 100000, anticipoArs: 10000, cuotas, fechaPrimera: "2025-09-27" });
      const texto = honorariosTexto(p);
      expect(texto).toContain(montoALetras(p.cuotas[0].monto));
      expect(texto).toContain(montoALetras(p.cuotas[cuotas - 1].monto));
    }
  });
});

describe("techoDelPlan — el monto que el plan divide", () => {
  it("un máximo acordado en pesos pisa al valor por defecto", () => {
    expect(techoDelPlan({ max_acordado_ars: 257102.5, plan_cap_legal_ars: null })).toEqual({
      total: 257102.5,
      origen: "acordado",
    });
    // No debería existir con plan (la base lo prohíbe), pero si llega, gana el acordado.
    expect(techoDelPlan({ max_acordado_ars: 257102.5, plan_cap_legal_ars: 488137.44 })?.origen).toBe(
      "acordado",
    );
  });

  it("sin acordado, el plan divide el máximo legal congelado al armarlo, y lo dice", () => {
    expect(techoDelPlan({ max_acordado_ars: null, plan_cap_legal_ars: 488137.44 })).toEqual({
      total: 488137.44,
      origen: "legal",
    });
  });

  it("sin ninguno de los dos no hay techo para un plan", () => {
    expect(techoDelPlan({ max_acordado_ars: null, plan_cap_legal_ars: null })).toBeNull();
  });
});

describe("capLegalParaPlan — el valor por defecto que se congela", () => {
  it("es el techo legal de techoHonorario, en pesos al centavo", () => {
    // 7 JUS x 1,31 = 9,17 JUS; a $53.232 son $488.137,44.
    expect(capLegalParaPlan(7, 53232)).toBe(488137.44);
    expect(capLegalParaPlan(3.5, 53232)).toBe(
      techoHonorario({ baseJus: 3.5, maxAcordadoArs: null, pagadoJus: 0, pagadoArs: 0, jusValue: 53232 })
        .capArs,
    );
  });

  it("sin valor JUS o sin base no hay nada que congelar", () => {
    expect(capLegalParaPlan(7, 0)).toBeNull();
    expect(capLegalParaPlan(0, 53232)).toBeNull();
  });
});

describe("planDeFila — una fila de honorarios_with_balance", () => {
  const sinPlan = {
    max_acordado_ars: null,
    plan_cap_legal_ars: null,
    plan_anticipo_ars: null,
    plan_cuotas: null,
    plan_fecha_primera: null,
  };

  it("una fila sin plan no tiene plan", () => {
    expect(planDeFila(sinPlan)).toBeNull();
    expect(planDeFila({ ...sinPlan, max_acordado_ars: 300000 })).toBeNull();
  });

  it("sobre el máximo legal congelado", () => {
    const p = planDeFila({
      ...sinPlan,
      plan_cap_legal_ars: 488137.44,
      plan_cuotas: 2,
      plan_fecha_primera: "2025-09-27",
    });
    expect(p?.cuotas.map((c) => c.monto)).toEqual([244068.72, 244068.72]);
  });

  it("sobre un máximo acordado", () => {
    const p = planDeFila({
      ...sinPlan,
      max_acordado_ars: 300000,
      plan_anticipo_ars: 120000,
      plan_cuotas: 3,
      plan_fecha_primera: "2025-09-27",
    });
    expect(p?.anticipo).toBe(120000);
    expect(p?.cuotas.map((c) => c.monto)).toEqual([60000, 60000, 60000]);
  });

  // Revisión 2026-09-24. planDeFila lee datos GUARDADOS, y sus llamadores son
  // Server Components: una fila inconsistente tiene que ser "sin plan" y no un
  // RangeError, que ahí es un 500. Esta fila pasaba los siete CHECK de
  // 20260923120000 (999,95 < 1000) y dejaba 5 centavos para 12 cuotas; el CHECK
  // honorarios_plan_saldo_por_cuota (20260924120000) ya no la deja entrar, y
  // esto es la red del lado del código.
  it("una fila que no alcanza el centavo por cuota es sin plan, no una excepción", () => {
    const fila = {
      ...sinPlan,
      max_acordado_ars: 1000,
      plan_anticipo_ars: 999.95,
      plan_cuotas: 12,
      plan_fecha_primera: "2025-09-27",
    };
    expect(() => planDeFila(fila)).not.toThrow();
    expect(planDeFila(fila)).toBeNull();

    // Y el camino del formulario sí avisa, que es donde el mensaje sirve.
    expect(
      validarPlanHonorarios({
        total: 1000,
        anticipoArs: 999.95,
        cuotas: 12,
        fechaPrimera: "2025-09-27",
      }),
    ).not.toBeNull();
  });
});

describe("la base y el dominio dicen lo mismo", () => {
  it("PLAN_CUOTAS_OPTIONS es de 1 a 12, sin huecos", () => {
    expect(PLAN_CUOTAS_MIN).toBe(1);
    expect(PLAN_CUOTAS_MAX).toBe(12);
    expect([...PLAN_CUOTAS_OPTIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("el CHECK de plan_cuotas en la migración tiene el mismo rango", () => {
    const dir = join(process.cwd(), "supabase", "migrations");
    const archivo = readdirSync(dir).find((f) => f.endsWith("_honorarios_plan_de_pago.sql"));
    expect(archivo, "falta la migración del plan de pago").toBeDefined();
    const sql = readFileSync(join(dir, archivo!), "utf8");
    expect(sql).toContain(
      `plan_cuotas IS NULL OR plan_cuotas BETWEEN ${PLAN_CUOTAS_MIN} AND ${PLAN_CUOTAS_MAX}`,
    );
  });
});
