// Escritos — shared vocabulary for the signal vector and templates.
// Escritos read the signal vector, never mails/movimientos directly.

import { type Movimiento } from "./ejecutado";

export const MEDIDA_CAUTELAR_OPTIONS = ["embargo", "igb"] as const;
export type MedidaCautelar = (typeof MEDIDA_CAUTELAR_OPTIONS)[number];

// Default seed of empresa claves for a fresh estudio. The live list is
// estudio-defined (the keys of escritos_config.empresas); empresa is a free
// string constrained by that configured set, not a DB enum.
export const DEFAULT_EMPRESAS = ["Tartan", "Contar", "Promaq"] as const;
export type Empresa = string;

export const EVENTO_OPTIONS = [
  "cedula.confirmada",
  "cedula.revocada",
  "mandamiento.diligenciado",
  "mandamiento.devuelto",
  "sentencia.dictada",
  "liquidacion.aprobada",
  "liquidacion.impugnada",
  "oficio.diligenciado",
  "pago.acreditado",
  "caducidad.intimada",
  "traslado.notificado",
] as const;
export type EventoTipo = (typeof EVENTO_OPTIONS)[number];

// The signal vector — the single contract escritos score against.
export type EscritoSignalState = {
  movimiento: Movimiento | null;
  medida_cautelar: MedidaCautelar | null;
  diligenciada: boolean | null;
  ultimo_evento: EventoTipo | string | null;
  tiene_liquidacion?: boolean;
  deuda_saldada?: boolean;
  dias_inactivo?: number;
};

export type ScorerTemplate = {
  sugerido_movimiento: string[];
  sugerido_medida_cautelar: string[];
  sugerido_evento: string[];
  sugerido_diligenciada: boolean | null;
};

export const REASON_LABELS: Record<string, string> = {
  etapa: "Etapa",
  medida: "Medida cautelar",
  diligenciada: "Diligenciada",
  evento: "Evento",
};

export const MEDIDA_CAUTELAR_LABELS: Record<MedidaCautelar, string> = {
  embargo: "Embargo",
  igb: "IGB",
};
