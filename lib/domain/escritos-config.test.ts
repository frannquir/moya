import { describe, it, expect } from "vitest";
import {
  ABOGADO_DEFAULT,
  CUENTA_HONORARIOS,
  CUENTA_HONORARIOS_DEFAULT,
  cuentaHonorariosPartes,
  formatCuentaHonorarios,
  resolveCuentaHonorarios,
  articuloDe,
  formatAutorizados,
  resolveAutorizados,
  parseAutorizados,
  AUTORIZADOS_DERIVADO,
  mergeEscritosConfig,
  ESCRITOS_CONFIG_KEYS,
  resolveDomicilioProcesal,
  buildEncabezado,
  resolveJuezRecusado,
  tratamientoDe,
  type EstudioEscritosConfig,
} from "./escritos-config";

const config: EstudioEscritosConfig = {
  domicilios_procesales: {
    "Depto Uno": "domicilio uno",
    "Dépto Dós": "domicilio dos",
  },
};

describe("resolveDomicilioProcesal", () => {
  it("resolves an exact key", () => {
    expect(resolveDomicilioProcesal(config, "Depto Uno")).toBe("domicilio uno");
  });

  it("matches case-insensitively", () => {
    expect(resolveDomicilioProcesal(config, "depto uno")).toBe("domicilio uno");
  });

  it("matches when accents drift in either direction", () => {
    expect(resolveDomicilioProcesal(config, "Depto Dos")).toBe("domicilio dos");
    expect(
      resolveDomicilioProcesal({ domicilios_procesales: { "Depto Dos": "x" } }, "Dépto Dós"),
    ).toBe("x");
  });

  it("tolerates surrounding whitespace", () => {
    expect(resolveDomicilioProcesal(config, "  Depto Uno  ")).toBe("domicilio uno");
  });

  it("returns empty for missing departamento, config, or unconfigured key", () => {
    expect(resolveDomicilioProcesal(config, null)).toBe("");
    expect(resolveDomicilioProcesal(config, "")).toBe("");
    expect(resolveDomicilioProcesal(null, "Depto Uno")).toBe("");
    expect(resolveDomicilioProcesal(config, "Depto Tres")).toBe("");
  });

  it("ignores an empty configured value", () => {
    expect(
      resolveDomicilioProcesal({ domicilios_procesales: { "Depto Uno": "" } }, "Depto Uno"),
    ).toBe("");
  });
});

// Week 2C: section IX lists the estudio's own members rather than a free-text
// config field. The treatment splits on TWO axes (Fran, 2026-08-22), because the
// source demanda uses both: "la Dra. María Victoria Iñurrieta" is a female
// lawyer, "Sr. Lautaro Moyano" is a man who is not one.
describe("tratamientoDe", () => {
  it("covers all four cases", () => {
    expect(tratamientoDe("F", true)).toBe("Dra.");
    expect(tratamientoDe("M", true)).toBe("Dr.");
    expect(tratamientoDe("F", false)).toBe("Sra.");
    expect(tratamientoDe("M", false)).toBe("Sr.");
  });

  it("defaults to non-lawyer, the conservative error", () => {
    // Calling a lawyer "Sr." is a discourtesy; calling a non-lawyer "Dr."
    // misstates a professional qualification in a court filing.
    expect(tratamientoDe("F")).toBe("Sra.");
    expect(tratamientoDe("M")).toBe("Sr.");
    expect(tratamientoDe("M", null)).toBe("Sr.");
  });

  it("returns nothing for an unknown genero rather than guessing", () => {
    for (const g of [null, undefined, "", "X", "f", "m"]) {
      expect(tratamientoDe(g, true)).toBe("");
      expect(tratamientoDe(g, false)).toBe("");
    }
  });
});

describe("articuloDe", () => {
  it("agrees with genero", () => {
    expect(articuloDe("F")).toBe("la");
    expect(articuloDe("M")).toBe("el");
  });

  it("returns nothing when genero is unknown, so the name stands bare", () => {
    for (const g of [null, undefined, "", "X"]) expect(articuloDe(g)).toBe("");
  });
});

describe("formatAutorizados", () => {
  // Section IX is running text: "…con las presentes actuaciones la Dra. María
  // Victoria Iñurrieta…". Without the article the sentence is ungrammatical.
  // The source writes "la Dra." but then a bare "Sr. Lautaro Moyano"; the article
  // is applied uniformly here rather than carrying that inconsistency forward.
  it("reproduces the source demanda's list, with the article on every name", () => {
    expect(
      formatAutorizados([
        { nombre: "María Victoria Iñurrieta", genero: "F", es_abogado: true },
        { nombre: "Lautaro Moyano", genero: "M", es_abogado: false },
        { nombre: "Matias Prusso", genero: "M", es_abogado: false },
      ]),
    ).toBe(
      "la Dra. María Victoria Iñurrieta y/o el Sr. Lautaro Moyano y/o el Sr. Matias Prusso",
    );
  });

  it("reads as a sentence when dropped into the template text", () => {
    const lista = formatAutorizados([
      { nombre: "María Victoria Iñurrieta", genero: "F", es_abogado: true },
    ]);
    expect(
      `Quedan autorizados a realizar cualquier trámite relacionado con las presentes actuaciones ${lista} y/o quienes ellos designen.-`,
    ).toBe(
      "Quedan autorizados a realizar cualquier trámite relacionado con las presentes " +
        "actuaciones la Dra. María Victoria Iñurrieta y/o quienes ellos designen.-",
    );
  });

  it("gets a male lawyer right, which a gender-only rule could not", () => {
    expect(formatAutorizados([{ nombre: "Juan Pérez", genero: "M", es_abogado: true }])).toBe(
      "el Dr. Juan Pérez",
    );
  });

  it("prints a bare name when genero is unknown", () => {
    expect(formatAutorizados([{ nombre: "Sin Genero" }])).toBe("Sin Genero");
    expect(formatAutorizados([{ nombre: "Sin Genero", genero: null }])).toBe("Sin Genero");
  });

  it("skips a member with no nombre, leaving no dangling y/o", () => {
    expect(
      formatAutorizados([
        { nombre: "Uno", genero: "M", es_abogado: true },
        { nombre: "", genero: "F" },
        { nombre: "   " },
        { nombre: null },
        { nombre: "Dos", genero: "F", es_abogado: true },
      ]),
    ).toBe("el Dr. Uno y/o la Dra. Dos");
  });

  it("returns empty when nobody has a nombre, so the caller can show the marker", () => {
    expect(formatAutorizados([])).toBe("");
    expect(formatAutorizados([{ nombre: "" }, { nombre: null }])).toBe("");
  });

  it("handles a single member without a separator", () => {
    expect(formatAutorizados([{ nombre: "Solo", genero: "F", es_abogado: true }])).toBe(
      "la Dra. Solo",
    );
  });

  it("trims stored whitespace", () => {
    expect(formatAutorizados([{ nombre: "  Espaciado  ", genero: "M" }])).toBe(
      "el Sr. Espaciado",
    );
  });

  it("preserves the order it is given — head first, from the RPC", () => {
    expect(
      formatAutorizados([{ nombre: "Head" }, { nombre: "Member" }]),
    ).toBe("Head y/o Member");
  });
});

describe("buildEncabezado — the encargado half", () => {
  const empresa = {
    razonSocial: "TARTAN S.A.",
    domicilioLegal: "Av. Independencia 1502",
    cuit: "30-70918460-8",
    cuentaBancaria: "",
  };
  const base = {
    empresa,
    domicilioProcesal: "calle falsa 123",
    demandado: "Juan Pérez",
    expediente: "MP-1234-2026",
  };

  it("emits a [TOKEN] for every unconfigured field, never a placeholder value", () => {
    const out = buildEncabezado({ ...base, abogado: {} });

    // The whole point: extractUnresolved sees these, escrito-editor badges them,
    // and each badge links to /estudio. ABOGADO_DEFAULT would have printed a
    // plausible-looking "00-00000000-0" that nothing could detect.
    expect(out).toContain("[ABOGADO_NOMBRE]");
    expect(out).toContain("[ABOGADO_MATRICULA]");
    expect(out).toContain("[ABOGADO_LEGAJO]");
    expect(out).toContain("[ABOGADO_CUIT]");
    expect(out).toContain("[ABOGADO_IBM]");
    expect(out).toContain("[ABOGADO_DOMICILIO_ELECTRONICO]");
    expect(out).toContain("[ABOGADO_TELEFONO]");

    expect(out).not.toContain(ABOGADO_DEFAULT.nombre);
    expect(out).not.toContain(ABOGADO_DEFAULT.cuit);
    expect(out).not.toContain(ABOGADO_DEFAULT.legajo);
  });

  it("keeps IVA Responsable Inscripto, which is a real value and not a placeholder", () => {
    const out = buildEncabezado({ ...base, abogado: {} });
    expect(out).toContain("IVA Responsable Inscripto");
    expect(out).not.toContain("[ABOGADO_IVA");
  });

  it("marks only the blanks, so a half-filled encargado keeps what it has", () => {
    const out = buildEncabezado({
      ...base,
      abogado: { nombre: "RUBEN ADRIAN GALANTE", cuit: "20-22341849-0" },
    });
    expect(out).toContain("RUBEN ADRIAN GALANTE");
    expect(out).toContain("CUIT Nº 20-22341849-0");
    expect(out).toContain("[ABOGADO_LEGAJO]");
    expect(out).not.toContain("[ABOGADO_NOMBRE]");
  });

  it("treats whitespace as unconfigured", () => {
    const out = buildEncabezado({ ...base, abogado: { nombre: "   " } });
    expect(out).toContain("[ABOGADO_NOMBRE]");
  });

  it("still marks the empresa half the same way it always did", () => {
    const out = buildEncabezado({
      ...base,
      empresa: null,
      domicilioProcesal: "",
      abogado: {},
    });
    expect(out).toContain("[EMPRESA]");
    expect(out).toContain("[DOMICILIO_LEGAL_EMPRESA]");
    expect(out).toContain("[DOMICILIO_PROCESAL]");
  });
});

describe("formatCuentaHonorarios", () => {
  const cuenta = {
    tipo: "Caja de ahorro",
    banco: "Nación",
    numero: "123-4",
    cbu: "0000000000000000000001",
    alias: "MI.ALIAS",
    dni: "12345678",
    titular: "Juana Pérez",
  };

  it("reads as a noun phrase, the way both templates use it", () => {
    // "...transferir el saldo a la {{CUENTA_HONORARIOS}}" and "en la siguiente
    // cuenta: {{CUENTA_HONORARIOS}}".
    expect(formatCuentaHonorarios(cuenta)).toBe(
      "Caja de ahorro del Banco Nación, Cuenta Nro: 123-4, " +
        "CBU: 0000000000000000000001, DNI: 12345678, " +
        "Alias de CBU: MI.ALIAS, de titularidad de Juana Pérez",
    );
  });

  it("drops the whole clause for a part that is empty", () => {
    expect(formatCuentaHonorarios({ ...cuenta, cbu: "", dni: "" })).toBe(
      "Caja de ahorro del Banco Nación, Cuenta Nro: 123-4, " +
        "Alias de CBU: MI.ALIAS, de titularidad de Juana Pérez",
    );
  });

  it("returns an empty string when nothing is filled", () => {
    expect(formatCuentaHonorarios({})).toBe("");
    expect(formatCuentaHonorarios(undefined)).toBe("");
  });

  it("still composes the placeholder constant", () => {
    // CUENTA_HONORARIOS is built from the parts, so the two cannot drift.
    expect(CUENTA_HONORARIOS).toBe(formatCuentaHonorarios(CUENTA_HONORARIOS_DEFAULT));
    expect(CUENTA_HONORARIOS).toContain("Alias de CBU: ALIAS.CBU");
  });
});

describe("resolveCuentaHonorarios", () => {
  it("composes the parts", () => {
    expect(
      resolveCuentaHonorarios({
        cuenta_honorarios: { tipo: "Caja de ahorro", banco: "Nación", numero: "", cbu: "", alias: "", dni: "", titular: "" },
      }),
    ).toBe("Caja de ahorro del Banco Nación");
  });

  it("renders a value saved before the split", () => {
    expect(resolveCuentaHonorarios({ cuenta_honorarios: "cuenta vieja en una línea" })).toBe(
      "cuenta vieja en una línea",
    );
  });

  it("falls back to texto while every part is empty", () => {
    expect(
      resolveCuentaHonorarios({
        cuenta_honorarios: { tipo: "", banco: "", numero: "", cbu: "", alias: "", dni: "", titular: "", texto: "lo de antes" },
      }),
    ).toBe("lo de antes");
  });

  it("shows the placeholder when there is nothing at all", () => {
    expect(resolveCuentaHonorarios({})).toBe(CUENTA_HONORARIOS);
    expect(resolveCuentaHonorarios({ cuenta_honorarios: "" })).toBe(CUENTA_HONORARIOS);
  });
});

describe("cuentaHonorariosPartes", () => {
  it("keeps a pre-split string as texto so the form does not lose it", () => {
    expect(cuentaHonorariosPartes({ cuenta_honorarios: "una línea" })).toMatchObject({
      tipo: "",
      texto: "una línea",
    });
  });

  it("fills every part, so no input goes uncontrolled", () => {
    const p = cuentaHonorariosPartes({});
    expect(Object.values(p).every((v) => v === "")).toBe(true);
  });
});

describe("resolveJuezRecusado", () => {
  const config = {
    jueces_recusados: {
      "aaaaaaaa-0000-0000-0000-000000000001": "Dra. Marta Lopez",
      "aaaaaaaa-0000-0000-0000-000000000002": "   ",
    },
  };

  it("returns the configured name for a listed court", () => {
    expect(
      resolveJuezRecusado(config, "aaaaaaaa-0000-0000-0000-000000000001"),
    ).toBe("Dra. Marta Lopez");
  });

  it("returns empty for a court that is not listed", () => {
    // Not a missing value: an unlisted court means the demanda simply omits the
    // section, so this must never become a [TOKEN] or a warning.
    expect(resolveJuezRecusado(config, "aaaaaaaa-0000-0000-0000-00000000ffff")).toBe("");
  });

  it("returns empty for a case with no court at all", () => {
    expect(resolveJuezRecusado(config, null)).toBe("");
    expect(resolveJuezRecusado(config, undefined)).toBe("");
    expect(resolveJuezRecusado(config, "")).toBe("");
  });

  it("treats a whitespace-only name as not recused", () => {
    expect(
      resolveJuezRecusado(config, "aaaaaaaa-0000-0000-0000-000000000002"),
    ).toBe("");
  });

  it("survives a config that predates the feature", () => {
    expect(resolveJuezRecusado({}, "any")).toBe("");
    expect(resolveJuezRecusado(null, "any")).toBe("");
    expect(resolveJuezRecusado(undefined, "any")).toBe("");
  });

  it("never falls back to the court's sitting judge", () => {
    // The whole reason the map exists: juzgados.juez is populated for essentially
    // every court, so a fallback would recuse someone on every demanda.
    expect(resolveJuezRecusado({ jueces_recusados: {} }, "cualquiera")).toBe("");
  });
});

describe("resolveAutorizados", () => {
  const miembros = [
    { nombre: "Lautaro Moyano", genero: "M", es_abogado: false },
    { nombre: "Matias Prusso", genero: "M", es_abogado: true },
  ];

  it("derives from the members when the estudio has no list of its own", () => {
    const esperado = "el Sr. Lautaro Moyano y/o el Dr. Matias Prusso";
    expect(resolveAutorizados({}, miembros)).toBe(esperado);
    expect(resolveAutorizados(null, miembros)).toBe(esperado);
    expect(resolveAutorizados(undefined, miembros)).toBe(esperado);
  });

  it("uses the estudio's own list instead, members and all", () => {
    // The point of the feature: a procurador with no Moya account gets named,
    // and a member can be left off, without touching who belongs to the estudio.
    expect(
      resolveAutorizados(
        {
          autorizados: [
            { nombre: "Lautaro Moyano", genero: "M", es_abogado: true },
            { nombre: "Ana Procuradora", genero: "F", es_abogado: false },
          ],
        },
        miembros,
      ),
    ).toBe("el Dr. Lautaro Moyano y/o la Sra. Ana Procuradora");
  });

  it("prints the configured order, which is why it is an array", () => {
    const rows = [
      { nombre: "Segundo", genero: "M" as const, es_abogado: false },
      { nombre: "Primero", genero: "F" as const, es_abogado: true },
    ];
    expect(resolveAutorizados({ autorizados: rows }, miembros)).toBe(
      "el Sr. Segundo y/o la Dra. Primero",
    );
  });

  it("treats an empty list as empty, NOT as 'no list of its own'", () => {
    // A head who removed everyone gets the [AUTORIZADOS] marker, which he can
    // see. Falling back to the members here would silently put the people he
    // just took off the filing back into it.
    expect(resolveAutorizados({ autorizados: [] }, miembros)).toBe("");
  });

  it("falls back to the members when the stored value is not a list", () => {
    const roto = { autorizados: "Lautaro" } as unknown as EstudioEscritosConfig;
    expect(resolveAutorizados(roto, miembros)).toBe(
      "el Sr. Lautaro Moyano y/o el Dr. Matias Prusso",
    );
  });

  it("goes through the same formatter as the members list", () => {
    // Two formatters would let section IX drift from what /estudio shows.
    const rows = [{ nombre: "Una", genero: "F" as const, es_abogado: true }];
    expect(resolveAutorizados({ autorizados: rows }, [])).toBe(formatAutorizados(rows));
  });
});

describe("parseAutorizados", () => {
  it("returns undefined for the sentinel, meaning 'go back to the members'", () => {
    expect(parseAutorizados(AUTORIZADOS_DERIVADO)).toEqual({
      autorizados: undefined,
      errors: [],
    });
  });

  it("treats an absent value as the sentinel", () => {
    expect(parseAutorizados("").autorizados).toBeUndefined();
    expect(parseAutorizados("   ").autorizados).toBeUndefined();
    expect(parseAutorizados("").errors).toEqual([]);
  });

  it("parses a list, trimming and normalising every field", () => {
    const { autorizados, errors } = parseAutorizados(
      JSON.stringify([
        { nombre: "  Ana  ", genero: "F", es_abogado: true },
        { nombre: "Beto", genero: "X", es_abogado: "si" },
      ]),
    );
    expect(errors).toEqual([]);
    expect(autorizados).toEqual([
      { nombre: "Ana", genero: "F", es_abogado: true },
      // An unrecognised genero is null, not a guess; es_abogado is boolean-only,
      // so a truthy string does not promote somebody to abogado in a filing.
      { nombre: "Beto", genero: null, es_abogado: false },
    ]);
  });

  it("keeps an empty list empty — it is a real choice", () => {
    expect(parseAutorizados("[]")).toEqual({ autorizados: [], errors: [] });
  });

  it("drops a row the head added and never filled in", () => {
    const { autorizados, errors } = parseAutorizados(
      JSON.stringify([
        { nombre: "Ana", genero: "F", es_abogado: true },
        { nombre: "", genero: null, es_abogado: false },
      ]),
    );
    expect(errors).toEqual([]);
    expect(autorizados).toEqual([{ nombre: "Ana", genero: "F", es_abogado: true }]);
  });

  it("rejects a row that has data but no nombre", () => {
    // Same lesson as the empresa with no clave: the row used to be dropped and
    // the save still reported success.
    const { errors } = parseAutorizados(
      JSON.stringify([{ nombre: "  ", genero: "F", es_abogado: true }]),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Falta el nombre");
  });

  it("rejects the same person twice, ignoring case and accents", () => {
    const { errors } = parseAutorizados(
      JSON.stringify([
        { nombre: "Maria Inurrieta", genero: "F", es_abogado: true },
        { nombre: "MARIA INURRIETA", genero: "F", es_abogado: true },
      ]),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("dos veces");
  });

  it("reports malformed JSON instead of silently clearing the list", () => {
    // The dangerous failure: returning undefined with no error would read as
    // "no list of its own" and delete a list the head still has on screen.
    const { autorizados, errors } = parseAutorizados("{no json");
    expect(autorizados).toBeUndefined();
    expect(errors).toHaveLength(1);
  });

  it("reports a value that is not a list", () => {
    expect(parseAutorizados(JSON.stringify({ nombre: "Ana" })).errors).toHaveLength(1);
    expect(parseAutorizados(JSON.stringify("Ana")).errors).toHaveLength(1);
  });
});

describe("mergeEscritosConfig", () => {
  const previa: EstudioEscritosConfig = {
    encargado: { nombre: "Encargado" },
    jueces_recusados: { "juzgado-1": "Dra. Jueza" },
    autorizados: [{ nombre: "Ana", genero: "F", es_abogado: true }],
  };

  it("leaves a key the form did not post exactly as it was", () => {
    // THE regression this function exists for. The action used to rebuild the
    // whole column from a hand-written spread, so a key it did not name was
    // deleted on every save of any other field.
    const out = mergeEscritosConfig(previa, { encargado: { nombre: "Otro" } });
    expect(out.encargado).toEqual({ nombre: "Otro" });
    expect(out.jueces_recusados).toEqual({ "juzgado-1": "Dra. Jueza" });
    expect(out.autorizados).toEqual([{ nombre: "Ana", genero: "F", es_abogado: true }]);
  });

  it("removes a key posted as undefined, which is how the override is cleared", () => {
    const out = mergeEscritosConfig(previa, { autorizados: undefined });
    expect("autorizados" in out).toBe(false);
    expect(out.encargado).toEqual({ nombre: "Encargado" });
  });

  it("does not confuse 'use the members' with 'the list is empty'", () => {
    expect(mergeEscritosConfig(previa, { autorizados: [] }).autorizados).toEqual([]);
    expect("autorizados" in mergeEscritosConfig(previa, { autorizados: undefined })).toBe(
      false,
    );
  });

  it("carries through a key this version of the app does not know about", () => {
    const conExtra = { ...previa, clave_futura: 1 } as unknown as EstudioEscritosConfig;
    const out = mergeEscritosConfig(conExtra, { empresas: {} }) as Record<string, unknown>;
    expect(out.clave_futura).toBe(1);
  });

  it("handles an estudio that has never been configured", () => {
    expect(mergeEscritosConfig(null, { empresas: {} })).toEqual({ empresas: {} });
    expect(mergeEscritosConfig(undefined, {})).toEqual({});
    expect(mergeEscritosConfig({}, {})).toEqual({});
  });

  it("knows every key of the config, so none can be silently skipped", () => {
    // CLAVES_DE_CONFIG is typed Record<keyof Required<EstudioEscritosConfig>,…>,
    // so the compiler already refuses a key that is missing from it. This pins
    // the list the merge actually iterates, which is what decides whether a key
    // is writable at all.
    expect([...ESCRITOS_CONFIG_KEYS].sort()).toEqual([
      "autorizados",
      "cuenta_honorarios",
      "domicilios_procesales",
      "empresas",
      "encargado",
      "jueces_recusados",
    ]);
  });
});
