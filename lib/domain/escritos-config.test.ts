import { describe, it, expect } from "vitest";
import { renderTemplate, extractUnresolved } from "./template-engine";
import {
  ABOGADO_DEFAULT,
  CUENTA_HONORARIOS_DEFAULT,
  cuentaHonorariosPartes,
  sinPuntuacionFinal,
  formatCuentaHonorarios,
  resolveCuentaHonorarios,
  articuloDe,
  formatAutorizados,
  resolveAutorizados,
  parseAutorizados,
  autorizadoVacio,
  AUTORIZADOS_DERIVADO,
  mergeEscritosConfig,
  aplicarConfigParcial,
  faltantesDeConfig,
  validarDomicilioElectronico,
  type ErrorDeConfig,
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
// source demanda uses both: "la Dra. María Laura Fernández" is a female
// lawyer, "Sr. Julián Ortega" is a man who is not one.
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
  // Laura Fernández…". Without the article the sentence is ungrammatical.
  // The source writes "la Dra." but then a bare "Sr. Julián Ortega"; the article
  // is applied uniformly here rather than carrying that inconsistency forward.
  it("reproduces the source demanda's list, with the article on every name", () => {
    expect(
      formatAutorizados([
        { nombre: "María Laura Fernández", genero: "F", es_abogado: true },
        { nombre: "Julián Ortega", genero: "M", es_abogado: false },
        { nombre: "Tomás Rivas", genero: "M", es_abogado: false },
      ]),
    ).toBe(
      "la Dra. María Laura Fernández y/o el Sr. Julián Ortega y/o el Sr. Tomás Rivas",
    );
  });

  it("reads as a sentence when dropped into the template text", () => {
    const lista = formatAutorizados([
      { nombre: "María Laura Fernández", genero: "F", es_abogado: true },
    ]);
    expect(
      `Quedan autorizados a realizar cualquier trámite relacionado con las presentes actuaciones ${lista} y/o quienes ellos designen.-`,
    ).toBe(
      "Quedan autorizados a realizar cualquier trámite relacionado con las presentes " +
        "actuaciones la Dra. María Laura Fernández y/o quienes ellos designen.-",
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
    cuit: "30-70123456-8",
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
      abogado: { nombre: "HECTOR DANIEL SUAREZ", cuit: "20-21456789-0" },
    });
    expect(out).toContain("HECTOR DANIEL SUAREZ");
    expect(out).toContain("CUIT Nº 20-21456789-0");
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
  };
  // Inventado, con dígito verificador válido: el repo es público.
  const apoderado = { nombre: "Juana Pérez", cuit: "27-30111222-5" };

  it("reads as a noun phrase, the way both templates use it", () => {
    // "...transferir el saldo a la {{CUENTA_HONORARIOS}}" and "en la siguiente
    // cuenta: {{CUENTA_HONORARIOS}}".
    expect(formatCuentaHonorarios(cuenta, apoderado)).toBe(
      "Caja de ahorro del Banco Nación, Cuenta Nro: 123-4, " +
        "CBU: 0000000000000000000001, CUIT: 27-30111222-5, " +
        "Alias de CBU: MI.ALIAS, de titularidad de Juana Pérez",
    );
  });

  it("imprime el CUIT del encargado y nunca un DNI", () => {
    // Fran, 2026-09-17. El DNI era un campo propio del formulario, así que podía
    // no ser el del apoderado que firma.
    const salida = formatCuentaHonorarios(cuenta, apoderado);
    expect(salida).toContain("CUIT: 27-30111222-5");
    expect(salida).not.toContain("DNI:");
  });

  it("drops the whole clause for a part that is empty", () => {
    expect(formatCuentaHonorarios({ ...cuenta, cbu: "" }, apoderado)).toBe(
      "Caja de ahorro del Banco Nación, Cuenta Nro: 123-4, " +
        "CUIT: 27-30111222-5, Alias de CBU: MI.ALIAS, de titularidad de Juana Pérez",
    );
  });

  it("marca el CUIT y el titular que faltan, en vez de callarlos", () => {
    // La excepción a la regla de arriba: una cuenta cargada cuyo titular no se
    // sabe tiene que decirlo, y la Parte 4 lo lista antes de generar.
    const salida = formatCuentaHonorarios(cuenta, {});
    expect(salida).toContain("CUIT: [ABOGADO_CUIT]");
    expect(salida).toContain("de titularidad de [ABOGADO_NOMBRE]");
  });

  it("marca también un CUIT que no pasa el dígito verificador", () => {
    const salida = formatCuentaHonorarios(cuenta, { cuit: "20-00000000-0" });
    expect(salida).toContain("CUIT: [ABOGADO_CUIT]");
  });

  it("no repite la palabra Banco", () => {
    // Salió "del Banco Banco Galicia" en un convenio real: la plantilla pone
    // "del Banco " y el estudio guardó el nombre con la palabra adentro.
    //
    // Se compara en minúscula a propósito: lo que el estudio tipeó se imprime
    // tal cual, mayúsculas incluidas. Lo que cede es el prefijo, no su texto.
    for (const banco of ["Banco Galicia", "banco galicia", "BANCO GALICIA", "Galicia"]) {
      const salida = formatCuentaHonorarios({ banco }, apoderado).toLowerCase();
      expect(salida).toContain("del banco galicia");
      expect(salida).not.toContain("banco banco");
      // Una sola vez la palabra, siempre.
      expect(salida.split("banco").length - 1).toBe(1);
    }
  });

  it("no le come la palabra a un banco que empieza parecido", () => {
    expect(formatCuentaHonorarios({ banco: "Bancor" }, apoderado)).toContain(
      "del Banco Bancor",
    );
  });

  it("returns an empty string when nothing is filled", () => {
    // Y no una cuenta de ceros que parece real: eso es lo que se imprimía antes.
    expect(formatCuentaHonorarios({}, apoderado)).toBe("");
    expect(formatCuentaHonorarios(undefined, apoderado)).toBe("");
    expect(formatCuentaHonorarios(CUENTA_HONORARIOS_DEFAULT, apoderado)).not.toBe("");
  });
});

describe("sinPuntuacionFinal", () => {
  it("saca la coma final que duplicaba la de la plantilla", () => {
    // Un convenio real imprimió "…0006,, de titularidad de".
    expect(sinPuntuacionFinal("Cuenta 123, CBU 0000,")).toBe("Cuenta 123, CBU 0000");
    expect(sinPuntuacionFinal("Cuenta 123 ;  ")).toBe("Cuenta 123");
    expect(sinPuntuacionFinal("Cuenta 123,,, ")).toBe("Cuenta 123");
  });

  it("no toca un punto final, porque suele cerrar una abreviatura", () => {
    expect(sinPuntuacionFinal("Calle Falsa 123, Prov. de Bs. As.")).toBe(
      "Calle Falsa 123, Prov. de Bs. As.",
    );
  });

  it("deja la puntuación de adentro donde está", () => {
    expect(sinPuntuacionFinal(" Cuenta 1, Banco X, Suc. 5 ")).toBe(
      "Cuenta 1, Banco X, Suc. 5",
    );
  });

  it("aguanta vacío y nulo", () => {
    expect(sinPuntuacionFinal("")).toBe("");
    expect(sinPuntuacionFinal(null)).toBe("");
    expect(sinPuntuacionFinal(undefined)).toBe("");
    expect(sinPuntuacionFinal(",,,")).toBe("");
  });
});

describe("resolveCuentaHonorarios", () => {
  const encargado = { nombre: "Juana Pérez", cuit: "27-30111222-5" };

  it("composes the parts", () => {
    expect(
      resolveCuentaHonorarios({
        cuenta_honorarios: { tipo: "Caja de ahorro", banco: "Nación", numero: "", cbu: "", alias: "" },
        encargado,
      }),
    ).toBe(
      "Caja de ahorro del Banco Nación, CUIT: 27-30111222-5, de titularidad de Juana Pérez",
    );
  });

  it("renders a value saved before the split", () => {
    expect(resolveCuentaHonorarios({ cuenta_honorarios: "cuenta vieja en una línea" })).toBe(
      "cuenta vieja en una línea",
    );
  });

  it("falls back to texto while every part is empty", () => {
    expect(
      resolveCuentaHonorarios({
        cuenta_honorarios: { tipo: "", banco: "", numero: "", cbu: "", alias: "", texto: "lo de antes" },
      }),
    ).toBe("lo de antes");
  });

  it("devuelve vacío cuando no hay nada cargado, no una cuenta de ceros", () => {
    // Antes caía en CUENTA_HONORARIOS y un escrito salía con
    // "CBU: 0000000000000000000000 … de titularidad de NOMBRE Y APELLIDO", sin
    // ningún aviso. Ahora se imprime [CUENTA_HONORARIOS].
    expect(resolveCuentaHonorarios({})).toBe("");
    expect(resolveCuentaHonorarios({ cuenta_honorarios: "" })).toBe("");
    expect(resolveCuentaHonorarios(null)).toBe("");
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
    // Ni dni ni titular: los dos salen del Encargado desde 2026-09-17.
    expect(Object.keys(p).sort()).toEqual(["alias", "banco", "cbu", "numero", "tipo"]);
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
    { nombre: "Julián Ortega", genero: "M", es_abogado: false },
    { nombre: "Tomás Rivas", genero: "M", es_abogado: true },
  ];

  it("derives from the members when the estudio has no list of its own", () => {
    const esperado = "el Sr. Julián Ortega y/o el Dr. Tomás Rivas";
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
            { nombre: "Julián Ortega", genero: "M", es_abogado: true },
            { nombre: "Ana Procuradora", genero: "F", es_abogado: false },
          ],
        },
        miembros,
      ),
    ).toBe("el Dr. Julián Ortega y/o la Sra. Ana Procuradora");
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
    const roto = { autorizados: "Julián" } as unknown as EstudioEscritosConfig;
    expect(resolveAutorizados(roto, miembros)).toBe(
      "el Sr. Julián Ortega y/o el Dr. Tomás Rivas",
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
        { nombre: "Maria Fernandez", genero: "F", es_abogado: true },
        { nombre: "MARIA FERNANDEZ", genero: "F", es_abogado: true },
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

describe("autorizadoVacio", () => {
  // The editor words its warning with this, so it must agree with what
  // parseAutorizados actually does to the row.
  it("is true only for a row with nothing in it", () => {
    expect(autorizadoVacio({ nombre: "", genero: null, es_abogado: false })).toBe(true);
    expect(autorizadoVacio({ nombre: "   ", genero: "X", es_abogado: null })).toBe(true);
    expect(autorizadoVacio({ nombre: "", genero: "F", es_abogado: false })).toBe(false);
    expect(autorizadoVacio({ nombre: "", genero: null, es_abogado: true })).toBe(false);
    expect(autorizadoVacio({ nombre: "Ana", genero: null, es_abogado: false })).toBe(false);
  });

  it("matches the parser: a vacio row is dropped, any other nameless row is rejected", () => {
    const vacia = { nombre: "", genero: null, es_abogado: false };
    const sinNombre = { nombre: "", genero: "M", es_abogado: false };

    const soloVacia = parseAutorizados(JSON.stringify([vacia]));
    expect(autorizadoVacio(vacia)).toBe(true);
    expect(soloVacia).toEqual({ autorizados: [], errors: [] });

    const conDatos = parseAutorizados(JSON.stringify([sinNombre]));
    expect(autorizadoVacio(sinNombre)).toBe(false);
    expect(conDatos.errors).toHaveLength(1);
  });

  it("covers the seed of a member whose profile has no nombre", () => {
    // What "Restaurar por defecto" builds for a member with no lawyer_profiles
    // row. It saves by being dropped, so the editor must not say it blocks the
    // save.
    expect(autorizadoVacio({ nombre: null, genero: null, es_abogado: null })).toBe(true);
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

// The chain the recusación actually travels: a court on the estudio's list ->
// resolveJuezRecusado -> scope.HAY_RECUSACION -> the section renders and the
// numbering closes over it. Nothing asserted this end to end, which is why
// "the recusación never appears" took a full diagnosis to place (package A,
// 2026-09-17) — every link was fine and no test said so.
//
// The fixture is the demanda's real section sequence after 20260917120000
// removed the copias clause, condensed to its headings. The cautelar sits at
// VII because escrito-render splices its fragment in before the single render.
describe("la recusación, de la config al documento numerado", () => {
  // Las líneas en blanco son parte del fixture, no decoración: el defecto que
  // arregló 20260917130000 vivía exactamente ahí. Este fixture se armaba con
  // join("\n") y sin una sola línea vacía, así que no podía verlo.
  //
  // La forma es la del cuerpo guardado: la línea en blanco va ADENTRO del
  // bloque, antes de {{/if}}, nunca después. Se incluye también el rider de
  // codemandados de ANTECEDENTES, que tiene la misma forma y el mismo defecto.
  const CUERPO = [
    "{{SECCION}}.- PERSONERIA.-",
    "",
    "Que conforme lo acredito con la copia simple de poder general.-",
    "",
    "{{SECCION}}.- OBJETO.-",
    "",
    "Vengo a promover formal demanda de ejecución.-",
    "",
    "{{SECCION}}.- ANTECEDENTES.-",
    "",
    "La ejecutada suscribió el contrato{{#if HAY_CODEMANDADOS}} junto a un adicional{{/if}}.-",
    "",
    "{{#if HAY_CODEMANDADOS}}",
    "Resultan obligados en forma solidaria como codeudores.-",
    "",
    "{{/if}}",
    "La ejecutada comenzó a utilizar los servicios.-",
    "",
    "{{SECCION}}.- PREPARACION DE LA VIA EJECUTIVA.-",
    "",
    "Solicito se cite a la ejecutada a reconocer la firma.-",
    "",
    "{{SECCION}}.- PRUEBA.-",
    "",
    "Acompaño la documental que hace al derecho de mi mandante.-",
    "",
    "{{SECCION}}.- MANIFIESTA RESPECTO A LA DOCUMENTACION ACOMPAÑADA.-",
    "",
    "El contrato se encuentra legalmente instrumentado.-",
    "",
    "{{SECCION}}.- MEDIDA CAUTELAR:",
    "",
    "Solicito se decrete embargo.-",
    "",
    "{{SECCION}}.- SE EXIMA DE PRESTAR CAUCION.-",
    "",
    "Mi representada es una entidad de reconocida solvencia.-",
    "",
    "{{SECCION}}.- AUTORIZADOS.-",
    "",
    "Quedan autorizados a realizar cualquier trámite.-",
    "",
    "{{SECCION}}.- DERECHO.-",
    "",
    "Fundo el derecho en lo normado por los arts. 518 y concordantes.-",
    "",
    "{{#if HAY_RECUSACION}}",
    "{{SECCION}}.- RECUSA SIN EXPRESIÓN DE CAUSA.-",
    "",
    "vengo a recusar sin expresión de causa a {{JUEZ_RECUSADO}}.-",
    "",
    "{{/if}}",
    "{{SECCION}}.- PETICIÓN.-",
    "",
    "Por todo lo expuesto, de V.S. solicito.-",
  ].join("\n");

  const JUZGADO_RECUSADO = "aaaaaaaa-0000-0000-0000-000000000001";
  const config: EstudioEscritosConfig = {
    jueces_recusados: { [JUZGADO_RECUSADO]: "Dra. Marta Lopez" },
  };

  /** What buildEscritoScope does at lib/data/escrito-render.ts, in one line. */
  function render(juzgadoId: string | null, hayCodemandados = false) {
    const juez = resolveJuezRecusado(config, juzgadoId);
    return renderTemplate(CUERPO, {
      HAY_RECUSACION: juez !== "",
      HAY_CODEMANDADOS: hayCodemandados,
      ...(juez !== "" ? { JUEZ_RECUSADO: juez } : {}),
    });
  }

  it("imprime el apartado, con el nombre cargado, para un juzgado de la lista", () => {
    const out = render(JUZGADO_RECUSADO);
    expect(out).toContain("XI.- RECUSA SIN EXPRESIÓN DE CAUSA.-");
    expect(out).toContain("a Dra. Marta Lopez.-");
    // Y lo que sigue corre detrás, sin saltear numeral.
    expect(out).toContain("XII.- PETICIÓN.-");
  });

  it("omite el apartado para un juzgado que no está en la lista, y cierra la numeración", () => {
    const out = render("aaaaaaaa-0000-0000-0000-00000000ffff");
    expect(out).not.toContain("RECUSA SIN EXPRESIÓN DE CAUSA");
    // PETICIÓN sube de XII a XI: sin esto el escrito saldría X, XII.
    expect(out).toContain("XI.- PETICIÓN.-");
    expect(out).not.toContain("XII.-");
  });

  it("omite el apartado para un caso sin juzgado cargado", () => {
    // Siete casos activos no tienen juzgado_id (medido 2026-09-17). Correcto,
    // y silencioso: no es un dato faltante del escrito.
    expect(render(null)).not.toContain("RECUSA SIN EXPRESIÓN DE CAUSA");
    expect(render(null)).toContain("XI.- PETICIÓN.-");
  });

  it("nunca deja un [JUEZ_RECUSADO] a la vista cuando no hay recusación", () => {
    // Un juzgado sin recusar no es un dato faltante: es un apartado que no va.
    expect(extractUnresolved(render(null))).toEqual([]);
    expect(extractUnresolved(render(JUZGADO_RECUSADO))).toEqual([]);
  });

  it("numera el mismo cuerpo igual en dos renders seguidos", () => {
    expect(render(JUZGADO_RECUSADO)).toBe(render(JUZGADO_RECUSADO));
  });

  it("nunca deja una línea en blanco doble, con o sin recusación", () => {
    // El defecto de 20260917130000: un tag de bloque solo en su línea se come esa
    // línea, así que la línea en blanco que estaba DESPUÉS del {{/if}} sobrevivía
    // a un bloque que no se renderizó y se sumaba a la de arriba. Salía en toda
    // demanda del estudio, porque ningún juzgado suyo está recusado.
    for (const juzgado of [JUZGADO_RECUSADO, null]) {
      for (const codemandados of [true, false]) {
        expect(render(juzgado, codemandados)).not.toContain("\n\n\n");
      }
    }
  });

  it("deja exactamente una línea en blanco antes de PETICIÓN", () => {
    expect(render(null)).toContain("concordantes.-\n\nXI.- PETICIÓN.-");
    expect(render(JUZGADO_RECUSADO)).toContain(
      "Dra. Marta Lopez.-\n\nXII.- PETICIÓN.-",
    );
  });

  it("deja exactamente una línea en blanco alrededor del rider de codemandados", () => {
    expect(render(null, true)).toContain(
      "codeudores.-\n\nLa ejecutada comenzó",
    );
    // Sin codemandados desaparece el rider entero y el {{#if}} en línea no deja
    // nada: queda "...el contrato.-" y UNA sola línea en blanco.
    expect(render(null, false)).toContain(
      "el contrato.-\n\nLa ejecutada comenzó",
    );
  });
});

// La carátula del convenio, desde 20260917120000. El espacio va ADENTRO del
// bloque: "{{DEMANDADO_MAYUSCULA}}{{#if …}} Y OTRO/A{{/if}} S/ …". Afuera
// dejaría un espacio doble en todo convenio sin codemandados.
describe("la carátula del convenio con codemandados", () => {
  const CARATULA =
    '"{{EMPRESA}} C/ {{DEMANDADO_MAYUSCULA}}{{#if HAY_CODEMANDADOS}} Y OTRO/A{{/if}} S/ COBRO EJECUTIVO"';

  it("agrega Y OTRO/A cuando el caso tiene codemandados", () => {
    expect(
      renderTemplate(CARATULA, {
        EMPRESA: "EMPRESA S.A.",
        DEMANDADO_MAYUSCULA: "APELLIDO NOMBRE",
        HAY_CODEMANDADOS: true,
      }),
    ).toBe('"EMPRESA S.A. C/ APELLIDO NOMBRE Y OTRO/A S/ COBRO EJECUTIVO"');
  });

  it("no deja espacio doble cuando el demandado está solo", () => {
    expect(
      renderTemplate(CARATULA, {
        EMPRESA: "EMPRESA S.A.",
        DEMANDADO_MAYUSCULA: "APELLIDO NOMBRE",
        HAY_CODEMANDADOS: false,
      }),
    ).toBe('"EMPRESA S.A. C/ APELLIDO NOMBRE S/ COBRO EJECUTIVO"');
  });
});

// Fran's rule for A2, 2026-09-17: "todo lo que es config no debería importar si
// el sistema está bien hecho". Until then ONE empresa CUIT with a bad check
// digit meant the head could not save a recused judge either — package A found
// that this is literally what happened (gotcha #51).
describe("aplicarConfigParcial", () => {
  const previa: EstudioEscritosConfig = {
    empresas: {
      Alfa: {
        razonSocial: "ALFA S.A.",
        domicilioLegal: "Calle Inventada 1",
        cuit: "30-70123456-8",
        cuentaBancaria: "Cuenta 1",
      },
      Beta: {
        razonSocial: "BETA S.R.L.",
        domicilioLegal: "Calle Inventada 2",
        cuit: "30-71234567-1",
        cuentaBancaria: "Cuenta 2",
      },
    },
    jueces_recusados: {},
  };

  const errorCuitBeta: ErrorDeConfig = {
    clave: "empresas",
    campo: "empresa.1.cuit",
    fila: { empresa: "Beta" },
    mensaje: "El CUIT de \"Beta\" no es válido.",
  };

  it("guarda el juez aunque el CUIT de una empresa esté mal", () => {
    // El caso reportado, exactamente: el head agrega un juez y una empresa tiene
    // el CUIT mal. Antes no se guardaba nada.
    const { patch, guardadas, rechazadas } = aplicarConfigParcial(
      previa,
      {
        jueces_recusados: { "juzgado-1": "Dra. Jueza Inventada" },
        empresas: {
          Alfa: previa.empresas!.Alfa,
          Beta: { ...previa.empresas!.Beta, cuit: "30-00000000-0" },
        },
      },
      [errorCuitBeta],
    );

    expect(patch.jueces_recusados).toEqual({ "juzgado-1": "Dra. Jueza Inventada" });
    // La fila que falló queda EXACTAMENTE como estaba guardada.
    expect(patch.empresas!.Beta).toEqual(previa.empresas!.Beta);
    expect(patch.empresas!.Alfa).toEqual(previa.empresas!.Alfa);
    expect(guardadas).toContain("jueces_recusados");
    expect(rechazadas).toEqual([]);
  });

  it("deja entrar los otros campos de la empresa que falló", () => {
    // El CUIT se rechaza; la razón social nueva de ESA fila también, porque la
    // fila entera vuelve a lo guardado. Es lo honesto: media empresa guardada es
    // peor que ninguna, y el head ve el error al lado del CUIT.
    const { patch } = aplicarConfigParcial(
      previa,
      {
        empresas: {
          Alfa: { ...previa.empresas!.Alfa, domicilioLegal: "Calle Nueva 9" },
          Beta: { ...previa.empresas!.Beta, cuit: "30-00000000-0" },
        },
      },
      [errorCuitBeta],
    );
    expect(patch.empresas!.Alfa.domicilioLegal).toBe("Calle Nueva 9");
    expect(patch.empresas!.Beta.cuit).toBe("30-71234567-1");
  });

  it("descarta una empresa nueva con CUIT inválido en vez de guardarla mal", () => {
    // No hay valor guardado al que volver, así que la fila no entra. El error la
    // nombra y el formulario la sigue mostrando.
    const { patch } = aplicarConfigParcial(
      previa,
      {
        empresas: {
          ...previa.empresas!,
          Gamma: {
            razonSocial: "GAMMA S.A.",
            domicilioLegal: "",
            cuit: "30-00000000-0",
            cuentaBancaria: "",
          },
        },
      },
      [
        {
          clave: "empresas",
          campo: "empresa.2.cuit",
          fila: { empresa: "Gamma" },
          mensaje: "El CUIT de \"Gamma\" no es válido.",
        },
      ],
    );
    expect(patch.empresas).not.toHaveProperty("Gamma");
    expect(Object.keys(patch.empresas!).sort()).toEqual(["Alfa", "Beta"]);
  });

  it("un error sin fila bloquea la clave empresas entera", () => {
    // El guard de «esta empresa la usan N casos»: un renombre abarca dos filas, y
    // conservar la vieja además de escribir la nueva dejaría dos empresas donde
    // el estudio quería una.
    const { patch, rechazadas } = aplicarConfigParcial(
      previa,
      { empresas: { Alfa: previa.empresas!.Alfa }, jueces_recusados: { j: "Dr. X" } },
      [
        {
          clave: "empresas",
          campo: "empresas",
          mensaje: "La empresa \"Beta\" la usan 3 casos.",
        },
      ],
    );
    expect(patch).not.toHaveProperty("empresas");
    expect(rechazadas).toEqual(["empresas"]);
    // Y el resto sigue guardándose.
    expect(patch.jueces_recusados).toEqual({ j: "Dr. X" });
  });

  it("rechaza solo la clave del encargado y guarda las otras dos", () => {
    const { patch, guardadas, rechazadas } = aplicarConfigParcial(
      previa,
      {
        encargado: { nombre: "Nombre Inventado", cuit: "20-00000000-0" },
        jueces_recusados: { j: "Dr. X" },
        domicilios_procesales: { Tandil: "Calle Inventada 100" },
      },
      [
        {
          clave: "encargado",
          campo: "encargado.cuit",
          mensaje: "El CUIT del encargado no es válido.",
        },
      ],
    );
    expect(patch).not.toHaveProperty("encargado");
    expect(patch.jueces_recusados).toEqual({ j: "Dr. X" });
    expect(patch.domicilios_procesales).toEqual({ Tandil: "Calle Inventada 100" });
    expect(guardadas.sort()).toEqual(["domicilios_procesales", "jueces_recusados"]);
    expect(rechazadas).toEqual(["encargado"]);
  });

  it("no toca una clave que el formulario no posteó", () => {
    // La garantía de mergeEscritosConfig (gotcha #46) sigue valiendo: lo que no
    // se postea ni se guarda ni se rechaza.
    const { patch, guardadas, rechazadas } = aplicarConfigParcial(
      previa,
      { jueces_recusados: {} },
      [],
    );
    expect(Object.keys(patch)).toEqual(["jueces_recusados"]);
    expect(guardadas).toEqual(["jueces_recusados"]);
    expect(rechazadas).toEqual([]);
  });

  it("deja pasar autorizados: undefined, que significa volver a los miembros", () => {
    // Object.hasOwn, no un chequeo de undefined: son dos estados distintos.
    const { patch, guardadas } = aplicarConfigParcial(previa, { autorizados: undefined }, []);
    expect(Object.hasOwn(patch, "autorizados")).toBe(true);
    expect(patch.autorizados).toBeUndefined();
    expect(guardadas).toEqual(["autorizados"]);
  });

  it("aguanta un estudio sin nada guardado todavía", () => {
    const { patch } = aplicarConfigParcial(
      null,
      { empresas: { Alfa: { razonSocial: "A", domicilioLegal: "", cuit: "", cuentaBancaria: "" } } },
      [
        {
          clave: "empresas",
          campo: "empresa.0.cuit",
          fila: { empresa: "Alfa" },
          mensaje: "mal",
        },
      ],
    );
    expect(patch.empresas).toEqual({});
  });
});

describe("validarDomicilioElectronico", () => {
  it("acepta las dos formas que emite la SCBA", () => {
    expect(validarDomicilioElectronico("20123456780@notificaciones.scba.gov.ar")).toBeNull();
    expect(validarDomicilioElectronico("20123456780@notificacion.scba.gov.ar")).toBeNull();
    expect(validarDomicilioElectronico("algo@scba.gov.ar")).toBeNull();
  });

  it("nombra el typo que de verdad pasó", () => {
    // Un estudio real tenía scva por scba, y se imprimía en todo escrito.
    expect(validarDomicilioElectronico("20123456780@notificacion.scva.gov.ar")).toMatch(/scva/);
  });

  it("rechaza cualquier otro dominio", () => {
    expect(validarDomicilioElectronico("alguien@gmail.com")).not.toBeNull();
    expect(validarDomicilioElectronico("sin-arroba")).not.toBeNull();
    // Y un dominio que solo TERMINA parecido.
    expect(validarDomicilioElectronico("x@scba.gov.ar.ejemplo.com")).not.toBeNull();
  });

  it("no se queja de un valor vacío", () => {
    // Vacío imprime [ABOGADO_DOMICILIO_ELECTRONICO], que es un aviso, no un error.
    expect(validarDomicilioElectronico("")).toBeNull();
    expect(validarDomicilioElectronico(null)).toBeNull();
    expect(validarDomicilioElectronico(undefined)).toBeNull();
    expect(validarDomicilioElectronico("   ")).toBeNull();
  });

  it("ignora mayúsculas y espacios al costado", () => {
    expect(validarDomicilioElectronico("  X@Notificaciones.SCBA.GOV.AR  ")).toBeNull();
  });
});

// El aviso de /estudio -> Configuraci\u00f3n. El paquete A se lo salte\u00f3 porque la
// config del estudio real estaba cargada; bajo la regla de Fran (2026-09-17) ese
// es el motivo equivocado: el sistema avisa qu\u00e9 le va a faltar al documento,
// tenga los datos que tenga hoy.
describe("faltantesDeConfig", () => {
  const encargadoCompleto = {
    nombre: "Juana P\u00e9rez",
    matricula: "T\u00ba 1 F\u00ba 2 del Colegio de Abogados de Ejemplo",
    legajo: "00001-1",
    cuit: "27-30111222-5",
    ibm: "27-30111222-5",
    ivaCondicion: "Responsable Inscripto",
    domicilioElectronico: "27301112225@notificaciones.scba.gov.ar",
    telefono: "0000-000000",
    email: "estudio@ejemplo.test",
  };
  const cuentaCompleta = {
    tipo: "Caja de ahorro",
    banco: "Ejemplo",
    numero: "1-2",
    cbu: "0000000000000000000001",
    alias: "MI.ALIAS",
  };
  const empresaCompleta = {
    razonSocial: "ALFA S.A.",
    domicilioLegal: "Calle Inventada 1",
    cuit: "30-70123456-8",
    cuentaBancaria: "Cuenta 1",
  };
  const completa: EstudioEscritosConfig = {
    encargado: encargadoCompleto,
    cuenta_honorarios: cuentaCompleta,
    empresas: { Alfa: empresaCompleta },
  };

  it("no dice nada cuando est\u00e1 todo cargado", () => {
    expect(faltantesDeConfig(completa)).toEqual([]);
  });

  it("no pide ivaCondicion, que tiene default leg\u00edtimo", () => {
    const sinIva = {
      ...completa,
      encargado: { ...encargadoCompleto, ivaCondicion: "" },
    };
    expect(faltantesDeConfig(sinIva)).toEqual([]);
  });

  it("nombra cada campo del encargado que falta", () => {
    const parcial = {
      ...completa,
      encargado: { ...encargadoCompleto, cuit: "", email: "   " },
    };
    const labels = faltantesDeConfig(parcial).map((f) => f.label);
    expect(labels).toEqual(["CUIT", "Correo del estudio"]);
    expect(faltantesDeConfig(parcial).every((f) => f.seccion === "Encargado")).toBe(true);
  });

  it("nombra la empresa junto al campo, porque puede haber varias", () => {
    const parcial: EstudioEscritosConfig = {
      ...completa,
      empresas: {
        Alfa: empresaCompleta,
        Beta: { ...empresaCompleta, cuentaBancaria: "" },
      },
    };
    expect(faltantesDeConfig(parcial).map((f) => f.label)).toEqual([
      "Beta: cuenta bancaria",
    ]);
  });

  it("marca la cuenta de honorarios sin cargar", () => {
    // La misma funci\u00f3n que arma el token: si resuelve a "", el escrito imprime
    // [CUENTA_HONORARIOS]. No se repite la regla.
    const sinCuenta = { ...completa, cuenta_honorarios: undefined };
    expect(faltantesDeConfig(sinCuenta).map((f) => f.seccion)).toEqual([
      "Cuenta de honorarios",
    ]);
  });

  it("distingue una lista de autorizados vac\u00eda de no tener lista", () => {
    // Sin la clave, se derivan de los miembros y no falta nada. Vac\u00eda a
    // prop\u00f3sito, el escrito imprime [AUTORIZADOS].
    expect(faltantesDeConfig({ ...completa, autorizados: [] }).map((f) => f.seccion)).toEqual([
      "Autorizados",
    ]);
    expect(faltantesDeConfig(completa)).toEqual([]);
  });

  it("un estudio reci\u00e9n creado lista los campos del encargado y la cuenta", () => {
    const vacio = faltantesDeConfig({});
    expect(vacio.filter((f) => f.seccion === "Encargado")).toHaveLength(8);
    expect(vacio.filter((f) => f.seccion === "Cuenta de honorarios")).toHaveLength(1);
    // Sin empresas cargadas no hay empresa incompleta que nombrar.
    expect(vacio.filter((f) => f.seccion === "Empresas")).toHaveLength(0);
  });

  it("aguanta null y undefined", () => {
    expect(faltantesDeConfig(null).length).toBeGreaterThan(0);
    expect(faltantesDeConfig(undefined).length).toBeGreaterThan(0);
  });
});
