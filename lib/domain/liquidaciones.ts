// Liquidaciones — core interest calculation.

export type TasaRow = {
  mes: string;
  anio: number;
  tna: number;
};

export const MONTHS_ES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SETIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

function normalizeMonthName(month: string): string {
  return month === "SEPTIEMBRE" ? "SETIEMBRE" : month;
}

export function sortTasasChronological(tasas: TasaRow[]): TasaRow[] {
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
  iva: number;
  gastos: number;
  total: number;
};

export type LiquidacionInput = {
  cuenta: string;
  apynom: string;
  ultVenc: Date; // FECHA VTO. ULTIMO RESUMEN (start)
  fechaHasta: Date; // FECHA FINAL CALCULO (end)
  capital: number;
  gastos: number;
};

// Calculate liquidación — replicates VBA Liquidar() exactly.
export function calcularLiquidacion(
  input: LiquidacionInput,
  tasas: TasaRow[],
): LiquidacionResult {
  const { ultVenc, fechaHasta, capital, gastos } = input;

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

  const totalIntereses = rows.reduce(
    (sum, row) => sum + row.intsCompensatorios + row.intsPunitorios,
    0,
  );
  const iva = totalIntereses * 0.21;
  const total = capital + totalIntereses + iva + gastos;

  return { rows, capital, totalIntereses, iva, gastos, total };
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

export function parsePastedTasaLine(
  line: string,
): { mes: string; anio: number; tna: number } | null {
  if (!line || !line.trim()) return null;

  const parts = line
    .trim()
    .split(/[\t,]+|\s{2,}/)
    .filter((p) => p.trim());
  if (parts.length < 3) return null;

  let mes: string | null = null;
  let anio: number | null = null;
  let tna: number | null = null;

  for (const part of parts) {
    const trimmed = part.trim();

    if (/^\d{4}$/.test(trimmed)) {
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

    const numVal = parseSpanishNumber(trimmed);
    if (!isNaN(numVal) && numVal > 0 && tna === null) {
      tna = numVal;
      continue;
    }
  }

  if (mes && anio && tna !== null) return { mes, anio, tna };
  return null;
}