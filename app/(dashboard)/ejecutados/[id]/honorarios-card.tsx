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
  IVA_RATE,
  APORTES_RATE,
  formatJus,
  formatArs,
  jusToArs,
  grossCapJus,
  splitGross,
  remainingJus,
  remainingGrossJus,
} from "@/lib/domain/honorarios";
import { formatArDate } from "@/lib/domain/dates";
import {
  getHonorarioWithBalance,
  listHonorarioPagos,
  getJusValue,
} from "@/lib/data/honorarios";
import { setTipo, archivePago } from "./honorarios-actions";
import { HonorariosAddPagoForm } from "./honorarios-add-pago-form";

const PCT = (n: number) => `${Math.max(0, Math.min(100, n))}%`;

export async function HonorariosCard({ ejecutadoId }: { ejecutadoId: string }) {
  const supabase = await createClient();

  const [honorario, jusValue] = await Promise.all([
    getHonorarioWithBalance(supabase, ejecutadoId),
    getJusValue(supabase),
  ]);
  const pagos = honorario ? await listHonorarioPagos(supabase, honorario.id!) : [];

  const tipo = honorario?.monto_total_jus ?? null;
  const base = honorario?.monto_total_jus ?? 0;
  const pagado = honorario?.pagado_jus ?? 0;

  // Two ceilings now: the regulated fee, and the fee plus the tax charged on it.
  const gross = grossCapJus(base);
  const pendienteBase = honorario ? remainingJus(base, pagado) : 0;
  const pendienteGross = honorario ? remainingGrossJus(base, pagado) : 0;
  const baseCubierto = !!honorario && base > 0 && pendienteBase <= 0;
  const isPaid = !!honorario && base > 0 && pendienteGross <= 0;

  // What the full cap is made of, and what has come in so far.
  const capSplit = splitGross(gross);
  const cobradoSplit = splitGross(Math.min(pagado, gross));

  const setTipoBound = setTipo.bind(null, ejecutadoId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Honorarios
          {isPaid ? (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              Pagado
            </Badge>
          ) : (
            baseCubierto && <Badge variant="outline">Honorario cubierto</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Honorario regulado (3,5 o 7 JUS) más IVA {Math.round(IVA_RATE * 100)}% y
          aportes {Math.round(APORTES_RATE * 100)}%. Valor JUS actual:{" "}
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
          {tipo != null && (
            <span className="text-xs text-muted-foreground">
              → máximo a cobrar {formatJus(gross)}
            </span>
          )}
        </form>

        {!honorario && (
          <p className="text-sm text-muted-foreground">
            Elegí el tipo de honorario para empezar a registrar pagos.
          </p>
        )}

        {honorario && (
          <div className="space-y-4">
            {/* What the maximum is made of. */}
            <div className="grid grid-cols-2 gap-3 rounded-md border p-4 bg-muted/30 sm:grid-cols-4">
              <Summary label="Honorario" valueJus={capSplit.base} jusValue={jusValue} />
              <Summary
                label={`IVA ${Math.round(IVA_RATE * 100)}%`}
                valueJus={capSplit.iva}
                jusValue={jusValue}
              />
              <Summary
                label={`Aportes ${Math.round(APORTES_RATE * 100)}%`}
                valueJus={capSplit.aportes}
                jusValue={jusValue}
              />
              <Summary
                label="Máximo a cobrar"
                valueJus={gross}
                jusValue={jusValue}
                strong
              />
            </div>

            {/* Progress toward the base cap, then a distinct tax zone. */}
            <div className="space-y-2">
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 right-0 bg-foreground/10"
                  style={{ left: PCT(gross > 0 ? (base / gross) * 100 : 0) }}
                />
                <div
                  className={`absolute inset-y-0 left-0 ${
                    isPaid ? "bg-emerald-600" : "bg-primary"
                  }`}
                  style={{ width: PCT(gross > 0 ? (pagado / gross) * 100 : 0) }}
                />
                <div
                  className="absolute inset-y-0 w-px bg-foreground/50"
                  style={{ left: PCT(gross > 0 ? (base / gross) * 100 : 0) }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Honorario {formatJus(base)}</span>
                <span>Zona impuestos hasta {formatJus(gross)}</span>
              </div>
            </div>

            {/* Where the case stands. */}
            <div className="grid grid-cols-3 gap-3 rounded-md border p-4">
              <Summary label="Cobrado" valueJus={pagado} jusValue={jusValue} />
              <Summary
                label="Restante honorario"
                valueJus={pendienteBase}
                jusValue={jusValue}
                tone={pendienteBase > 0 ? "warn" : "ok"}
              />
              <Summary
                label="Restante c/ IVA y aportes"
                valueJus={pendienteGross}
                jusValue={jusValue}
                tone={pendienteGross > 0 ? "warn" : "ok"}
              />
            </div>

            {pagado > 0 && (
              <p className="text-xs text-muted-foreground">
                De lo cobrado: {formatJus(cobradoSplit.base)} honorario +{" "}
                {formatJus(cobradoSplit.iva)} IVA + {formatJus(cobradoSplit.aportes)}{" "}
                aportes.
              </p>
            )}
          </div>
        )}

        {honorario && !isPaid && (
          <HonorariosAddPagoForm
            honorarioId={honorario.id!}
            jusValue={jusValue}
            pendienteGrossJus={pendienteGross}
          />
        )}

        {pagos.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Pagos recibidos</h3>
            <ul className="divide-y rounded-md border">
              {pagos.map((p) => {
                const split = splitGross(p.monto_jus);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between px-4 py-2 text-sm"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {formatJus(p.monto_jus)} · {formatArs(p.monto_ars)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatJus(split.base)} + IVA {formatJus(split.iva)} + aportes{" "}
                        {formatJus(split.aportes)}
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
                );
              })}
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
  strong,
}: {
  label: string;
  valueJus: number;
  jusValue: number;
  tone?: "warn" | "ok";
  strong?: boolean;
}) {
  const toneClass =
    tone === "warn" ? "text-orange-600" : tone === "ok" ? "text-emerald-600" : "";
  return (
    <div className={toneClass}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`tabular-nums ${strong ? "text-base font-bold" : "font-semibold"}`}>
        {formatJus(valueJus)}
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        ≈ {formatArs(jusToArs(valueJus, jusValue))}
      </div>
    </div>
  );
}
