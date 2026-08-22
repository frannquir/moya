// Amounts spelled out in Argentine Spanish, for the demanda and the convenio.
//
// Canonical form, confirmed by Fran:
//     PESOS TRESCIENTOS TRES MIL CIENTO CINCUENTA Y TRES ($303.153,00.-)
//
// Accents are kept on capitals (VEINTIÚN, MILLÓN, DIECISÉIS) — the firm's own
// documents do the same (PETICIÓN, EXPRESIÓN).

import { formatCurrency } from "./liquidaciones";

const UNIDADES = [
  "CERO", "UNO", "DOS", "TRES", "CUATRO",
  "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
] as const;

// 10-29 are irregular: 16-19 and 21-29 are single words, not "DIEZ Y SEIS".
const ESPECIALES: Record<number, string> = {
  10: "DIEZ",
  11: "ONCE",
  12: "DOCE",
  13: "TRECE",
  14: "CATORCE",
  15: "QUINCE",
  16: "DIECISÉIS",
  17: "DIECISIETE",
  18: "DIECIOCHO",
  19: "DIECINUEVE",
  20: "VEINTE",
  21: "VEINTIUNO",
  22: "VEINTIDÓS",
  23: "VEINTITRÉS",
  24: "VEINTICUATRO",
  25: "VEINTICINCO",
  26: "VEINTISÉIS",
  27: "VEINTISIETE",
  28: "VEINTIOCHO",
  29: "VEINTINUEVE",
};

const DECENAS: Record<number, string> = {
  3: "TREINTA",
  4: "CUARENTA",
  5: "CINCUENTA",
  6: "SESENTA",
  7: "SETENTA",
  8: "OCHENTA",
  9: "NOVENTA",
};

// 1 is CIENTO here; bare 100 is CIEN and is special-cased.
const CENTENAS: Record<number, string> = {
  1: "CIENTO",
  2: "DOSCIENTOS",
  3: "TRESCIENTOS",
  4: "CUATROCIENTOS",
  5: "QUINIENTOS",
  6: "SEISCIENTOS",
  7: "SETECIENTOS",
  8: "OCHOCIENTOS",
  9: "NOVECIENTOS",
};

/**
 * `uno` apocopates to `un` only when it precedes a masculine noun or the
 * multipliers `mil` / `millón`. Standing at the end of a number it stays `uno`.
 *
 *   terminal            1 -> UNO, 21 -> VEINTIUNO, 101 -> CIENTO UNO
 *   before a multiplier 21.000 -> VEINTIÚN MIL, 101.000 -> CIENTO UN MIL
 *
 * The canonical monto form puts PESOS first, so the numeral is terminal there;
 * centavos read "CON VEINTIÚN CENTAVOS", where the noun follows, so they
 * apocopate. One positional rule covers both.
 */
function apocopeUno(word: string, apocopar: boolean): string {
  if (!apocopar) return word;
  if (word === "UNO") return "UN";
  if (word === "VEINTIUNO") return "VEINTIÚN";
  if (word.endsWith(" UNO")) return `${word.slice(0, -4)} UN`;
  return word;
}

/** 1..999. */
function tresDigitos(n: number, apocopar: boolean): string {
  if (n === 100) return "CIEN";

  const centenas = Math.floor(n / 100);
  const resto = n % 100;
  const parts: string[] = [];
  if (centenas > 0) parts.push(CENTENAS[centenas]);

  if (resto > 0) {
    if (resto < 10) {
      parts.push(UNIDADES[resto]);
    } else if (resto < 30) {
      parts.push(ESPECIALES[resto]);
    } else {
      const decena = Math.floor(resto / 10);
      const unidad = resto % 10;
      parts.push(unidad === 0 ? DECENAS[decena] : `${DECENAS[decena]} Y ${UNIDADES[unidad]}`);
    }
  }

  return apocopeUno(parts.join(" "), apocopar);
}

/** 1..999_999. `mil` is a multiplier, so its own count always apocopates. */
function seisDigitos(n: number, apocopar: boolean): string {
  const miles = Math.floor(n / 1000);
  const unidades = n % 1000;
  const parts: string[] = [];

  // "MIL", never "UN MIL".
  if (miles === 1) parts.push("MIL");
  else if (miles > 1) parts.push(`${tresDigitos(miles, true)} MIL`);

  if (unidades > 0) parts.push(tresDigitos(unidades, apocopar));

  return parts.join(" ");
}

export type NumeroALetrasOptions = {
  /** True when a masculine noun or a multiplier follows the numeral. */
  apocopar?: boolean;
};

/** A non-negative integer in words, uppercase. */
export function numeroALetras(n: number, opts: NumeroALetrasOptions = {}): string {
  const apocopar = opts.apocopar === true;
  if (!Number.isFinite(n)) return "";
  const value = Math.trunc(Math.abs(n));
  if (value === 0) return "CERO";

  const millones = Math.floor(value / 1_000_000);
  const resto = value % 1_000_000;
  const parts: string[] = [];

  if (millones === 1) {
    parts.push("UN MILLÓN");
  } else if (millones > 1) {
    parts.push(`${seisDigitos(millones, true)} MILLONES`);
  }

  if (resto > 0) parts.push(seisDigitos(resto, apocopar));

  return parts.join(" ");
}

/** "$303.153,00.-" — the numeric half of the canonical form. */
export function formatMontoNumerico(monto: number): string {
  return `$${formatCurrency(Math.abs(Number(monto) || 0))}.-`;
}

/**
 * The canonical form the demanda and the convenio print:
 *
 *   PESOS TRESCIENTOS TRES MIL CIENTO CINCUENTA Y TRES ($303.153,00.-)
 *
 * With centavos the words carry them too, so the letters and the digits always
 * state the same amount — the whole point of spelling an amount out in a
 * document a judge reads (Fran, 2026-08-21):
 *
 *   PESOS ... CON CINCUENTA CENTAVOS ($303.153,50.-)
 */
export function montoALetras(monto: number): string {
  const value = Math.abs(Number(monto) || 0);
  const entero = Math.trunc(value);
  // Round rather than truncate: 0.1 + 0.2 arithmetic upstream must not turn
  // 50 centavos into 49.
  const centavos = Math.round((value - entero) * 100);

  // Rounding can carry (e.g. 10.999 -> 11,00).
  const enteroFinal = centavos === 100 ? entero + 1 : entero;
  const centavosFinal = centavos === 100 ? 0 : centavos;

  const letras = numeroALetras(enteroFinal);
  const conCentavos =
    centavosFinal > 0
      ? ` CON ${numeroALetras(centavosFinal, { apocopar: true })} ${
          centavosFinal === 1 ? "CENTAVO" : "CENTAVOS"
        }`
      : "";

  return `PESOS ${letras}${conCentavos} (${formatMontoNumerico(
    enteroFinal + centavosFinal / 100,
  )})`;
}
