// Client-locked recommendation sets: for a given movimiento + diligenciada, the
// exact escritos to offer and the exact order to offer them in.
//
// These can't be expressed as scorer weights. Two reasons:
//   - "show both cédula variants" needs templates whose diligenciada
//     precondition is unmet by some other pinned sibling to survive; WEIGHTS
//     .diligUnmet (-90) exists precisely to hide those.
//   - "Preparar vía ejecutiva" is tagged Inicio Causa, so against an Enviar
//     Cédula ejecutado it only ever scores as stage-adjacent (35) — below the
//     threshold — yet it is the first thing to file once the cédula came back
//     diligenciada.
// So the sets are resolved deterministically and merged ABOVE the scored
// results, and the scorer itself stays a pure additive function.
//
// Templates are referenced by `clave`, never by title: titles are client-facing
// copy that the firm may reword, and title-matching in code is exactly the
// brittleness this replaces.

import { type Movimiento } from "./ejecutado";
import { type EscritoSignalState } from "./escritos";

export type PinnedRule = {
  movimiento: Movimiento;
  diligenciada: boolean;
  claves: readonly string[];
};

// Decided with the client 2026-07-22, revised 2026-07-23.
export const PINNED_RULES: readonly PinnedRule[] = [
  // Cédula came back diligenciada: the notification landed, so move the case
  // forward. No point offering another cédula.
  {
    movimiento: "Enviar Cédula",
    diligenciada: true,
    claves: ["preparar-via-cautelar", "oficio-renaper"],
  },
  // Cédula did NOT come back: re-issue it. Habilitación first (cheaper, no
  // liability), bajo responsabilidad second, RENAPER third to chase a new
  // address. No "Preparar vía" — there is nothing to prepare yet.
  {
    movimiento: "Enviar Cédula",
    diligenciada: false,
    claves: ["cedula-habilitacion", "cedula-bajo-responsabilidad", "oficio-renaper"],
  },
  {
    movimiento: "Enviar Mandamiento",
    diligenciada: true,
    claves: ["sentencia-trance-remate"],
  },
  {
    movimiento: "Enviar Mandamiento",
    diligenciada: false,
    claves: ["nuevo-mandamiento"],
  },
];

// The claves to pin for a signal state, in display order. An unknown (null)
// diligenciada pins nothing — we don't know which branch applies, so the state
// falls through to ordinary scoring rather than guessing.
export function pinnedClavesFor(state: EscritoSignalState): readonly string[] {
  if (!state.movimiento || state.diligenciada === null || state.diligenciada === undefined) {
    return [];
  }
  const rule = PINNED_RULES.find(
    (r) => r.movimiento === state.movimiento && r.diligenciada === state.diligenciada,
  );
  return rule?.claves ?? [];
}
