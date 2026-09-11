// Liquidaciones — core interest calculation.

export type TasaRow = {
  mes: string;
  anio: number;
  tna: number;
};

/**
 * A full row of the BCRA table, as published and as copy-pasted:
 *
 *   MES     AÑO   Fin. Saldos  Ints. Punitorios  T.E.A.     C.F.T.
 *   JUNIO   2025  90.5200      45.2600           109.5292   109.5292
 *
 * - `tna` is **Fin. Saldos**, the nominal annual rate for financing unpaid
 *   balances. It is the rate calcularLiquidacion() applies, which is why it
 *   keeps the plain name.
 * - `intsPunitorios` is the punitive rate, published at half the financiación
 *   rate (Ley 25.065 art. 18 caps it there) — 45,26 against 90,52 above.
 * - `tea` is the Tasa Efectiva Anual: the same rate compounded monthly.
 * - `cft` is the Costo Financiero Total: the TEA plus charges and taxes. Equal
 *   to the TEA when there are none, as in the row above.
 *
 * The last three are nullable because the 303 months loaded before 2026-09-05
 * only ever stored the first figure.
 */
export type TasaRowFull = TasaRow & {
  intsPunitorios: number | null;
  tea: number | null;
  cft: number | null;
};

export const MONTHS_ES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SETIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

function normalizeMonthName(month: string): string {
  return month === "SEPTIEMBRE" ? "SETIEMBRE" : month;
}

// Generic so a full row keeps its extra fields through the sort; callers that
// only have {mes, anio, tna} are unaffected.
export function sortTasasChronological<T extends TasaRow>(tasas: T[]): T[] {
  return [...tasas].sort((a, b) => {
    if (a.anio !== b.anio) return a.anio - b.anio;
    return (
      MONTHS_ES.indexOf(normalizeMonthName(a.mes)) -
      MONTHS_ES.indexOf(normalizeMonthName(b.mes))
    );
  });
}

export function fechaUltDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
}


export function filaFecha(
  fecha: Date,
  tasas: TasaRow[],
  clampToLatest = false,
): number {
  const year = fecha.getFullYear();
  const month = fecha.getMonth();

  const yearRowIndex = tasas.findIndex((t) => t.anio === year);

  if (yearRowIndex === -1) {
    if (clampToLatest && tasas.length > 0) {
      const lastTasa = tasas[tasas.length - 1];
      if (year > lastTasa.anio) return tasas.length - 1;
    }
    return -1;
  }

  if (month === 0) return yearRowIndex;

  const monthName = MONTHS_ES[month];
  const normalizedMonthName = normalizeMonthName(monthName);

  for (let i = yearRowIndex; i < tasas.length; i++) {
    const tasaMonth = normalizeMonthName(tasas[i].mes);
    if (tasaMonth === normalizedMonthName) return i;
    if (tasas[i].anio > year) break;
  }

  if (clampToLatest && tasas.length > 0) {
    const lastTasa = tasas[tasas.length - 1];
    if (year >= lastTasa.anio) return tasas.length - 1;
  }

  return -1;
}

export function parseSpanishNumber(value: string): number {
  if (!value || typeof value !== "string") return NaN;
  let cleaned = value.trim();
  const hasCommaDecimal = /,\d{1,2}$/.test(cleaned);
  if (hasCommaDecimal) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }
  return parseFloat(cleaned);
}

export type LiquidacionRow = {
  periodo: Date;
  importeDeuda: number;
  tnaVigente: number;
  tem: number;
  diasDeMora: number;
  intsCompensatorios: number;
  intsPunitorios: number;
};

export type LiquidacionResult = {
  rows: LiquidacionRow[];
  capital: number;
  totalIntereses: number;
  // The two halves of totalIntereses, summed from the rows. Kept separate so the
  // snapshot and the escrito can report them without re-deriving from the total.
  totalCompensatorios: number;
  totalPunitorios: number;
  iva: number;
  gastos: number;
  // Manually entered interest on gastos — see LiquidacionInput.
  interesGastos: number;
  total: number;
};

export type LiquidacionInput = {
  cuenta: string;
  apynom: string;
  ultVenc: Date; // FECHA VTO. ULTIMO RESUMEN (start)
  fechaHasta: Date; // FECHA FINAL CALCULO (end)
  capital: number;
  gastos: number;
  // Interest accrued on the gastos. Entered by hand because gastos accrue at
  // rates other than the debt's, so it can't come out of the BCRA table.
  // Null/undefined = not entered, which contributes zero.
  interesGastos?: number | null;
};

// Calculate liquidación — replicates VBA Liquidar() exactly.
export function calcularLiquidacion(
  input: LiquidacionInput,
  tasas: TasaRow[],
): LiquidacionResult {
  const { ultVenc, fechaHasta, capital, gastos } = input;
  const interesGastos = input.interesGastos ?? 0;

  const filainicio = filaFecha(ultVenc, tasas);
  const filafin = filaFecha(fechaHasta, tasas, true); // clamp end to latest

  if (filainicio < 0) {
    throw new Error(
      "No se encontró la fecha de inicio, verifique que esté dentro del rango de tasas disponibles",
    );
  }
  if (filafin < 0) {
    throw new Error(
      "No se encontró la fecha final, verifique que esté dentro del rango de tasas disponibles",
    );
  }

  const normalizedFilafinMes = normalizeMonthName(tasas[filafin].mes);
  const filafinMonth = MONTHS_ES.indexOf(normalizedFilafinMes);
  const fechaHastaMonth = fechaHasta.getMonth();
  const fechaHastaYear = fechaHasta.getFullYear();
  const isClamped =
    tasas[filafin].anio !== fechaHastaYear || filafinMonth !== fechaHastaMonth;

  const middleEnd = isClamped ? filafin + 1 : filafin;

  const rows: LiquidacionRow[] = [];

  if (filainicio === filafin && !isClamped) {
    const tasa = tasas[filainicio].tna;
    const periodo = fechaUltDia(ultVenc);
    const dias = fechaHasta.getDate() - ultVenc.getDate();
    if (dias > 0) {
      const intsComp = ((capital * tasa) / 365) * dias / 100;
      const intsPun = intsComp / 2;
      rows.push({
        periodo,
        importeDeuda: capital,
        tnaVigente: tasa,
        tem: (tasa / 365) * 30,
        diasDeMora: dias,
        intsCompensatorios: intsComp,
        intsPunitorios: intsPun,
      });
    }
  } else {
    const tasa0 = tasas[filainicio].tna;
    const fecha_actual0 = fechaUltDia(ultVenc);
    const dias_mora0 = fecha_actual0.getDate() - ultVenc.getDate();
    const intsComp0 = ((capital * tasa0) / 365) * dias_mora0 / 100;
    const intsPun0 = intsComp0 / 2;

    rows.push({
      periodo: fecha_actual0,
      importeDeuda: capital,
      tnaVigente: tasa0,
      tem: (tasa0 / 365) * 30,
      diasDeMora: dias_mora0,
      intsCompensatorios: intsComp0,
      intsPunitorios: intsPun0,
    });

    let fecha_actual = fecha_actual0;
    for (let filaactual = filainicio + 1; filaactual < middleEnd; filaactual++) {
      const tasa = tasas[filaactual].tna;
      fecha_actual = fechaUltDia(
        new Date(fecha_actual.getFullYear(), fecha_actual.getMonth() + 1, 1),
      );
      const dias_mora = fecha_actual.getDate();
      const intsComp = ((capital * tasa) / 365) * dias_mora / 100;
      const intsPun = intsComp / 2;

      rows.push({
        periodo: fecha_actual,
        importeDeuda: capital,
        tnaVigente: tasa,
        tem: (tasa / 365) * 30,
        diasDeMora: dias_mora,
        intsCompensatorios: intsComp,
        intsPunitorios: intsPun,
      });
    }

    const tasaFin = tasas[filafin].tna;
    const fecha_actualFin = fechaUltDia(fechaHasta);
    const dias_moraFin = fechaHasta.getDate();
    const intsCompFin = ((capital * tasaFin) / 365) * dias_moraFin / 100;
    const intsPunFin = intsCompFin / 2;

    rows.push({
      periodo: fecha_actualFin,
      importeDeuda: capital,
      tnaVigente: tasaFin,
      tem: (tasaFin / 365) * 30,
      diasDeMora: dias_moraFin,
      intsCompensatorios: intsCompFin,
      intsPunitorios: intsPunFin,
    });
  }

  const totalCompensatorios = rows.reduce((sum, row) => sum + row.intsCompensatorios, 0);
  const totalPunitorios = rows.reduce((sum, row) => sum + row.intsPunitorios, 0);
  const totalIntereses = totalCompensatorios + totalPunitorios;
  const iva = totalIntereses * 0.21;
  const total = capital + totalIntereses + iva + gastos + interesGastos;

  return {
    rows,
    capital,
    totalIntereses,
    totalCompensatorios,
    totalPunitorios,
    iva,
    gastos,
    interesGastos,
    total,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPeriodo(date: Date): string {
  const monthNames = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear().toString().slice(-2);
  return `${month}-${year}`;
}

/**
 * Read a published rate, in either decimal convention.
 *
 * NOT parseSpanishNumber: that one only treats a comma as a decimal mark when
 * one or two digits follow it, because it parses money. The BCRA prints four —
 * "90,5200" — which falls through its else branch and comes back as 905200, a
 * rate a thousand times too large that nothing downstream would question.
 *
 * A rate is never written with a thousands separator and no decimals, so a lone
 * separator is always the decimal mark. If both appear, the rightmost is.
 */
export function parseTasaNumber(raw: string): number {
  const s = (raw ?? "").trim();
  if (!s) return NaN;

  const dec = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  const otro = Math.min(s.lastIndexOf("."), s.lastIndexOf(","));
  if (otro >= 0) {
    return parseFloat(`${s.slice(0, dec).replace(/[.,]/g, "")}.${s.slice(dec + 1)}`);
  }
  return parseFloat(s.replace(",", "."));
}

/**
 * Read one pasted line into a full BCRA row.
 *
 * Field order is not assumed — the month is recognised by name and the year by
 * being a bare 2001-2099 — but the RATES are positional, because that is the
 * only thing that distinguishes them: 45,26 and 109,5292 are just numbers.
 * They are taken in the order the BCRA prints them, so the first is Fin.
 * Saldos, the second punitorios, then T.E.A. and C.F.T. A line that stops
 * early (the old three-column paste) leaves the rest null rather than guessing.
 */
export function parseTasaRow(line: string): TasaRowFull | null {
  if (!line || !line.trim()) return null;

  // Before the split, not after: the split treats "," as a separator, so
  // "78,50" would already have become two fields by the time anything looked
  // at it as a number.
  const parts = normalizeDecimalCommas(line)
    .trim()
    .split(/[\s,]+/)
    .filter((p) => p.trim());

  let mes: string | null = null;
  let anio: number | null = null;
  const nums: number[] = [];

  for (const part of parts) {
    const trimmed = part.trim();

    // Only the first bare four-digit number is the year; a later one is a rate.
    if (anio === null && /^\d{4}$/.test(trimmed)) {
      const yearVal = parseInt(trimmed, 10);
      if (yearVal >= 2001 && yearVal <= 2099) {
        anio = yearVal;
        continue;
      }
    }

    const upperTrimmed = trimmed.toUpperCase();
    const normalizedMonth =
      upperTrimmed === "SEPTIEMBRE" ? "SETIEMBRE" : upperTrimmed;
    if (MONTHS_ES.includes(normalizedMonth)) {
      mes = normalizedMonth;
      continue;
    }

    const numVal = parseTasaNumber(trimmed);
    if (!isNaN(numVal) && numVal > 0) nums.push(numVal);
  }

  if (!mes || !anio || nums.length === 0) return null;
  return {
    mes,
    anio,
    tna: nums[0],
    intsPunitorios: nums[1] ?? null,
    tea: nums[2] ?? null,
    cft: nums[3] ?? null,
  };
}

// The three fields the interest calculation needs. One parser, two views of it:
// a second implementation is how the paste box and the calculator end up
// disagreeing about what a line said.
export function parsePastedTasaLine(
  line: string,
): { mes: string; anio: number; tna: number } | null {
  const row = parseTasaRow(line);
  return row ? { mes: row.mes, anio: row.anio, tna: row.tna } : null;
}

// Generic for the same reason sortTasasChronological is: the config screen
// needs the full row back, not just the three fields the calculation uses.
export function getUltimaTasa<T extends TasaRow>(tasas: T[]): T | null {
  if (tasas.length === 0) return null;
  const sorted = sortTasasChronological(tasas);
  return sorted[sorted.length - 1];
}

export function isClampedEnd(fechaHasta: Date, tasas: TasaRow[]): boolean {
  const ultima = getUltimaTasa(tasas);
  if (!ultima) return false;
  const lastMonthIdx = MONTHS_ES.indexOf(normalizeMonthName(ultima.mes));
  const lastStart = new Date(ultima.anio, lastMonthIdx, 1);
  const fhStart = new Date(fechaHasta.getFullYear(), fechaHasta.getMonth(), 1);
  return fhStart > lastStart;
}

export type TasaParseResult = {
  parsed: TasaRowFull[];
  /** Lines that had content but no (mes, anio, rate) — shown, never dropped silently. */
  rejected: string[];
};

export type TasaFields = {
  mes: string;
  anio: string;
  tna: string;
  intsPunitorios: string;
  tea: string;
  cft: string;
};

/**
 * Validate the six typed fields into a row.
 *
 * Separate from parseTasaRow on purpose: there the rates are positional because
 * a bare 45,26 says nothing about itself, but here each one arrived in its own
 * labelled box. Joining them back into a line to re-parse would put T.E.A. in
 * the punitorios slot whenever the middle box was left empty.
 */
export function tasaRowFromFields(
  f: TasaFields,
): { row: TasaRowFull } | { error: string } {
  const mes = normalizeMonthName(f.mes.trim().toUpperCase());
  if (!MONTHS_ES.includes(mes)) return { error: "Elegí un mes válido." };

  const anio = parseInt(f.anio.trim(), 10);
  if (!(anio >= 2001 && anio <= 2099)) return { error: "El año tiene que estar entre 2001 y 2099." };

  const tna = parseTasaNumber(f.tna);
  if (isNaN(tna) || tna <= 0) return { error: "Ingresá la financiación de saldos." };

  // The three optional ones: empty stays empty, a typo is rejected rather than
  // stored as NaN or silently dropped.
  const opcional = (raw: string, nombre: string) => {
    if (!raw.trim()) return null;
    const n = parseTasaNumber(raw);
    if (isNaN(n) || n <= 0) return nombre;
    return n;
  };
  const punit = opcional(f.intsPunitorios, "Ints. Punitorios");
  const tea = opcional(f.tea, "T.E.A.");
  const cft = opcional(f.cft, "C.F.T.");
  for (const v of [punit, tea, cft]) {
    if (typeof v === "string") return { error: `${v} no es un número válido.` };
  }

  return {
    row: {
      mes,
      anio,
      tna,
      intsPunitorios: punit as number | null,
      tea: tea as number | null,
      cft: cft as number | null,
    },
  };
}

// The column header that comes along when the BCRA table is selected and copied:
//
//   MES  AÑO  Fin. Saldos  Ints. Punitorios  T.E.A.  C.F.T.
//
// Matched on its first field alone. Anything looser would have to guess, and a
// line that merely fails to parse belongs in `rejected` where it is visible —
// silently swallowing junk is how a month goes missing.
function isHeaderLine(line: string): boolean {
  return /^\s*mes\b/i.test(line);
}

// parsePastedTasaLine treats "," as a field separator, which is right for the
// CSV form ("ENERO,2026,90.52") and wrong for the tab-separated one the BCRA
// page actually copies as, where 78,50 is a Spanish decimal. Splitting that gives
// 78 and drops the 50 — silently, since 78 is a perfectly plausible TNA.
//
// A line uses the comma for one job or the other, never both, and the separator
// it does use says which: once whitespace is already splitting the fields, every
// remaining digit-comma-digit is a decimal mark. "ENERO,2026,90.52" has no
// whitespace separator and is left exactly as it was.
function normalizeDecimalCommas(line: string): string {
  if (/\S[ \t]+\S/.test(line.trim())) return line.replace(/(\d),(\d)/g, "$1.$2");
  return line;
}

// Parse a block pasted from the BCRA page. Delegates to parsePastedTasaLine
// (tolerant of separator, field order and Spanish decimals) so the preview and
// the write can never disagree about what a line means.
//
// Later lines win on a repeated month: pasting a correction below the original
// is the natural way to fix a typo, and the upsert would land the last one anyway.
export function parseTasasBlock(block: string): TasaParseResult {
  const parsed = new Map<string, TasaRowFull>();
  const rejected: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (!line.trim() || isHeaderLine(line)) continue;
    const row = parseTasaRow(line);
    if (!row) {
      rejected.push(line.trim());
      continue;
    }
    parsed.set(`${row.anio}-${row.mes}`, row);
  }

  return { parsed: sortTasasChronological([...parsed.values()]), rejected };
}
