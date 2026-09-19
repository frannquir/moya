import { describe, it, expect } from "vitest";
import {
  matchJuzgado,
  normalizeCourtText,
  numeroDeTexto,
  tipoDeTexto,
  type CourtRow,
} from "@/lib/domain/juzgado-match";

// Fixture modelled on the real public.juzgados rows for the estudio's own
// territory. The load-bearing shape: three cities in the Azul department each
// carry Civil courts numbered from one, so "N° 1" means three different courts
// depending on the city.
const civil = (
  id: string,
  numero: number,
  localidad: string,
  departamento: string,
): CourtRow => ({
  id,
  organismo: `Juzgado en lo Civil y Comercial Nº ${numero} - ${departamento}`,
  tipo: "Juzgado Civil y Comercial",
  numero,
  localidad,
  departamento_judicial: departamento,
});
const paz = (
  id: string,
  partido: string,
  localidad: string,
  departamento: string,
): CourtRow => ({
  id,
  organismo: `Juzgado de Paz - ${partido}`,
  tipo: "Juzgado de Paz",
  numero: null,
  localidad,
  departamento_judicial: departamento,
});

const COURTS: CourtRow[] = [
  civil("azul-1", 1, "Azul", "Azul"),
  civil("azul-2", 2, "Azul", "Azul"),
  civil("azul-3", 3, "Azul", "Azul"),
  civil("azul-4", 4, "Azul", "Azul"),
  civil("olav-1", 1, "Olavarría", "Azul"),
  civil("olav-2", 2, "Olavarría", "Azul"),
  civil("tand-1", 1, "Tandil", "Azul"),
  civil("tand-2", 2, "Tandil", "Azul"),
  civil("tand-3", 3, "Tandil", "Azul"),
  civil("nec-1", 1, "Necochea", "Necochea"),
  civil("nec-2", 2, "Necochea", "Necochea"),
  paz("paz-balcarce", "BALCARCE", "Balcarce", "Mar del Plata"),
  paz("paz-alvarado", "GENERAL ALVARADO", "Miramar", "Mar del Plata"),
  paz("paz-loberia", "LOBERÍA", "Lobería", "Necochea"),
  paz("paz-sancayetano", "SAN CAYETANO", "San Cayetano", "Necochea"),
  paz("paz-rauch", "RAUCH", "Rauch", "Azul"),
  paz("paz-tapalque", "TAPALQUÉ", "Tapalqué", "Azul"),
  // The only Paz court in its department — the one shape tier 2 can resolve.
  paz("paz-treslomas", "TRES LOMAS", "Tres Lomas", "Trenque Lauquen"),
  {
    id: "recep-azul",
    organismo: "Receptoría General de Expedientes - Azul",
    tipo: "Receptoria de Expedientes",
    numero: null,
    localidad: "Azul",
    departamento_judicial: "Azul",
  },
];

const match = (juzgado: string | null, departamento: string | null) =>
  matchJuzgado({ juzgado, departamento }, COURTS);

describe("normalizeCourtText", () => {
  it("flattens both ordinal characters the SCBA and the estudio use", () => {
    expect(normalizeCourtText("JCYC Nº2")).toBe("jcyc n 2");
    expect(normalizeCourtText("JCYC N°2")).toBe("jcyc n 2");
  });

  it("collapses the spelled-out número variants", () => {
    expect(normalizeCourtText("JCYC Nro 3")).toBe("jcyc n 3");
    expect(normalizeCourtText("JCYC  numero  3")).toBe("jcyc n 3");
  });

  it("strips accents and case", () => {
    expect(normalizeCourtText("Juzgado de Paz")).toBe("juzgado de paz");
    expect(normalizeCourtText("Receptoría")).toBe("receptoria");
  });
});

describe("tipoDeTexto", () => {
  it("reads the estudio's own shorthand as Civil y Comercial", () => {
    expect(tipoDeTexto("JCYC Nº2")).toBe("civil");
    expect(tipoDeTexto("Juzgado Civil y Comercial N° 4")).toBe("civil");
  });

  it("reads a Juzgado de Paz", () => {
    expect(tipoDeTexto("Juzgado de Paz")).toBe("paz");
  });

  it("calls a Receptoría a Receptoría, not a court", () => {
    expect(tipoDeTexto("Receptoría General de Expedientes")).toBe("receptoria");
  });

  it("returns null for an empty or unreadable text", () => {
    expect(tipoDeTexto("")).toBeNull();
    expect(tipoDeTexto("   ")).toBeNull();
    expect(tipoDeTexto("Tribunal de Trabajo")).toBeNull();
  });
});

describe("numeroDeTexto", () => {
  it("reads a marked number", () => {
    expect(numeroDeTexto("JCYC Nº2")).toBe(2);
    expect(numeroDeTexto("JCYC Nº14")).toBe(14);
  });

  it("reads a standalone number", () => {
    expect(numeroDeTexto("Juzgado Civil y Comercial 3")).toBe(3);
  });

  it("returns null when there is no number", () => {
    expect(numeroDeTexto("Juzgado de Paz")).toBeNull();
  });

  it("never reads a year as a court number", () => {
    expect(numeroDeTexto("JCYC 2019")).toBeNull();
  });
});

describe("matchJuzgado — the city decides which N° 1 it is", () => {
  it("matches the court in the case's own city, not the department seat", () => {
    const r = match("JCYC Nº2", "Olavarría");
    expect(r).toMatchObject({ status: "matched", juzgadoId: "olav-2", via: "localidad" });
  });

  it("gives each city in one department its own numbering", () => {
    expect(match("JCYC Nº1", "Azul")).toMatchObject({ juzgadoId: "azul-1" });
    expect(match("JCYC Nº1", "Olavarría")).toMatchObject({ juzgadoId: "olav-1" });
    expect(match("JCYC Nº1", "Tandil")).toMatchObject({ juzgadoId: "tand-1" });
  });

  it("survives the estudio's spelling of the city", () => {
    expect(match("jcyc n° 2", "Olavarria")).toMatchObject({ juzgadoId: "olav-2" });
    expect(match("JCYC Nro 3", "TANDIL")).toMatchObject({ juzgadoId: "tand-3" });
  });

  it("matches a Juzgado de Paz by its city", () => {
    expect(match("Juzgado de Paz", "Balcarce")).toMatchObject({
      status: "matched",
      juzgadoId: "paz-balcarce",
    });
    // Miramar's court is named after the partido, not the city it sits in.
    expect(match("Juzgado de Paz", "Miramar")).toMatchObject({ juzgadoId: "paz-alvarado" });
  });
});

describe("matchJuzgado — exact or nothing", () => {
  it("does not borrow a number from the department when the city lacks it", () => {
    // Tandil has 1-3. Azul (its department) has a 4. That is not this case's court.
    expect(match("JCYC Nº4", "Tandil")).toMatchObject({
      status: "unmatched",
      reason: "sin-candidatos",
    });
  });

  it("leaves a city with no court of that kind NULL", () => {
    expect(match("JCYC Nº1", "Balcarce")).toMatchObject({
      status: "unmatched",
      reason: "sin-candidatos",
    });
  });

  it("never crosses tipo", () => {
    const r = match("Juzgado de Paz", "Tandil");
    expect(r.status).toBe("unmatched");
    if (r.status === "unmatched") {
      expect(r.candidatos.every((c) => c.tipo === "Juzgado de Paz")).toBe(true);
    }
  });

  it("refuses a department that holds several courts of the kind", () => {
    // No Paz court sits in the city of Azul; its department has two.
    const r = match("Juzgado de Paz", "Azul");
    expect(r).toMatchObject({ status: "unmatched", reason: "ambiguo" });
    if (r.status === "unmatched") expect(r.candidatos).toHaveLength(2);
  });

  it("refuses a numbered Juzgado de Paz (Paz courts have no number)", () => {
    expect(match("Juzgado de Paz Nº2", "Balcarce")).toMatchObject({
      status: "unmatched",
      reason: "sin-candidatos",
    });
  });

  it("refuses a Receptoría outright", () => {
    expect(match("Receptoría General de Expedientes", "Azul")).toMatchObject({
      status: "unmatched",
      reason: "receptoria",
    });
  });

  it("reports a missing text and a missing place apart", () => {
    expect(match("", "Azul")).toMatchObject({ reason: "sin-texto" });
    expect(match("   ", "Azul")).toMatchObject({ reason: "sin-texto" });
    expect(match(null, "Azul")).toMatchObject({ reason: "sin-texto" });
    expect(match("JCYC Nº1", "")).toMatchObject({ reason: "sin-lugar" });
    expect(match("JCYC Nº1", null)).toMatchObject({ reason: "sin-lugar" });
  });

  it("leaves a text of an unreadable kind NULL", () => {
    expect(match("Tribunal de Trabajo N° 1", "Azul")).toMatchObject({
      reason: "tipo-no-reconocido",
    });
  });

  it("does not invent a court for a city nobody filed in", () => {
    expect(match("JCYC Nº1", "Bragado")).toMatchObject({ reason: "sin-candidatos" });
  });
});

describe("matchJuzgado — the judicial department as a fallback", () => {
  it("resolves a department that holds exactly one court of the kind", () => {
    expect(match("Juzgado de Paz", "Trenque Lauquen")).toMatchObject({
      status: "matched",
      juzgadoId: "paz-treslomas",
      via: "departamento-judicial",
    });
  });

  it("prefers the city over the department when both could answer", () => {
    // "Necochea" is a city with Civil courts AND a department with two Paz
    // courts. A Civil text must resolve in the city.
    expect(match("JCYC Nº2", "Necochea")).toMatchObject({
      juzgadoId: "nec-2",
      via: "localidad",
    });
    // A Paz text has no city court to land on, and the department is ambiguous.
    expect(match("Juzgado de Paz", "Necochea")).toMatchObject({ reason: "ambiguo" });
  });
});
