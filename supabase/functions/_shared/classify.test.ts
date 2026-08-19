import { describe, it, expect } from "vitest";
import { classifyMailEvents, type EventoTipo } from "./classify.ts";
import type { ParsedEmail } from "./gmail.ts";
import { EVENTO_OPTIONS } from "../../../lib/domain/escritos";

// MEV mails only ever populate subject/snippet/body_text for classification
// purposes; the rest of ParsedEmail is irrelevant here.
function mail(overrides: Partial<ParsedEmail> = {}): ParsedEmail {
  return {
    gmail_message_id: "m1",
    gmail_thread_id: null,
    from_email: "notificaciones@mev.example",
    from_name: "MEV",
    to_emails: ["estudio@example.com"],
    subject: "",
    snippet: "",
    body_text: "",
    body_html: "",
    received_at: null,
    gmail_labels: [],
    ...overrides,
  };
}

function tipos(email: ParsedEmail): EventoTipo[] {
  return classifyMailEvents(email).map((p) => p.tipo_evento);
}

function confidenceOf(email: ParsedEmail, tipo: EventoTipo): number | undefined {
  return classifyMailEvents(email).find((p) => p.tipo_evento === tipo)?.confidence;
}

describe("classifyMailEvents — liquidación keyword", () => {
  // The three forms the same word reaches us in: plain, correctly accented,
  // and mojibake'd by the upstream Latin-1 decode.
  it.each([
    ["plain", "Practica liquidacion"],
    ["accented", "Practica liquidación"],
    ["mojibake", "Practica liquidaci?n"],
  ])("fires liquidacion.practicable on the %s form", (_label, subject) => {
    expect(tipos(mail({ subject }))).toContain("liquidacion.practicable");
  });

  it("fires on the uppercase MEV subject style", () => {
    expect(tipos(mail({ subject: "PRACTICA LIQUIDACIÓN" }))).toContain(
      "liquidacion.practicable",
    );
  });

  it("fires from the body when the subject is generic", () => {
    const email = mail({
      subject: "Movimiento en expediente 1513/2019",
      body_text: "Se hace saber que se practica la liquidaci?n de autos.",
    });
    expect(tipos(email)).toContain("liquidacion.practicable");
  });

  it("keeps the more specific aprobada reading alongside practicable", () => {
    const email = mail({ subject: "Se tiene por aprobada la liquidación practicada" });
    const result = tipos(email);
    expect(result).toContain("liquidacion.practicable");
    expect(result).toContain("liquidacion.aprobada");
    // Two needles beat one — aprobada is the higher-confidence reading.
    expect(confidenceOf(email, "liquidacion.aprobada")).toBeGreaterThan(
      confidenceOf(email, "liquidacion.practicable")!,
    );
  });

  it("matches aprobada on the mojibake form too (regression)", () => {
    // The old needle was the full "liquidacion", which "liquidaci?n" misses.
    expect(tipos(mail({ subject: "Se tiene por aprobada la liquidaci?n" }))).toContain(
      "liquidacion.aprobada",
    );
  });

  it("matches the stem-changing 'se aprueba' phrasing (regression)", () => {
    // "aprob" does not appear in "aprueba" — needs its own needle.
    expect(tipos(mail({ subject: "Se aprueba la liquidaci?n practicada" }))).toContain(
      "liquidacion.aprobada",
    );
  });

  it("matches impugnada on the mojibake form too", () => {
    expect(tipos(mail({ subject: "Impugna liquidaci?n" }))).toContain(
      "liquidacion.impugnada",
    );
  });

  it("does not fire on an unrelated mail", () => {
    expect(tipos(mail({ subject: "Se dicta sentencia" }))).not.toContain(
      "liquidacion.practicable",
    );
  });
});

describe("classifyMailEvents — intimación keyword", () => {
  it.each([
    ["plain", "CUMPLE INTIMACION"],
    ["accented", "CUMPLE INTIMACIÓN"],
    ["mojibake", "CUMPLE INTIMACI?N"],
  ])("fires caducidad.intimada on the %s form", (_label, subject) => {
    expect(tipos(mail({ subject }))).toContain("caducidad.intimada");
  });

  it("fires on intimación without the word 'cumple'", () => {
    expect(tipos(mail({ subject: "Se intima bajo apercibimiento — intimación" }))).toContain(
      "caducidad.intimada",
    );
  });

  it("the 'cumple intimación' phrase scores higher than the bare stem", () => {
    const bare = confidenceOf(mail({ subject: "Se cursa intimaci?n" }), "caducidad.intimada");
    const phrase = confidenceOf(
      mail({ subject: "CUMPLE INTIMACI?N. SE TENGA POR PREPARADA LA VÍA" }),
      "caducidad.intimada",
    );
    expect(phrase).toBeGreaterThan(bare!);
  });

  it("still fires on the original 'caducidad' needle", () => {
    expect(tipos(mail({ subject: "Acuse de caducidad de instancia" }))).toContain(
      "caducidad.intimada",
    );
  });

  // "intimación" also names the payment demand every mandamiento carries. These
  // two subjects are real, taken from the stored mailbox, and were the only
  // things the bare stem matched across 522 mails — all false positives.
  it.each([
    "Juzgado Civil y Comercial Nº 2 (AZ) - Causa: 54928 - MANDAMIENTO INTIMACION DE PAGO - SOLICITA",
    "Juzgado Civil y Comercial  Nº 2 (OL) - Causa: 4738 - INTIMACION DE OFICIO / SE ORDENA",
    "MANDAMIENTO INTIMACIÓN DE PAGO",
  ])("does not fire on the payment-demand sense: %s", (subject) => {
    expect(tipos(mail({ subject }))).not.toContain("caducidad.intimada");
  });

  it("still fires when 'cumple' marks it as the caducidad sense", () => {
    // The strong signal overrides the veto: this is the escrito being filed in
    // response, not the demand itself.
    expect(
      tipos(mail({ subject: "CUMPLE INTIMACIÓN. Ref. intimacion de pago de autos" })),
    ).toContain("caducidad.intimada");
  });

  it("still fires on the payment sense when caducidad is named outright", () => {
    expect(
      tipos(mail({ subject: "Intimacion de pago", body_text: "bajo apercibimiento de caducidad" })),
    ).toContain("caducidad.intimada");
  });

  it("reports caducidad.intimada only once even when several rules match", () => {
    const result = tipos(mail({ subject: "CUMPLE INTIMACIÓN — caducidad" }));
    expect(result.filter((t) => t === "caducidad.intimada")).toHaveLength(1);
  });
});

describe("EventoTipo / EVENTO_OPTIONS", () => {
  it("every classifier event is offered by the UI list", () => {
    // The two lists are hand-mirrored; this is the guard that keeps a new rule
    // from proposing an event no template can ever be tagged with.
    const emitted = new Set<string>();
    const probes = [
      "cedula notificada",
      "cedula revocada",
      "mandamiento diligenciado",
      "mandamiento devuelto",
      "sentencia",
      "liquidación",
      "liquidación aprobada",
      "liquidación impugnada",
      "oficio diligenciado",
      "pago acreditado",
      "caducidad",
      "intimación",
      "traslado",
    ];
    for (const subject of probes) {
      for (const t of tipos(mail({ subject }))) emitted.add(t);
    }

    expect(emitted.size).toBe(EVENTO_OPTIONS.length);
    for (const t of emitted) {
      expect(EVENTO_OPTIONS as readonly string[]).toContain(t);
    }
  });
});
