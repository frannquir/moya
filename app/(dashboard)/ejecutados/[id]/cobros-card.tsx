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
import { Badge } from "@/components/ui/badge";
import { formatArs } from "@/lib/domain/cobros";
import { addCobro, confirmCobro, archiveCobro } from "./cobros-actions";

export async function CobrosCard({ ejecutadoId }: { ejecutadoId: string }) {
  const supabase = await createClient();

  const [{ data: cobros }, { data: totalsRow }] = await Promise.all([
    supabase
      .from("cobros_pagos")
      .select("*")
      .eq("ejecutado_id", ejecutadoId)
      .is("archived_at", null)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("cobros_totals")
      .select("total_solicitado, total_proveido, pagos_count")
      .eq("ejecutado_id", ejecutadoId)
      .maybeSingle(),
  ]);

  const totalSolicitado = Number(totalsRow?.total_solicitado ?? 0);
  const totalProveido = Number(totalsRow?.total_proveido ?? 0);

  const add = addCobro.bind(null, ejecutadoId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobros</CardTitle>
        <CardDescription>
          Pagos solicitados y proveídos por el juzgado en este expediente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 rounded-md border p-4 bg-muted/30">
          <Summary label="Solicitado" value={totalSolicitado} />
          <Summary label="Cobrado" value={totalProveido} tone="ok" />
        </div>

        <form action={add} className="space-y-3 rounded-md border p-4">
          <h3 className="text-sm font-medium">Registrar cobro</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="monto">Monto (ARS) *</Label>
              <Input
                id="monto"
                name="monto"
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
            Agregar cobro
          </Button>
        </form>

        {cobros && cobros.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Pagos ({cobros.length})</h3>
            <ul className="divide-y rounded-md border">
              {cobros.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">
                        {formatArs(Number(c.monto))}
                      </span>
                      {c.estado === "Proveído" ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          Proveído
                        </Badge>
                      ) : (
                        <Badge variant="outline">Solicitado</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.fecha).toLocaleDateString("es-AR")}
                      {c.nota && ` · ${c.nota}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.estado === "Solicitado" && (
                      <form action={confirmCobro.bind(null, c.id, ejecutadoId)}>
                        <Button type="submit" variant="outline" size="sm">
                          Confirmar
                        </Button>
                      </form>
                    )}
                    <form action={archiveCobro.bind(null, c.id, ejecutadoId)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Eliminar
                      </Button>
                    </form>
                  </div>
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
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok";
}) {
  const toneClass = tone === "ok" ? "text-emerald-600" : "";
  return (
    <div className={toneClass}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{formatArs(value)}</div>
    </div>
  );
}