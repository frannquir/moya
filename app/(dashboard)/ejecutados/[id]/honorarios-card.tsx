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
import { formatJus, formatArs, jusToArs } from "@/lib/domain/honorarios";
import {
  upsertHonorario,
  addHonorarioPago,
  archiveHonorarioPago,
} from "./honorarios-actions";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Honorarios</CardTitle>
        <CardDescription>
          Honorario pactado y pagos recibidos. Valor JUS actual: {formatArs(jusValue)}
        </CardDescription>
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
              highlight={(honorario.pendiente_jus ?? 0) > 0}
            />
          </div>
        )}

        {honorario && (
          <form
            action={addHonorarioPago.bind(null, honorario.id!)}
            className="space-y-3 rounded-md border p-4"
          >
            <h3 className="text-sm font-medium">Registrar pago</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="monto_jus">JUS</Label>
                <Input
                  id="monto_jus"
                  name="monto_jus"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monto_ars">ARS</Label>
                <Input
                  id="monto_ars"
                  name="monto_ars"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha</Label>
                <Input
                  id="fecha"
                  name="fecha"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nota">Nota</Label>
              <Input id="nota" name="nota" placeholder="Opcional" />
            </div>
            <Button type="submit" size="sm">
              Agregar pago
            </Button>
          </form>
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
  highlight,
}: {
  label: string;
  valueJus: number;
  jusValue: number;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "text-orange-600" : ""}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{formatJus(valueJus)}</div>
      <div className="text-xs text-muted-foreground tabular-nums">
        ≈ {formatArs(jusToArs(valueJus, jusValue))}
      </div>
    </div>
  );
}