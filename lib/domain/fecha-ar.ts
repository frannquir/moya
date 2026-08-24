// Argentine date entry: dd/mm/yyyy in, ISO yyyy-mm-dd stored.
//
// The app stores DATE columns and every server parser reads the raw form value
// straight into Postgres, so the wire format has to stay ISO. What changes here
// is only what the lawyer types and sees: `<input type="date">` renders in the
// BROWSER's locale, so the same field showed dd/mm/aaaa on one machine and
// mm/dd/yyyy on another — a silent, invisible way to file 09/12 as September 12.
//
// Typing and pasting are the primary path (the calendar is the convenience), so
// the parser is deliberately generous about separators and about a pasted ISO
// value, which is what you get copying out of the database or a MEV mail.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Two-digit years pivot at 69: 00–68 read as 20xx, 69–99 as 19xx (the POSIX
 * rule). The firm's dates are contract dates from the 1990s onward and
 * vencimientos a few years out, so "21" is 2021 and "95" is 1995.
 */
const PIVOT = 69;

function isRealDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  // Day 0 of the NEXT month is the last day of this one, leap years included.
  const lastDay = new Date(year, month, 0).getDate();
  return day <= lastDay;
}

function toIso(day: number, month: number, year: number): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(year, 4)}-${p(month)}-${p(day)}`;
}

/**
 * A typed or pasted date as ISO `yyyy-mm-dd`, or null when it is not a date yet.
 *
 * Accepts `9/12/2021`, `09-12-2021`, `09.12.2021`, `09122021`, `9/12/21` and a
 * pasted `2021-12-09`. Returns null — never a guess — for an impossible date
 * like 31/02: a date that does not exist must not become one that does.
 */
export function parseFechaAr(input: string): string | null {
  const raw = (input ?? "").trim();
  if (raw === "") return null;

  // Pasted ISO, e.g. straight out of the database.
  const iso = ISO_RE.exec(raw);
  if (iso) {
    const [, y, m, d] = iso;
    return isRealDate(Number(d), Number(m), Number(y)) ? raw : null;
  }

  let day: number, month: number, year: number;

  // Bare digits only when there is genuinely no separator. Checking length
  // first would swallow "9/2/2021", whose six digits are not ddmmyy.
  const bare = /^\d+$/.test(raw);

  if (bare && raw.length === 8) {
    day = Number(raw.slice(0, 2));
    month = Number(raw.slice(2, 4));
    year = Number(raw.slice(4, 8));
  } else if (bare && raw.length === 6) {
    day = Number(raw.slice(0, 2));
    month = Number(raw.slice(2, 4));
    year = expandYear(Number(raw.slice(4, 6)));
  } else if (bare) {
    return null;
  } else {
    // Separated forms, where day and month may be one digit.
    const parts = raw.split(/[^\d]+/).filter((p) => p !== "");
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    if (d.length > 2 || m.length > 2 || (y.length !== 2 && y.length !== 4)) return null;
    day = Number(d);
    month = Number(m);
    year = y.length === 2 ? expandYear(Number(y)) : Number(y);
  }

  if (!isRealDate(day, month, year)) return null;
  return toIso(day, month, year);
}

function expandYear(twoDigit: number): number {
  return twoDigit < PIVOT ? 2000 + twoDigit : 1900 + twoDigit;
}

/**
 * ISO to what the lawyer reads: `2021-12-09` -> `09/12/2021`.
 *
 * Four digits, not two. The firm writes "dd/mm/aa" as shorthand for the field's
 * shape, but a fecha de mora printed as 09/12/21 inside an escrito is genuinely
 * ambiguous, and these values end up in filed documents.
 */
export function formatFechaAr(iso: string | null | undefined): string {
  const m = ISO_RE.exec((iso ?? "").trim());
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/**
 * As-you-type masking: digits only, slashes inserted, capped at 8 digits.
 * Deliberately does NOT validate — a half-typed "0" must stay "0" rather than
 * being rejected out from under the cursor.
 */
export function maskFechaAr(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** The placeholder and the aria description both name the expected shape. */
export const FECHA_AR_PLACEHOLDER = "dd/mm/aaaa";
