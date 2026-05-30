// Mail-event classifier. Given a parsed MEV email, infer one or more
// `tipo_evento` proposals to feed the escrito scorer (lib/domain/escritos-scorer.ts).
//
// Rules are conjunctive (ALL needles must appear in the normalized haystack
// = lowercased + accent-stripped). Confidence reflects rule specificity: a
// single-needle rule is weaker than a two-needle rule, so a more-specific
// match wins for the same event. Multiple events per email are allowed —
// e.g. "se dicta sentencia y se aprueba liquidación" can yield both.
//
// Events land in ejecutado_eventos with aplicado=false (proposals) and
// source='mail'. A future UI confirms them; the scorer only reads aplicado=true.

import type { ParsedEmail } from "./gmail.ts";

// Mirrors EVENTO_OPTIONS in lib/domain/escritos.ts. Keep both lists in sync.
export type EventoTipo =
  | "cedula.confirmada"
  | "cedula.revocada"
  | "mandamiento.diligenciado"
  | "mandamiento.devuelto"
  | "sentencia.dictada"
  | "liquidacion.aprobada"
  | "liquidacion.impugnada"
  | "oficio.diligenciado"
  | "pago.acreditado"
  | "caducidad.intimada"
  | "traslado.notificado";

interface Rule {
  event: EventoTipo;
  needles: string[];
}

// Needles are already normalized (lowercase, no accents). Stems are used to
// catch conjugations: "diligenc" matches "diligenciado/diligenciada/diligenciar".
const RULES: Rule[] = [
  { event: "cedula.revocada", needles: ["cedul", "revoc"] },
  { event: "cedula.confirmada", needles: ["cedul", "notific"] },
  { event: "mandamiento.diligenciado", needles: ["mandamient", "diligenc"] },
  { event: "mandamiento.devuelto", needles: ["mandamient", "devuel"] },
  { event: "sentencia.dictada", needles: ["sentencia"] },
  { event: "liquidacion.aprobada", needles: ["liquidacion", "aprob"] },
  { event: "liquidacion.impugnada", needles: ["liquidacion", "impugn"] },
  { event: "oficio.diligenciado", needles: ["oficio", "diligenc"] },
  { event: "pago.acreditado", needles: ["pago", "acredit"] },
  { event: "caducidad.intimada", needles: ["caducidad"] },
  { event: "traslado.notificado", needles: ["traslado"] },
];

export interface EventProposal {
  tipo_evento: EventoTipo;
  confidence: number;
}

export function classifyMailEvents(email: ParsedEmail): EventProposal[] {
  const haystack = normalize(
    [email.subject, email.snippet, email.body_text].join(" "),
  );

  // Collect the most-specific match per event (longer needle lists win ties).
  const best = new Map<EventoTipo, number>();
  for (const rule of RULES) {
    if (rule.needles.every((n) => haystack.includes(n))) {
      const confidence = confidenceFor(rule.needles.length);
      const prev = best.get(rule.event) ?? 0;
      if (confidence > prev) best.set(rule.event, confidence);
    }
  }

  return [...best.entries()].map(([tipo_evento, confidence]) => ({
    tipo_evento,
    confidence,
  }));
}

// 1-needle rule: 0.6 (weak but plausible). 2-needle: 0.85 (specific).
function confidenceFor(needleCount: number): number {
  if (needleCount >= 2) return 0.85;
  return 0.6;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
