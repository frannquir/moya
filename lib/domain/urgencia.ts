// How long a case has sat untouched.
//
// A second axis over the etapa ramp, and deliberately not a hue: etapa already
// owns navy→gold→orange→red→green, so urgency is rendered as an edge bar rather
// than another coloured pill. A red *edge* beside an orange *pill* reads as two
// facts; a red pill beside an orange pill reads as a contradiction.
//
// The clock is `updated_at`, not `created_at`: an old case someone touched
// yesterday is being worked, and a case opened last month that nobody has
// reopened is the one worth chasing.

/** Days untouched before a case is worth a look. */
export const DIAS_ATENCION = 30;

/** Days untouched before it is overdue for a move. */
export const DIAS_URGENTE = 60;

export type Urgencia = "ok" | "atencion" | "urgente";

/**
 * Whole days since an ISO timestamp. Both sides floor to local midnight, so a
 * case saved at 23:50 last night is 1 day old rather than 0 — the reader's day
 * is the unit, as it is in `diasDesde` over in estadisticas.
 *
 * Takes a full timestamp (`updated_at` is a timestamptz), so it parses with
 * `new Date` rather than the date-only `parseLocalDate`.
 */
export function diasInactivo(
  updatedAt: string | null | undefined,
  hoy: Date = new Date(),
): number | null {
  if (!updatedAt) return null;
  const then = new Date(updatedAt);
  if (Number.isNaN(then.getTime())) return null;
  then.setHours(0, 0, 0, 0);
  const now = new Date(hoy);
  now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - then.getTime()) / 86_400_000);
}

/**
 * How overdue a case is. A row with no `updated_at` reads "ok" rather than
 * urgent: absent data is not evidence of neglect, and colouring it red would
 * put a permanent bar on every row the migration left blank.
 */
export function urgenciaDeCaso(
  updatedAt: string | null | undefined,
  hoy: Date = new Date(),
): Urgencia {
  const dias = diasInactivo(updatedAt, hoy);
  if (dias === null) return "ok";
  if (dias >= DIAS_URGENTE) return "urgente";
  if (dias >= DIAS_ATENCION) return "atencion";
  return "ok";
}

/** Tooltip text for the edge bar; null when there is nothing to say. */
export function textoDeInactividad(
  updatedAt: string | null | undefined,
  hoy: Date = new Date(),
): string | null {
  const dias = diasInactivo(updatedAt, hoy);
  if (dias === null || dias < DIAS_ATENCION) return null;
  const meses = Math.floor(dias / 30);
  return meses >= 2
    ? `Sin movimiento hace ${meses} meses`
    : `Sin movimiento hace ${dias} días`;
}
