import { describe, it, expect } from "vitest";
import {
  extractCausa,
  parseMevHeader,
  matchEmail,
  normalize,
  localidadMatch,
  type EjecutadoRef,
  type MailInput,
} from "./mail-match";

// Court is matched by localidad (+ court number). `departamento` holds the seat city;
// `juzgado_numero` is the linked court number. Note Azul's "Nº 1" exists in BOTH
// Olavarría and Tandil — localidad disambiguates.
const E = {
  lucero: { id: "e-lucero", nombre: "Lucero, Hugo Maximiliano", numero_expediente: "1513", departamento: "Olavarría", juzgado_numero: 1 },
  battista: { id: "e-battista", nombre: "Battista, Juan Carlos", numero_expediente: "6564", departamento: "Olavarría", juzgado_numero: 2 },
  // Exercises the "DEPTO N AÑO" extractor (glued prefix, space-separated año).
  della: { id: "e-della", nombre: "Della Maggiora, Mariana Edith", numero_expediente: "TD55725 2024", departamento: "Tandil", juzgado_numero: 1 },
  alvea: { id: "e-alvea", nombre: "Alvea, Vanessa Elizabeth", numero_expediente: "MP-16183-2024", departamento: "Mar del Plata", juzgado_numero: 4 },
  lescano: { id: "e-lescano", nombre: "Lescano, Carlos Alberto", numero_expediente: "65609", departamento: "Azul", juzgado_numero: 1 },
  // Collision: same causa 1513, different city (Tandil, not Olavarría).
  collision: { id: "e-collision", nombre: "Gomez, Pedro", numero_expediente: "1513", departamento: "Tandil", juzgado_numero: 1 },
} satisfies Record<string, EjecutadoRef>;
const ejecutados: EjecutadoRef[] = Object.values(E);

function mevBody(organismo: string, caratula: string, causa: string): MailInput {
  return {
    subject: `${organismo} - Causa: ${causa}`,
    snippet: caratula,
    body_text:
      `Organismo:\t${organismo}\n` +
      `Carátula:\t${caratula}\n` +
      `Nro de causa:\t${causa}\n` +
      `Estado:\tEn Letra`,
    from_email: "mev@scba.gov.ar",
  };
}

// The five real mails Fran pasted.
const mail1 = mevBody("Juzgado Civil y Comercial Nº 1 Olavarría", "TARTAN S.A. C/ LUCERO HUGO MAXIMILIANO Y OTRO/A S/ COBRO SUMARIO SUMAS DINERO (EXC.ALQUILERES, ETC.) -", "1513");
const mail2 = mevBody("Juzgado Civil y Comercial Nº 2 Olavarría", "TARTAN S.A. C/ BATTISTA JUAN CARLOS S/ COBRO EJECUTIVO -", "6564");
const mail3 = mevBody("Juzgado Civil y Comercial Nº 1 Tandil", "TARTAN SA C/ DELLA MAGGIORA MARIANA EDITH S/ COBRO EJECUTIVO -", "55725");
const mail4 = mevBody("Juzgado Civil y Comercial Nº 4 Mar del Plata", "CONTAR SOCIEDAD ANONIMA C/ ALVEA VANESSA ELIZABETH. S/ COBRO EJECUTIVO -", "16183");
const mail5 = mevBody("Juzgado Civil y Comercial Nº 1 Azul", "TARTAN S.A. C/ LESCANO CARLOS ALBERTO Y OTRO/A S/ COBRO EJECUTIVO -", "65609");

describe("normalize", () => {
  it("strips diacritics, lowercases, drops punctuation", () => {
    expect(normalize("Olavarría")).toBe("olavarria");
    expect(normalize("DELLA MAGGIORA, Mariana É.")).toBe("della maggiora mariana e");
  });
});

describe("extractCausa", () => {
  it("bare digits", () => {
    expect(extractCausa("1513")).toMatchObject({ causa: "1513", año: null });
  });
  it("DEPTO-N-AÑO composite", () => {
    expect(extractCausa("OL-840-2019")).toMatchObject({ causa: "840", depto: "OL", año: "2019" });
  });
  it("glued prefix, space-separated año (TD1436 2021)", () => {
    expect(extractCausa("TD1436 2021")).toMatchObject({ causa: "1436", depto: "TD", año: "2021" });
  });
  it("spaced dashes (BL - 1438 - 2017)", () => {
    expect(extractCausa("BL - 1438 - 2017")).toMatchObject({ causa: "1438", año: "2017" });
  });
  it("N/AÑO", () => {
    expect(extractCausa("11111/2024")).toMatchObject({ causa: "11111", año: "2024" });
  });
  it("trailing non-year group is not treated as año (TD800 3614)", () => {
    expect(extractCausa("TD800 3614")).toMatchObject({ causa: "800", año: null });
  });
  it("normalizes leading zeros so both sides agree", () => {
    expect(extractCausa("0840").causa).toBe("840");
  });
  it("empty / garbage yields no causa", () => {
    expect(extractCausa("").causa).toBeNull();
    expect(extractCausa("sin numero").causa).toBeNull();
  });
});

describe("parseMevHeader", () => {
  it("pulls causa, court (numero/localidad) and demandado", () => {
    const h = parseMevHeader(mail1.body_text!);
    expect(h.causa).toBe("1513");
    expect(h.numero).toBe(1);
    expect(localidadMatch(h.localidad, "Olavarría")).toBe(true);
    expect(normalize(h.demandado)).toBe("lucero hugo maximiliano");
  });
  it("drops 'Y OTRO/A' and the S/ object from the defendant", () => {
    const h = parseMevHeader(mail5.body_text!);
    expect(normalize(h.demandado)).toBe("lescano carlos alberto");
  });
  it("trims a stray trailing period (ALVEA VANESSA ELIZABETH.)", () => {
    const h = parseMevHeader(mail4.body_text!);
    expect(normalize(h.demandado)).toBe("alvea vanessa elizabeth");
  });
});

describe("matchEmail — AUTO on the five real mails", () => {
  const cases: [string, MailInput, string][] = [
    ["mail1 → Lucero", mail1, E.lucero.id],
    ["mail2 → Battista", mail2, E.battista.id],
    ["mail3 → Della Maggiora", mail3, E.della.id],
    ["mail4 → Alvea", mail4, E.alvea.id],
    ["mail5 → Lescano", mail5, E.lescano.id],
  ];
  for (const [name, mail, id] of cases) {
    it(name, () => {
      const m = matchEmail(mail, ejecutados);
      expect(m.ejecutadoId).toBe(id);
      expect(m.candidateId).toBeNull();
      expect(m.confidence).toBeGreaterThanOrEqual(0.9);
    });
  }
});

describe("matchEmail — composite key & VETO", () => {
  it("causa 1513 + Olavarría picks Lucero, not the Tandil-1513 collision", () => {
    const m = matchEmail(mail1, ejecutados);
    expect(m.ejecutadoId).toBe(E.lucero.id);
  });
  it("same causa from Tandil lands on the Tandil case, never Lucero (Olavarría)", () => {
    const tandilMail = mevBody("Juzgado Civil y Comercial Nº 1 Tandil", "TARTAN S.A. C/ GOMEZ PEDRO S/ COBRO EJECUTIVO -", "1513");
    const m = matchEmail(tandilMail, ejecutados);
    expect(m.ejecutadoId).toBe(E.collision.id);
  });
  it("causa hit but wrong city, and the right case absent → vetoed, no false candidate", () => {
    // Mail from Tandil for causa 1513, but only the Olavarría-1513 case (Lucero) is loaded.
    const tandilMail = mevBody("Juzgado Civil y Comercial Nº 1 Tandil", "TARTAN S.A. C/ QUIROGA SOFIA S/ COBRO EJECUTIVO -", "1513");
    const m = matchEmail(tandilMail, [E.lucero]);
    expect(m.ejecutadoId).toBeNull();
    expect(m.candidateId).toBeNull();
  });
});

describe("matchEmail — court number disambiguates within a city", () => {
  it("same causa+city but a different court number → not auto", () => {
    const e1 = { id: "x", nombre: "Test, Uno", numero_expediente: "7777", departamento: "Olavarría", juzgado_numero: 1 };
    const mailN2 = mevBody("Juzgado Civil y Comercial Nº 2 Olavarría", "TARTAN S.A. C/ OTRO NOMBRE S/ COBRO EJECUTIVO -", "7777");
    const m = matchEmail(mailN2, [e1]);
    expect(m.ejecutadoId).toBeNull(); // court number contradicts → only a weak candidate at most
  });
});

describe("matchEmail — real MEV body with NO newlines between fields", () => {
  // Reproduces the actual format: all fields run onto one line. A naive EOL capture
  // swallows the whole body into `localidad` and breaks the court match.
  const runOn: MailInput = {
    subject: "Juzgado Civil y Comercial Nº 1 (AZ) - Causa: 65609 - INFORME POR CEDULA / CEDULA INFORMADA",
    snippet: "",
    body_text:
      "Organismo: Juzgado Civil y Comercial Nº 1 Azul " +
      "Carátula: TARTAN SA C/ LESCANO CARLOS ALBERTO Y OTRO/AS/ COBRO EJECUTIVO - " +
      "Nro de causa: 65609 Fecha: 29/05/2026 8:30:52 Descripción: INFORME POR CEDULA / CEDULA INFORMADA Estado: En Letra",
    from_email: "mev@scba.gov.ar",
  };

  it("parses localidad cleanly (not the rest of the body)", () => {
    const h = parseMevHeader(runOn.body_text!);
    expect(h.causa).toBe("65609");
    expect(h.numero).toBe(1);
    expect(localidadMatch(h.localidad, "Azul")).toBe(true);
    expect(normalize(h.demandado)).toBe("lescano carlos alberto");
  });

  it("auto-matches Lescano (causa + Azul)", () => {
    const m = matchEmail(runOn, ejecutados);
    expect(m.ejecutadoId).toBe(E.lescano.id);
    expect(m.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe("matchEmail — name overrides a noisy court mismatch", () => {
  it("departamento holds the judicial dept (Azul) but mail city is Olavarría → still matches on causa+name", () => {
    const battistaAzul: EjecutadoRef = {
      id: "b",
      nombre: "BATTISTA JUAN CARLOS",
      numero_expediente: "6564",
      departamento: "Azul", // judicial department, not the city → conflicts with "Olavarría"
      juzgado_numero: 2,
    };
    const mail = mevBody("Juzgado Civil y Comercial Nº 2 Olavarría", "TARTAN SA C/ BATTISTA JUAN CARLOS S/ COBRO EJECUTIVO -", "6564");
    const m = matchEmail(mail, [battistaAzul]);
    expect(m.ejecutadoId).toBe("b");
  });

  it("but a DIFFERENT name with the same causa in another city is still vetoed", () => {
    // Mail from Tandil, causa 1513, defendant Quiroga; only the Olavarría-1513 case
    // (Lucero) exists — name differs, so the court conflict still vetoes it.
    const tandilMail = mevBody("Juzgado Civil y Comercial Nº 1 Tandil", "TARTAN S.A. C/ QUIROGA SOFIA S/ COBRO EJECUTIVO -", "1513");
    const m = matchEmail(tandilMail, [E.lucero]);
    expect(m.ejecutadoId).toBeNull();
    expect(m.candidateId).toBeNull();
  });
});

describe("matchEmail — encoding tolerance", () => {
  it("mojibake localidad ('Olavarr¡a') still matches the court", () => {
    const garbled = mevBody("Juzgado Civil y Comercial Nº 1 Olavarr¡a", "TARTAN S.A. C/ LUCERO HUGO MAXIMILIANO Y OTRO/A S/ COBRO EJECUTIVO -", "1513");
    const m = matchEmail(garbled, ejecutados);
    expect(m.ejecutadoId).toBe(E.lucero.id);
  });
});

describe("matchEmail — CANDIDATE (no causa) and no-match", () => {
  it("name + court but unknown causa → candidate, not auto", () => {
    const noCausa = mevBody("Juzgado Civil y Comercial Nº 1 Olavarría", "TARTAN S.A. C/ LUCERO HUGO MAXIMILIANO Y OTRO/A S/ COBRO EJECUTIVO -", "999999");
    const m = matchEmail(noCausa, ejecutados);
    expect(m.ejecutadoId).toBeNull();
    expect(m.candidateId).toBe(E.lucero.id);
    expect(m.confidence).toBeGreaterThanOrEqual(0.5);
  });
  it("nothing relevant → no match at all", () => {
    const stranger = mevBody("Juzgado Civil y Comercial Nº 9 La Plata", "BANCO X C/ PERALTA RAMONA S/ COBRO EJECUTIVO -", "42");
    const m = matchEmail(stranger, ejecutados);
    expect(m.ejecutadoId).toBeNull();
    expect(m.candidateId).toBeNull();
  });
});
