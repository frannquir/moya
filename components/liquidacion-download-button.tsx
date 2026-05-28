"use client";

import { Button } from "@/components/ui/button";
import { calcularLiquidacion, type TasaRow } from "@/lib/domain/liquidaciones";
import { parseLocalDate } from "@/lib/domain/dates";
import { downloadLiquidacionPDF } from "@/lib/domain/pdf-liquidacion";

type Input = {
  cuenta: string;
  apynom: string;
  fechaDesde: string;
  fechaHasta: string;
  capital: number;
  gastos: number;
};

export function LiquidacionDownloadButton({
  input,
  tasas,
  label = "Descargar PDF",
  variant = "default",
}: {
  input: Input;
  tasas: TasaRow[];
  label?: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const handleDownload = () => {
    try {
      const ultVenc = parseLocalDate(input.fechaDesde);
      const fechaHasta = parseLocalDate(input.fechaHasta);
      const result = calcularLiquidacion(
        {
          cuenta: input.cuenta,
          apynom: input.apynom,
          ultVenc,
          fechaHasta,
          capital: input.capital,
          gastos: input.gastos,
        },
        tasas,
      );
      downloadLiquidacionPDF({
        cuenta: input.cuenta,
        apynom: input.apynom,
        ultVenc,
        fechaHasta,
        result,
      });
    } catch {
      alert("No se pudo generar el PDF: revisá las fechas y las tasas disponibles.");
    }
  };

  return (
    <Button size="sm" variant={variant} onClick={handleDownload}>
      {label}
    </Button>
  );
}