import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatJus, formatArs, jusToArs } from "@/lib/domain/honorarios";
import {
  upsertHonorario,
  archiveHonorarioPago,
} from "./honorarios-actions";
import { HonorariosAddPagoForm } from "./honorarios-add-pago-form";

export async function HonorariosCard({ ejecutadoId }: { ejecutadoId: string }) {
  const supabase = await createClient();

  const [{ data: honorario }, { data: jusConfigRow }] = await Promise.all([
    supabase
      .from("honorarios_with_balance")
      .select("*")
      .eq("ejecutado_id", ejecutadoId)
      .maybeSingle(),
    supabase
      .from("system_config")
      .select("value")
      .eq("key", "jus_config")
      .single(),
  ]);

  const jusValue = (jusConfigRow?.value as { value: number })?.value ?? 0;

  const { data: pagos } = honorario
    ? await supabase
        .from("honorarios_pagos")
        .select("*")
        .eq("honorario_id", honorario.id!)
        .is("archived_at", null)
        .order("fecha", { ascending: false })
    : { data: [] };

  const upsert = upsertHonorario.bind(null, ejecutadoId);
  const isPaid =
    !!honorario &&
    (honorario.monto_total_jus ?? 0) > 0 &&
    (honorario.pendiente_jus ?? 0) <= 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              Honorarios
              {isPaid && (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  Pagado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Honorario pactado y pagos recibidos. Valor JUS actual: {formatArs(jusValue)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={upsert} className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="monto_total_jus">Honorario pactado (JUS)</Label>
              <Input
                id="monto_total_jus"
                name="monto_total_jus"
                type="number"
                step="0.01"
                min="0"
                defaultValue={honorario?.monto_total_jus ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label>Equivalente en ARS</Label>
              <div className="h-9 rounded-md border bg-muted px-3 flex items-center text-sm tabular-nums">
                {formatArs(jusToArs(Number(honorario?.monto_total_jus ?? 0), jusValue))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              name="observaciones"
              rows={2}
              defaultValue={honorario?.observaciones ?? ""}
            />
          </div>
          <Button type="submit" size="sm">
            {honorario ? "Actualizar honorario" : "Crear honorario"}
          </Button>
        </form>

        {honorario && (
          <div className="grid grid-cols-3 gap-3 rounded-md border p-4 bg-muted/30">
            <Summary
              label="Pactado"
              valueJus={honorario.monto_total_jus ?? 0}
              jusValue={jusValue}
            />
            <Summary
              label="Pagado"
              valueJus={honorario.pagado_jus ?? 0}
              jusValue={jusValue}
            />
            <Summary
              label="Pendiente"
              valueJus={honorario.pendiente_jus ?? 0}
              jusValue={jusValue}
              tone={
                (honorario.pendiente_jus ?? 0) > 0
                  ? "warn"
                  : (honorario.monto_total_jus ?? 0) > 0
                    ? "ok"
                    : undefined
              }
            />
          </div>
        )}

        {honorario && !isPaid && (
          <HonorariosAddPagoForm
            honorarioId={honorario.id!}
            jusValue={jusValue}
          />
        )}

        {pagos && pagos.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Pagos recibidos</h3>
            <ul className="divide-y rounded-md border">
              {pagos.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {formatJus(p.monto_jus)} · {formatArs(p.monto_ars)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.fecha).toLocaleDateString("es-AR")}
                      {p.nota && ` · ${p.nota}`}
                    </div>
                  </div>
                  <form action={archiveHonorarioPago.bind(null, p.id, ejecutadoId)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Eliminar
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Summary({
  label,
  valueJus,
  jusValue,
  tone,
}: {
  label: string;
  valueJus: number;
  jusValue: number;
  tone?: "warn" | "ok";
}) {
  const toneClass =
    tone === "warn" ? "text-orange-600" : tone === "ok" ? "text-emerald-600" : "";
  return (
    <div className={toneClass}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{formatJus(valueJus)}</div>
      <div className="text-xs text-muted-foreground tabular-nums">
        ≈ {formatArs(jusToArs(valueJus, jusValue))}
      </div>
    </div>
  );
}