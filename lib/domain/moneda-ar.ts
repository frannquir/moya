// Argentine peso entry: "$1.234.567,89" in, a plain number out.
//
// Separator policy, in order:
//   1. Both `.` and `,` -> the last one is the decimal ("1.234.567,89" and a
//      pasted en-US "1,234,567.89" both parse).
//   2. Only `,` -> decimal. "1234,89" is 1234.89.
//   3. Only `.` -> by shape: several dots, or one dot with exactly three digits
//      after it, is grouping ("1.234" is 1234); otherwise a decimal point.
//
// Feeds generateLiquidacion, {{MONTO_LETRAS}} and the convenio instalments, so
// the ambiguous shapes are covered by tests rather than the happy path.

const NON_NUMERIC = /[^0-9.,-]/g;

/** True for a string that is only digits and separators (after stripping $, spaces, etc.). */
function cleaned(input: string): string {
  return (input ?? "").replace(NON_NUMERIC, "").trim();
}

/** A typed or pasted amount, or null. Never 0 — that is a legitimate amount. */
export function parseMonedaAr(input: string): number | null {
  const raw = cleaned(input);
  if (raw === "" || raw === "-") return null;

  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  if (body === "" || /[.,]{2,}/.test(body)) return null;

  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");

  let decimalSep: "." | "," | null = null;
  if (lastDot >= 0 && lastComma >= 0) {
    decimalSep = lastDot > lastComma ? "." : ",";
  } else if (lastComma >= 0) {
    decimalSep = ",";
  } else if (lastDot >= 0) {
    const parts = body.split(".");
    const tail = parts[parts.length - 1];
    // Several dots, or one with exactly three digits after it, is grouping.
    decimalSep = parts.length > 2 || tail.length === 3 ? null : ".";
  }

  // Exactly once, or "1.2.3,4,5" parses as 1234.5.
  if (decimalSep !== null && body.split(decimalSep).length > 2) return null;

  let intPart: string;
  let decPart = "";
  if (decimalSep === null) {
    intPart = body.replace(/[.,]/g, "");
  } else {
    const at = body.lastIndexOf(decimalSep);
    intPart = body.slice(0, at).replace(/[.,]/g, "");
    decPart = body.slice(at + 1);
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return null;
  if (intPart === "" && decPart === "") return null;
  // More than two decimals is not a peso amount; it is a mistyped separator.
  if (decPart.length > 2) return null;

  const value = Number(`${intPart || "0"}.${decPart || "0"}`);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** "1.234.567,89" — the canonical display form, always two decimals. */
export function formatMonedaAr(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * As-you-type masking: dots on the integer part, at most one comma and two
 * decimals. Does not pad to two decimals — that happens on blur, so a half-typed
 * "1.234," does not jump under the cursor.
 */
export function maskMonedaAr(raw: string): string {
  const s = cleaned(raw);
  if (s === "") return "";

  const negative = s.startsWith("-");
  const body = negative ? s.slice(1) : s;

  // First comma is the decimal point; dots are grouping the mask re-applies.
  const firstComma = body.indexOf(",");
  const intDigits = (firstComma === -1 ? body : body.slice(0, firstComma)).replace(/\D/g, "");
  const decDigits =
    firstComma === -1 ? null : body.slice(firstComma + 1).replace(/\D/g, "").slice(0, 2);

  const grouped = intDigits === "" ? "" : Number(intDigits).toLocaleString("es-AR");
  const sign = negative ? "-" : "";
  if (decDigits === null) return `${sign}${grouped}`;
  return `${sign}${grouped === "" ? "0" : grouped},${decDigits}`;
}

/** How many digits precede `caret` — used to put the caret back after masking. */
export function digitsBefore(value: string, caret: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(caret, value.length); i++) {
    if (value[i] >= "0" && value[i] <= "9") n++;
  }
  return n;
}

/** The offset in `value` that sits just after `count` digits. */
export function offsetAfterDigits(value: string, count: number): number {
  if (count <= 0) return 0;
  let n = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] >= "0" && value[i] <= "9") {
      n++;
      if (n === count) return i + 1;
    }
  }
  return value.length;
}
