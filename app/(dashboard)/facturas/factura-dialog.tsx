"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  calcFactura,
  formatArs,
  generateMensaje,
  type TipoFactura,
} from "@/lib/domain/facturas";
import { splitGross } from "@/lib/domain/honorarios";
import { extractUnresolved } from "@/lib/domain/template-engine";
import { destinoDe } from "@/lib/domain/token-destino";
import { formatArDate } from "@/lib/domain/dates";
import { saveFactura, setFacturaConfirmada } from "./actions";

type Props = {
  tipo: TipoFactura;
  pagoId: string;
  ejecutadoId: string | null;
  demandado: string;
  empresa: string | null;
  documento: string;
  monto: number;
  fecha: string;
  factura: {
    mensaje_generado: string;
    confirmada: boolean;
    fecha_generada: string;
  } | null;
};

export function FacturaDialog({
  tipo,
  pagoId,
  ejecutadoId,
  demandado,
  empresa,
  documento,
  monto,
  fecha,
  factura,
}: Props) {
  const [open, setOpen] = useState(false);
  const initialMensaje =
    factura?.mensaje_generado ||
    generateMensaje({ tipo, demandado, monto, empresa, documento });
  const [mensaje, setMensaje] = useState(initialMensaje);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // Same mechanism as the escrito editor: whatever is still [TOKEN] in the text
  // is a gap, and each gap links to the screen that fills it. Read off the
  // CURRENT text, so editing the message by hand clears its own warnings.
  const faltantes = extractUnresolved(mensaje);

  const esFacturaB = tipo === "factura-b";
  const cuota = calcFactura(monto);
  const split = splitGross(monto);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure origin, permissions): the textarea is
      // still there to select by hand.
    }

    if (!factura) {
      const fd = new FormData();
      fd.set("mensaje", mensaje);
      startTransition(() => saveFactura(tipo, pagoId, fd));
    }
  };

  const handleSave = () => {
    const fd = new FormData();
    fd.set("mensaje", mensaje);
    startTransition(() => saveFactura(tipo, pagoId, fd));
  };

  const handleToggleConfirmada = () => {
    startTransition(() =>
      setFacturaConfirmada(tipo, pagoId, !(factura?.confirmada ?? false)),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={factura ? "outline" : "default"}>
          {factura
            ? factura.confirmada
              ? "Ver factura"
              : "Editar factura"
            : "Generar factura"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {demandado}
            <Badge variant="outline">
              {esFacturaB ? "Factura B" : "Pacto cuota litis"}
            </Badge>
            {factura && (
              <Badge
                className={
                  factura.confirmada
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning"
                }
              >
                {factura.confirmada ? "Confirmada" : "Generada"}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {esFacturaB ? "Honorarios cobrados" : "Pago del deudor"} de{" "}
            {formatArs(monto)} · {formatArDate(fecha)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          {esFacturaB ? (
            <>
              <Row label="Honorarios" value={formatArs(split.base)} />
              <Row label="IVA 21%" value={formatArs(split.iva)} />
              <Row label="Aportes 10%" value={formatArs(split.aportes)} />
              <div className="border-t pt-1 mt-1">
                <Row label="Total cobrado" value={formatArs(monto)} bold />
              </div>
            </>
          ) : (
            <>
              <Row label="15% del pago" value={formatArs(cuota.base)} />
              <Row label="IVA 21% sobre el 15%" value={formatArs(cuota.iva)} />
              <div className="border-t pt-1 mt-1">
                <Row label="Total factura" value={formatArs(cuota.total)} bold />
              </div>
            </>
          )}
        </div>

        {/* Printing the raw token read as broken software in Week 2 testing, so
            every gap is named in the firm's words and links to where it is
            fixed. All of these live on the ejecutado, so the link is the case. */}
        {faltantes.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <div className="mb-1 font-medium">
              Faltan {faltantes.length} dato(s) para que el mensaje esté completo:
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {faltantes.map((t) => {
                const label = destinoDe(t)?.label ?? t;
                return (
                  <li key={t}>
                    {ejecutadoId ? (
                      <Badge variant="outline" asChild>
                        <Link
                          href={`/ejecutados/${ejecutadoId}`}
                          className="hover:bg-warning/20"
                        >
                          {label} →
                        </Link>
                      </Badge>
                    ) : (
                      <Badge variant="outline">{label}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Mensaje (editable)
          </label>
          <Textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={5}
            className="text-sm"
          />
        </div>

        <DialogFooter className="gap-2">
          {factura && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleConfirmada}
              disabled={pending}
            >
              {factura.confirmada ? "Marcar pendiente" : "Marcar confirmada"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={pending}
          >
            Guardar
          </Button>
          <Button size="sm" onClick={handleCopy} disabled={pending}>
            {copied ? "¡Copiado!" : "Copiar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold tabular-nums" : "tabular-nums"}>
        {value}
      </span>
    </div>
  );
}
