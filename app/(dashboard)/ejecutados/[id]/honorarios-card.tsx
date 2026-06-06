import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HONORARIO_TIPOS,
  formatJus,
  formatArs,
  jusToArs,
  remainingJus,
} from "@/lib/domain/honorarios";
import { formatArDate } from "@/lib/domain/dates";
import {
  getHonorarioWithBalance,
  listHonorarioPagos,
  getJusValue,
} from "@/lib/data/honorarios";
import { setTipo, archivePago } from "./honorarios-actions";
import { HonorariosAddPagoForm } from "./honorarios-add-pago-form";

export async function HonorariosCard({ ejecutadoId }: { ejecutadoId: string }) {
  const supabase = await createClient();

  const [honorario, jusValue] = await Promise.all([
    getHonorarioWithBalance(supabase, ejecutadoId),
    getJusValue(supabase),
  ]);
  const pagos = honorario ? await listHonorarioPagos(supabase, honorario.id!) : [];

  const tipo = honorario?.monto_total_jus ?? null;
  const pagado = honorario?.pagado_jus ?? 0;
  const pendiente = honorario
    ? remainingJus(honorario.monto_total_jus ?? 0, pagado)
    : 0;
  const isPaid = !!honorario && (honorario.monto_total_jus ?? 0) > 0 && pendiente <= 0;

  const setTipoBound = setTipo.bind(null, ejecutadoId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Honorarios
          {isPaid && (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              Pagado
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Honorario regulado (3,5 o 7 JUS) y pagos recibidos. Valor JUS actual:{" "}
          {formatArs(jusValue)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={setTipoBound} className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tipo:</span>
          {HONORARIO_TIPOS.map((t) => (
            <Button
              key={t}
              type="submit"
              name="tipo_jus"
              value={t}
              size="sm"
              variant={tipo === t ? "default" : "outline"}
            >
              {formatJus(t)}
            </Button>
          ))}
        </form>

        {!honorario && (
          <p className="text-sm text-muted-foreground">
            Elegí el tipo de honorario para empezar a registrar pagos.
          </p>
        )}

        {honorario && (
          <div className="grid grid-cols-3 gap-3 rounded-md border p-4 bg-muted/30">
            <Summary label="Pactado" valueJus={honorario.monto_total_jus ?? 0} jusValue={jusValue} />
            <Summary label="Pagado" valueJus={pagado} jusValue={jusValue} />
            <Summary
              label="Pendiente"
              valueJus={pendiente}
              jusValue={jusValue}
              tone={pendiente > 0 ? "warn" : "ok"}
            />
          </div>
        )}

        {honorario && !isPaid && (
          <HonorariosAddPagoForm
            honorarioId={honorario.id!}
            jusValue={jusValue}
            pendienteJus={pendiente}
          />
        )}

        {pagos.length > 0 && (
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
                      {formatArDate(p.fecha)}
                      {p.nota && ` · ${p.nota}`}
                    </div>
                  </div>
                  <form action={archivePago.bind(null, p.id, ejecutadoId)}>
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
