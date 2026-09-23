import { describe, it, expect } from "vitest";
import {
  BORRADORES_DEFAULT,
  borradoresFiltroDe,
  escaparTerminoIlike,
  estadoDe,
  estadoFiltroDe,
  orBusquedaEjecutado,
  OR_COBRABLE,
  OR_SALDADO,
  quedaPorCobrar,
  type FilaHonorario,
} from "./honorarios-lista";
import { grossCapJus, roundCentavos, roundJus, saldoHonorario } from "./honorarios";

const JUS = 53232;

/**
 * A `honorarios_with_balance` row built exactly as the view builds it, so the
 * predicate under test reads the same numbers Postgres would hand it.
 * GREATEST(..., 0) included: the view floors both pendientes at zero.
 */
function fila({
  montoJus = 7,
  pagadoJus = 0,
  pagadoArs = 0,
  acordadoArs = null as number | null,
}): FilaHonorario & { pagado_jus: number; pagado_ars: number } {
  const capGrossJus =
    acordadoArs != null ? roundJus(acordadoArs / JUS) : grossCapJus(montoJus);
  const capCobrableArs =
    acordadoArs != null ? acordadoArs : Math.round(grossCapJus(montoJus) * JUS);
  return {
    monto_total_jus: montoJus,
    pendiente_jus: roundJus(montoJus - pagadoJus),
    max_acordado_ars: acordadoArs,
    pendiente_gross_jus: Math.max(0, roundJus(capGrossJus - pagadoJus)),
    pendiente_cobrable_ars: Math.max(0, roundCentavos(capCobrableArs - pagadoArs)),
    pagado_jus: pagadoJus,
    pagado_ars: pagadoArs,
  };
}

describe("quedaPorCobrar — the list agrees with saldoHonorario, row by row", () => {
  // The matrix that matters: both kinds of ceiling, nothing paid, part paid,
  // the fee covered but not its tax, and settled in full.
  const casos: { nombre: string; fila: ReturnType<typeof fila> }[] = [
    { nombre: "arancel, sin pagos", fila: fila({}) },
    { nombre: "arancel, un pago parcial", fila: fila({ pagadoJus: 2, pagadoArs: 2 * JUS }) },
    {
      nombre: "arancel, base cubierta y falta el impuesto",
      fila: fila({ pagadoJus: 7, pagadoArs: 7 * JUS }),
    },
    {
      nombre: "arancel, saldado hasta el techo",
      fila: fila({ pagadoJus: grossCapJus(7), pagadoArs: grossCapJus(7) * JUS }),
    },
    {
      nombre: "acordado, sin pagos",
      fila: fila({ acordadoArs: 300000 }),
    },
    {
      nombre: "acordado, pago parcial",
      fila: fila({ acordadoArs: 300000, pagadoArs: 100000, pagadoJus: 1.88 }),
    },
    {
      nombre: "acordado, saldado exacto",
      fila: fila({ acordadoArs: 300000, pagadoArs: 300000, pagadoJus: 5.64 }),
    },
    {
      // The case gotcha #49 is about: settled in full at a lower JUS, and the
      // JUS has moved since. The view's peso column would say "still owing".
      nombre: "acordado saldado, con el JUS movido después",
      fila: fila({ acordadoArs: 458500, pagadoArs: 458500, pagadoJus: 9.17 }),
    },
  ];

  for (const { nombre, fila: f } of casos) {
    it(nombre, () => {
      const saldo = saldoHonorario(
        {
          monto_total_jus: f.monto_total_jus,
          max_acordado_ars: f.max_acordado_ars,
          pagado_jus: f.pagado_jus,
          pagado_ars: f.pagado_ars,
        },
        JUS,
      );
      expect(quedaPorCobrar(f)).toBe(saldo.pendienteArs > 0);
    });
  }

  it("a null column reads as zero, never as NaN (every view column is nullable)", () => {
    expect(
      quedaPorCobrar({
        monto_total_jus: null,
        pendiente_jus: null,
        max_acordado_ars: null,
        pendiente_gross_jus: null,
        pendiente_cobrable_ars: null,
      }),
    ).toBe(false);
  });
});

describe("estadoDe — the badge's three states", () => {
  it("nothing collected yet is pendiente", () => {
    expect(estadoDe(fila({}))).toBe("pendiente");
  });
  it("the fee covered but not its tax is cubierto", () => {
    expect(estadoDe(fila({ pagadoJus: 7, pagadoArs: 7 * JUS }))).toBe("cubierto");
  });
  it("collected up to the ceiling is pagado", () => {
    const f = fila({ pagadoJus: grossCapJus(7), pagadoArs: grossCapJus(7) * JUS });
    expect(estadoDe(f)).toBe("pagado");
  });
  it("a settled ceiling reached below the base is pagado, not pendiente", () => {
    // 300.000 agreed on a 7 JUS fee: the base is not covered in JUS terms and
    // the honorario is still finished. The ceiling decides, not the base.
    const f = fila({ acordadoArs: 300000, pagadoArs: 300000, pagadoJus: 5.64 });
    expect(f.pendiente_jus).toBeGreaterThan(0);
    expect(estadoDe(f)).toBe("pagado");
  });
});

describe("the PostgREST filters mirror the same branch", () => {
  it("both name the same two columns, one per kind of ceiling", () => {
    for (const filtro of [OR_COBRABLE, OR_SALDADO]) {
      expect(filtro).toContain("max_acordado_ars.not.is.null,pendiente_cobrable_ars");
      expect(filtro).toContain("max_acordado_ars.is.null,pendiente_gross_jus");
      // The column that mixes units must never appear on the arancel branch.
      expect(filtro).not.toContain("max_acordado_ars.is.null,pendiente_cobrable_ars");
    }
  });
  it("one is the negation of the other", () => {
    expect(OR_COBRABLE.replace(/\.gt\./g, ".lte.")).toBe(OR_SALDADO);
  });
});

describe("the search term cannot break out of the filter", () => {
  it("quotes survive a name with a comma", () => {
    const or = orBusquedaEjecutado("VEGA, JORGE");
    expect(or).toBe(
      'nombre.ilike."%VEGA, JORGE%",numero_expediente.ilike."%VEGA, JORGE%",documento.ilike."%VEGA, JORGE%"',
    );
  });
  it("escapes the two characters that would corrupt the quoted value", () => {
    expect(escaparTerminoIlike('a"b')).toBe('a\\"b');
    expect(escaparTerminoIlike("a\\b")).toBe("a\\\\b");
  });
  it("leaves the LIKE wildcards alone — PostgREST unescapes them anyway", () => {
    expect(escaparTerminoIlike("100%")).toBe("100%");
    expect(escaparTerminoIlike("a_b")).toBe("a_b");
  });
  it("a parenthesis cannot end the or() list", () => {
    // Measured against the live API: this returns 0 rows, not a 400.
    expect(orBusquedaEjecutado("a(b)c")).toContain('nombre.ilike."%a(b)c%"');
  });
});

describe("URL params never 500 the page", () => {
  it("an unknown estado is Todos", () => {
    expect(estadoFiltroDe("pendiente")).toBe("pendiente");
    expect(estadoFiltroDe("cualquier-cosa")).toBe("");
    expect(estadoFiltroDe(null)).toBe("");
  });
  it("an unknown borradores value is the default", () => {
    expect(borradoresFiltroDe("solo")).toBe("solo");
    expect(borradoresFiltroDe("cualquier-cosa")).toBe(BORRADORES_DEFAULT);
    expect(borradoresFiltroDe(undefined)).toBe(BORRADORES_DEFAULT);
  });
  it("the default shows the borradores", () => {
    expect(BORRADORES_DEFAULT).toBe("todos");
  });
});
