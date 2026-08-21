import { describe, it, expect } from "vitest";
import {
  emptyParty,
  labelForCodemandado,
  onlyDigits,
  parseDemandadoExtraFormData,
  parsePartiesJson,
  parsePartyFormData,
  validateDemandadoExtra,
  validateParty,
  type PartyFields,
} from "./demanda";

// Synthetic, check-digit-valid. Never a real CUIL from the firm's documents.
const CUIL = "20-12345678-6";
const CUIT = "30-70123456-8";

function party(over: Partial<PartyFields> = {}): PartyFields {
  return { ...emptyParty(), nombre: "Demandado de Prueba", ...over };
}

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("onlyDigits", () => {
  it("strips the dashes the firm's Word documents use", () => {
    expect(onlyDigits("6002-0239-0201")).toBe("600202390201");
    expect(onlyDigits("5042 0000 1177 1000")).toBe("5042000011771000");
    expect(onlyDigits("")).toBe("");
    expect(onlyDigits("sin numero")).toBe("");
  });
});

describe("parsePartyFormData", () => {
  it("masks the CUIL, strips the card dashes and reads the switch", () => {
    const p = parsePartyFormData(
      form({
        nombre: "  Perez, Juan  ",
        cuil: "20123456786",
        domicilio: "Calle Falsa 123",
        telefono: "221-555-0000",
        trabaja: "true",
        empleador_nombre: "Empresa SA",
        empleador_cuit: "30701234568",
        tarjeta_cabal: "5042-0000-1177-1000",
      }),
    );
    expect(p.nombre).toBe("Perez, Juan");
    expect(p.cuil).toBe(CUIL);
    expect(p.empleador_cuit).toBe(CUIT);
    expect(p.tarjeta_cabal).toBe("5042000011771000");
    expect(p.trabaja).toBe(true);
  });

  it("treats an absent or non-'true' switch as false", () => {
    expect(parsePartyFormData(form({ nombre: "X" })).trabaja).toBe(false);
    expect(parsePartyFormData(form({ nombre: "X", trabaja: "on" })).trabaja).toBe(false);
    expect(parsePartyFormData(form({ nombre: "X", trabaja: "false" })).trabaja).toBe(false);
  });

  it("namespaces its inputs when given a prefix", () => {
    const fd = form({ nombre: "Titular", cd0_nombre: "Codemandado" });
    expect(parsePartyFormData(fd).nombre).toBe("Titular");
    expect(parsePartyFormData(fd, "cd0_").nombre).toBe("Codemandado");
  });
});

describe("parseDemandadoExtraFormData", () => {
  it("reads the case-level fields and normalizes both card numbers", () => {
    const x = parseDemandadoExtraFormData(
      form({
        trabaja: "true",
        empleador_cuit: "30701234568",
        tarjeta_cabal: "5042-0000-1177-1000",
        cuenta_cliper: "6002-0239",
        fecha_contrato: "2026-03-15",
      }),
    );
    expect(x.cuenta_cliper).toBe("60020239");
    expect(x.tarjeta_cabal).toBe("5042000011771000");
    expect(x.empleador_cuit).toBe(CUIT);
    expect(x.fecha_contrato).toBe("2026-03-15");
  });

  it("leaves an empty fecha_contrato null rather than empty string", () => {
    expect(parseDemandadoExtraFormData(form({})).fecha_contrato).toBeNull();
  });
});

describe("parsePartiesJson", () => {
  it("round-trips the codemandado drafts the form serializes", () => {
    const raw = JSON.stringify([
      { nombre: "Uno", cuil: "20123456786", trabaja: true, empleador_nombre: "E" },
      { nombre: "Dos", tarjeta_cabal: "5042-0000-1177-1000" },
    ]);
    const out = parsePartiesJson(raw);
    expect(out).toHaveLength(2);
    expect(out[0].cuil).toBe(CUIL);
    expect(out[0].trabaja).toBe(true);
    expect(out[1].trabaja).toBe(false);
    expect(out[1].tarjeta_cabal).toBe("5042000011771000");
  });

  it("drops rows the user added and never named", () => {
    const raw = JSON.stringify([{ nombre: "" }, { nombre: "   " }, { nombre: "Real" }]);
    expect(parsePartiesJson(raw).map((p) => p.nombre)).toEqual(["Real"]);
  });

  it("returns an empty list for junk instead of throwing", () => {
    for (const raw of ["", "not json", "{}", "null", "42", '"texto"']) {
      expect(parsePartiesJson(raw)).toEqual([]);
    }
  });

  it("ignores unknown keys and non-object entries", () => {
    const raw = JSON.stringify([{ nombre: "Uno", hacker: "x" }, 5, null, "s"]);
    const out = parsePartiesJson(raw);
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]).sort()).toEqual(Object.keys(emptyParty()).sort());
  });
});

describe("validateParty", () => {
  it("accepts a minimal party", () => {
    expect(validateParty(party(), "El demandado")).toBeNull();
  });

  it("requires a nombre", () => {
    expect(validateParty(party({ nombre: "" }), "El codemandado 1")).toMatch(/nombre/);
  });

  it("accepts a blank CUIL but rejects a bad one", () => {
    expect(validateParty(party({ cuil: "" }), "El demandado")).toBeNull();
    expect(validateParty(party({ cuil: CUIL }), "El demandado")).toBeNull();
    expect(validateParty(party({ cuil: "20-12345678-1" }), "El demandado")).toMatch(/CUIL/);
  });

  it("requires the employer block only when trabaja is true", () => {
    expect(validateParty(party({ trabaja: false }), "El demandado")).toBeNull();
    expect(validateParty(party({ trabaja: true }), "El demandado")).toMatch(/empleador/);
    expect(
      validateParty(party({ trabaja: true, empleador_nombre: "Empresa SA" }), "El demandado"),
    ).toMatch(/CUIT/);
    expect(
      validateParty(
        party({ trabaja: true, empleador_nombre: "Empresa SA", empleador_cuit: CUIT }),
        "El demandado",
      ),
    ).toBeNull();
  });

  it("validates the employer CUIT with the same mod-11 rule", () => {
    expect(
      validateParty(
        party({ trabaja: true, empleador_nombre: "Empresa SA", empleador_cuit: "30-70123456-1" }),
        "El demandado",
      ),
    ).toMatch(/CUIT/);
  });

  it("names the offending party in the message", () => {
    expect(validateParty(party({ nombre: "" }), labelForCodemandado(1))).toContain(
      "El codemandado 2",
    );
  });
});

describe("validateDemandadoExtra", () => {
  it("applies the same employer rule to the demandado's own block", () => {
    const base = parseDemandadoExtraFormData(form({}));
    expect(validateDemandadoExtra(base)).toBeNull();
    expect(validateDemandadoExtra({ ...base, trabaja: true })).toMatch(/empleador/);
    expect(
      validateDemandadoExtra({
        ...base,
        trabaja: true,
        empleador_nombre: "Empresa SA",
        empleador_cuit: CUIT,
      }),
    ).toBeNull();
  });

  it("does not reject a demandado with no identity loaded yet", () => {
    // The Demanda card edits only the employment block; nombre/cuil are the main
    // form's business and must not block a save here.
    expect(validateDemandadoExtra(parseDemandadoExtraFormData(form({})))).toBeNull();
  });
});
