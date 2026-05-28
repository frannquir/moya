import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LiquidacionResult } from "./liquidaciones";

const monthNames = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatPeriodoPDF(date: Date): string {
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear().toString().slice(-2);
  return `${month}-${year}`;
}

function formatCurrencyPDF(value: number): string {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDatePDF(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export interface PDFLiquidacionInput {
  cuenta: string;
  apynom: string;
  ultVenc: Date;
  fechaHasta: Date;
  result: LiquidacionResult;
}

export function generateLiquidacionPDFBlob(input: PDFLiquidacionInput): Blob {
  const { cuenta, apynom, ultVenc, fechaHasta, result } = input;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  });

  const marginLeft = 0.7;
  const marginTop = 0.7;
  const pageWidth = 8.5 - 2 * marginLeft;

  doc.setFont("helvetica");
  doc.setFontSize(10);

  doc.setFont("helvetica", "bold");
  doc.text("FECHA VTO. ULTIMO RESUMEN:", marginLeft, marginTop);
  doc.setFont("helvetica", "normal");
  doc.text(formatDatePDF(ultVenc), marginLeft + 2.2, marginTop);

  doc.setFont("helvetica", "bold");
  doc.text("CUENTA:", marginLeft + 4, marginTop);
  doc.setFont("helvetica", "normal");
  doc.text(cuenta, marginLeft + 4.8, marginTop);

  const row2Y = marginTop + 0.25;
  doc.setFont("helvetica", "bold");
  doc.text("FECHA FINAL CALCULO:", marginLeft, row2Y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDatePDF(fechaHasta), marginLeft + 2.2, row2Y);

  const row3Y = row2Y + 0.25;
  doc.setFont("helvetica", "bold");
  doc.text("NOMBRE:", marginLeft, row3Y);
  doc.setFont("helvetica", "normal");
  doc.text(apynom, marginLeft + 0.8, row3Y);

  const tableStartY = row3Y + 0.4;

  const tableHead = [
    ["PERIODO", "IMPORTE DE DEUDA", "TNA VIGENTE", "T.E.M.", "DIAS DE MORA", "INTS. COMPENSATORIOS", "INTS. PUNITORIOS"],
  ];

  const tableBody = result.rows.map((row) => [
    formatPeriodoPDF(row.periodo),
    `$${formatCurrencyPDF(row.importeDeuda)}`,
    row.tnaVigente.toFixed(4),
    row.tem.toFixed(4),
    row.diasDeMora.toString(),
    `$${formatCurrencyPDF(row.intsCompensatorios)}`,
    `$${formatCurrencyPDF(row.intsPunitorios)}`,
  ]);

  const totalCompensatorios = result.rows.reduce((sum, r) => sum + r.intsCompensatorios, 0);
  const totalPunitorios = result.rows.reduce((sum, r) => sum + r.intsPunitorios, 0);

  tableBody.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    `$${formatCurrencyPDF(totalCompensatorios)}`,
    `$${formatCurrencyPDF(totalPunitorios)}`,
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: tableHead,
    body: tableBody,
    margin: { left: marginLeft, right: marginLeft },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 0.05,
      lineColor: [0, 0, 0],
      lineWidth: 0.01,
    },
    headStyles: {
      fillColor: [255, 101, 101], // #FF6565
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    didParseCell: function (data) {
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 0.3;

  const summaryData = [
    ["CAPITAL", `$${formatCurrencyPDF(result.capital)}`],
    ["INTS. COMPENSATORIOS", `$${formatCurrencyPDF(totalCompensatorios)}`],
    ["INTS. PUNITORIOS", `$${formatCurrencyPDF(totalPunitorios)}`],
    ["I.V.A.", `$${formatCurrencyPDF(result.iva)}`],
    ["GASTOS", `$${formatCurrencyPDF(result.gastos)}`],
    ["TOTAL", `$${formatCurrencyPDF(result.total)}`],
  ];

  autoTable(doc, {
    startY: finalY,
    body: summaryData,
    margin: { left: marginLeft + pageWidth - 2.8, right: marginLeft },
    tableWidth: 2.8,
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 0.05,
      lineColor: [0, 0, 0],
      lineWidth: 0.01,
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 1.5 },
      1: { halign: "right", cellWidth: 1.3 },
    },
    didParseCell: function (data) {
      if (data.row.index === 5) {
        data.cell.styles.fillColor = [255, 101, 101]; // #FF6565
      }
    },
  });

  return doc.output("blob");
}

export function downloadLiquidacionPDF(input: PDFLiquidacionInput): void {
  const blob = generateLiquidacionPDFBlob(input);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Liquidación - ${input.apynom}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}