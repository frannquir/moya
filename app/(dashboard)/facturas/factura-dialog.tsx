"use client";

import { useState, useTransition } from "react";
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
import { calcFactura, formatArs, generateMensaje } from "@/lib/domain/facturas";
import { saveFactura, setFacturaConfirmada } from "./actions";

type Props = {
  pagoId: string;
  demandado: string;
  monto: number;
  fecha: string;
  factura: {
    mensaje_generado: string;
    confirmada: boolean;
    fecha_generada: string;
  } | null;
};

export function FacturaDialog({
  pagoId,
  demandado,
  monto,
  fecha,
  factura,
}: Props) {
  const [open, setOpen] = useState(false);
  const initialMensaje =
    factura?.mensaje_generado || generateMensaje({ demandado, monto });
  const [mensaje, setMensaje] = useState(initialMensaje);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const { base, iva, total } = calcFactura(monto);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mensaje);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);

    if (!factura) {
      const fd = new FormData();
      fd.set("mensaje", mensaje);
      startTransition(() => saveFactura(pagoId, fd));
    }
  };

  const handleSave = () => {
    const fd = new FormData();
    fd.set("mensaje", mensaje);
    startTransition(() => saveFactura(pagoId, fd));
  };

  const handleToggleConfirmada = () => {
    startTransition(() =>
      setFacturaConfirmada(pagoId, !(factura?.confirmada ?? false)),
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
            {factura && (
              <Badge
                className={
                  factura.confirmada
                    ? "bg-emerald-600 text-white hover:bg-emerald-600"
                    : "bg-amber-500 text-white hover:bg-amber-500"
                }
              >
                {factura.confirmada ? "Confirmada" : "Generada"}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Pago de {formatArs(monto)} ·{" "}
            {new Date(fecha).toLocaleDateString("es-AR")}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <Row label="15% del pago" value={formatArs(base)} />
          <Row label="IVA 21% sobre el 15%" value={formatArs(iva)} />
          <div className="border-t pt-1 mt-1">
            <Row label="Total factura" value={formatArs(total)} bold />
          </div>
        </div>

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