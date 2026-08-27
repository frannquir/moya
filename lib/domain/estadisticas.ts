// Date and wording helpers for the /estadisticas chase list.

import { parseLocalDate } from "./dates";

/** Days after the last honorarios payment before a case is chased again. */
export const DIAS_PARA_RECLAMAR = 30;

/** Calendar days between an ISO date and today. Both sides floor to local midnight. */
export function diasDesde(iso: string, hoy: Date = new Date()): number {
  const then = parseLocalDate(iso);
  then.setHours(0, 0, 0, 0);
  const now = new Date(hoy);
  now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - then.getTime()) / 86_400_000);
}

/** Overdue text. `null` means never paid. */
export function textoDeAtraso(dias: number | null): string {
  if (dias === null) return "Nunca se cobró";
  if (dias < 0) return "Pago futuro";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Hace 1 día";
  if (dias < 60) return `Hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return `Hace ${meses} meses`;
}

export function urgencia(dias: number | null): "nunca" | "alta" | "media" {
  if (dias === null) return "nunca";
  return dias >= DIAS_PARA_RECLAMAR * 2 ? "alta" : "media";
}
