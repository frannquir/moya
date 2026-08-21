// CUIL/CUIT — the identity field for every party on a demanda (locked decision #11).
//
// Format is NN-DDDDDDDD-V: a 2-digit prefix, the DNI zero-padded to 8, and a
// mod-11 check digit. Prefixes are 20 (masculine), 27 (feminine), 23/24 for the
// collision cases, and 30/33/34 for juridical persons (an empleador CUIT is the
// same construction, so the same validator covers it).
//
// The prefix set is a soft guard; the check digit is the real validator.

export const CUIL_REGEX = /^(20|23|24|27|30|33|34)-\d{8}-\d$/;

// Applied to the ten digits that precede the check digit.
const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

export type Sexo = "M" | "F";

/** Every digit in `value`, dashes/dots/spaces dropped. */
export function cuilDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

// Weighted sum of the first ten digits. Callers pass exactly ten.
function weightedSum(tenDigits: string): number {
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(tenDigits[i]) * WEIGHTS[i];
  return sum;
}

/**
 * The check digit a well-formed CUIL must carry, or null when no digit can
 * satisfy it. `resto === 1` would demand a check digit of 10, which is exactly
 * the case dniToCuil resolves by flipping the prefix to 23 — so a CUIL that has
 * already been built never lands here, and one that does is malformed.
 */
export function cuilCheckDigit(tenDigits: string): number | null {
  if (!/^\d{10}$/.test(tenDigits)) return null;
  const resto = weightedSum(tenDigits) % 11;
  if (resto === 0) return 0;
  if (resto === 1) return null;
  return 11 - resto;
}

/** Shape (including the prefix guard) and check digit. */
export function isValidCuil(value: string): boolean {
  const formatted = formatCuil(value);
  if (!CUIL_REGEX.test(formatted)) return false;
  const digits = cuilDigits(formatted);
  return cuilCheckDigit(digits.slice(0, 10)) === Number(digits[10]);
}

/**
 * Insert the dashes. Drives as-you-type masking, so partial input has to come
 * back partially formatted rather than rejected. Anything past 11 digits is
 * dropped — a CUIL is never longer.
 */
export function formatCuil(value: string): string {
  const d = cuilDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/**
 * Strip the prefix, the dashes and the check digit — and then the zero pad
 * (gotcha #36). The middle block is 8 characters, so a DNI below 10 million is
 * stored padded and must not be printed that way. Returns "" for input that is
 * not a complete 11-digit CUIL, so a malformed value never reaches `documento`.
 */
export function cuilToDni(cuil: string): string {
  const d = cuilDigits(cuil);
  if (d.length !== 11) return "";
  const dni = d.slice(2, 10).replace(/^0+/, "");
  return dni === "" ? "0" : dni;
}

/**
 * Dot-grouped DNI, e.g. "23.890.549". The escritos print `D.N.I. N° 23.890.549`
 * and `C.U.I.L. N° 23-23890549-4` in the same sentence, so both helpers exist.
 */
export function formatDni(dni: string): string {
  const d = cuilDigits(dni).replace(/^0+/, "");
  if (d === "") return "";
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * A CUIL is derivable from a DNI plus sexo. Exported because it is deterministic
 * and 2B may want it, but NOT wired into the form this session — validate and
 * mask only, until it has been checked against real rows.
 *
 * When the natural prefix produces `resto === 1` there is no valid check digit,
 * and the real-world resolution is to move the person to the 23 prefix; the
 * resulting CUIL validates under the ordinary rule.
 */
export function dniToCuil(dni: string, sexo: Sexo): string {
  const bare = cuilDigits(dni).replace(/^0+/, "");
  if (bare === "" || bare.length > 8) return "";
  const padded = bare.padStart(8, "0");

  const prefix = sexo === "M" ? "20" : "27";
  const resto = weightedSum(`${prefix}${padded}`) % 11;
  if (resto === 1) return `23-${padded}-${sexo === "M" ? 9 : 4}`;
  return `${prefix}-${padded}-${resto === 0 ? 0 : 11 - resto}`;
}
