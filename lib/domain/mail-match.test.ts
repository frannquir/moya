import { describe, it, expect } from "vitest";
import {
  extractCausa,
  parseMevHeader,
  resolveJuzgadoId,
  matchEmail,
  normalize,
  localidadMatch,
  type EjecutadoRef,
  type JuzgadoRef,
  type MailInput,
} from "./mail-match";

// --- Court reference (mirrors the real juzgados rows for these departments) ---
// Note: Azul has a "Nº 1" in BOTH Olavarría and Tandil — localidad disambiguates.
const J = {
  ola1: { id: "j-ola-1", tipo: "Juzgado Civil y Comercial", numero: 1, localidad: "Olavarría" },
  ola2: { id: "j-ola-2", tipo: "Juzgado Civil y Comercial", numero: 2, localidad: "Olavarría" },
  tan1: { id: "j-tan-1", tipo: "Juzgado Civil y Comercial", numero: 1, localidad: "Tandil" },
  mdp4: { id: "j-mdp-4", tipo: "Juzgado Civil y Comercial", numero: 4, localidad: "Mar del Plata" },
  azul1: { id: "j-azul-1", tipo: "Juzgado Civil y Comercial", numero: 1, localidad: "Azul" },
} satisfies Record<string, JuzgadoRef>;
const juzgados: JuzgadoRef[] = Object.values(J);

// --- Ejecutados (the intended matches for the five real mails) ----------------
const E = {
  lucero: { id: "e-lucero", nombre: "Lucero, Hugo Maximiliano", numero_expediente: "1513", juzgado_id: J.ola1.id, departamento: "Olavarría" },
  battista: { id: "e-battista", nombre: "Battista, Juan Carlos", numero_expediente: "6564", juzgado_id: J.ola2.id, departamento: "Olavarría" },
  // Exercises the "DEPTO N AÑO" extractor (space-separated, glued prefix).
  della: { id: "e-della", nombre: "Della Maggiora, Mariana Edith", numero_expediente: "TD55725 2024", juzgado_id: J.tan1.id, departamento: "Tandil" },
  alvea: { id: "e-alvea", nombre: "Alvea, Vanessa Elizabeth", numero_expediente: "MP-16183-2024", juzgado_id: J.mdp4.id, departamento: "Mar del Plata" },
  lescano: { id: "e-lescano", nombre: "Lescano, Carlos Alberto", numero_expediente: "65609", juzgado_id: J.azul1.id, departamento: "Azul" },
  // Collision: same causa number 1513, but a DIFFERENT court (Tandil, not Olavarría).
  collision: { id: "e-collision", nombre: "Gomez, Pedro", numero_expediente: "1513", juzgado_id: J.tan1.id, departamento: "Tandil" },
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
  it("pulls causa, court (tipo/numero/localidad) and demandado", () => {
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

describe("resolveJuzgadoId — localidad disambiguates same tipo+numero", () => {
  it("Olavarría Nº1 and Tandil Nº1 resolve to different ids", () => {
    const hOla = parseMevHeader(mail1.body_text!);
    const hTan = parseMevHeader(mail3.body_text!);
    expect(resolveJuzgadoId(hOla, juzgados)).toBe(J.ola1.id);
    expect(resolveJuzgadoId({ ...hTan, numero: 1 }, juzgados)).toBe(J.tan1.id);
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
      const m = matchEmail(mail, ejecutados, juzgados);
      expect(m.ejecutadoId).toBe(id);
      expect(m.candidateId).toBeNull();
      expect(m.confidence).toBeGreaterThanOrEqual(0.9);
    });
  }
});

describe("matchEmail — composite key & VETO", () => {
  it("causa 1513 + Olavarría picks Lucero, not the Tandil-1513 collision", () => {
    const m = matchEmail(mail1, ejecutados, juzgados);
    expect(m.ejecutadoId).toBe(E.lucero.id);
    expect(m.ejecutadoId).not.toBe(E.collision.id);
  });
  it("a causa that hits a different court is vetoed (no auto-attach)", () => {
    // Same causa 1513 but the mail is from Tandil → should land on the collision case,
    // never on Lucero (Olavarría).
    const tandilMail = mevBody("Juzgado Civil y Comercial Nº 1 Tandil", "TARTAN S.A. C/ GOMEZ PEDRO S/ COBRO EJECUTIVO -", "1513");
    const m = matchEmail(tandilMail, ejecutados, juzgados);
    expect(m.ejecutadoId).toBe(E.collision.id);
  });
});

describe("matchEmail — encoding tolerance", () => {
  it("mojibake localidad ('Olavarr¡a') still resolves the court", () => {
    const garbled = mevBody("Juzgado Civil y Comercial Nº 1 Olavarr¡a", "TARTAN S.A. C/ LUCERO HUGO MAXIMILIANO Y OTRO/A S/ COBRO EJECUTIVO -", "1513");
    const m = matchEmail(garbled, ejecutados, juzgados);
    expect(m.ejecutadoId).toBe(E.lucero.id);
  });
});

describe("matchEmail — CANDIDATE (no causa) and no-match", () => {
  it("name + court but unknown causa → candidate, not auto", () => {
    const noCausa = mevBody("Juzgado Civil y Comercial Nº 1 Olavarría", "TARTAN S.A. C/ LUCERO HUGO MAXIMILIANO Y OTRO/A S/ COBRO EJECUTIVO -", "999999");
    const m = matchEmail(noCausa, ejecutados, juzgados);
    expect(m.ejecutadoId).toBeNull();
    expect(m.candidateId).toBe(E.lucero.id);
    expect(m.confidence).toBeGreaterThanOrEqual(0.5);
  });
  it("nothing relevant → no match at all", () => {
    const stranger = mevBody("Juzgado Civil y Comercial Nº 9 La Plata", "BANCO X C/ PERALTA RAMONA S/ COBRO EJECUTIVO -", "42");
    const m = matchEmail(stranger, ejecutados, juzgados);
    expect(m.ejecutadoId).toBeNull();
    expect(m.candidateId).toBeNull();
  });
});
