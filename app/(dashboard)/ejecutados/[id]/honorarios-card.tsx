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
  HONORARIO_JUS_DEFAULT,
  IVA_RATE,
  APORTES_RATE,
  formatJus,
  formatArs,
  formatArsExacto,
  jusToArs,
  grossCapJus,
  techoHonorario,
  splitGross,
  remainingJus,
} from "@/lib/domain/honorarios";
import { formatArDate } from "@/lib/domain/dates";
import {
  getHonorarioWithBalance,
  listHonorarioPagos,
} from "@/lib/data/honorarios";
import { getJusConfig } from "@/lib/data/config";
import { archivePago } from "./honorarios-actions";
import { HonorariosMontoForm } from "./honorarios-monto-form";
import { HonorariosAddPagoForm } from "./honorarios-add-pago-form";

const PCT = (n: number) => `${Math.max(0, Math.min(100, n))}%`;

export async function HonorariosCard({ ejecutadoId }: { ejecutadoId: string }) {
  const supabase = await createClient();

  const [honorario, jusConfig] = await Promise.all([
    getHonorarioWithBalance(supabase, ejecutadoId),
    getJusConfig(supabase),
  ]);
  const pagos = honorario ? await listHonorarioPagos(supabase, honorario.id!) : [];

  const jusValue = jusConfig?.value ?? 0;

  // A honorario exists for every ejecutado since 20260905120000 (trigger +
  // backfill). The fallback only covers a row archived by hand; the form's
  // upsert recreates it on save.
  const base = honorario?.monto_total_jus ?? HONORARIO_JUS_DEFAULT;
  const maxAcordado = honorario?.max_acordado_ars ?? null;
  const pagado = honorario?.pagado_jus ?? 0;
  const pagadoArs = honorario?.pagado_ars ?? 0;

  // Legal ceiling (base + IVA + aportes) vs. the one that actually applies.
  // The negotiated one is in pesos, the arancel's in JUS — techoHonorario
  // resolves both and hands back each in the unit it belongs in.
  const capLegal = grossCapJus(base);
  const techo = techoHonorario({
    baseJus: base,
    maxAcordadoArs: maxAcordado,
    pagadoJus: pagado,
    pagadoArs,
    jusValue,
  });
  const cap = techo.capArs;
  const pendienteBase = remainingJus(base, pagado);
  const pendiente = techo.pendienteArs;

  const baseCubierto = base > 0 && pendienteBase <= 0;
  const isPaid = cap > 0 && pendiente <= 0;

  // The bar is drawn as fractions of the ceiling, computed in the ceiling's own
  // unit so a negotiated peso cap never gets compared against JUS collected.
  const frac = (parte: number, todo: number) =>
    todo > 0 ? Math.min(1, Math.max(0, parte / todo)) : 0;
  const progreso =
    techo.tipo === "acordado"
      ? frac(pagadoArs, techo.capArs)
      : frac(pagado, techo.capJus ?? 0);
  // Where the fee itself ends and the tax begins. Past that tick every peso
  // coming in is IVA + aportes; on a quita the tick falls off the end.
  const baseFrac =
    techo.tipo === "acordado"
      ? frac(jusToArs(base, jusValue), techo.capArs)
      : frac(base, techo.capJus ?? 0);

  // The breakdown of what has actually come in, in pesos.
  //
  // splitGross() divides by the same 1.31 whatever the unit, so it is applied to
  // the pesos received directly rather than to the JUS and then converted: the
  // three parts then reconcile to the exact peso total the firm banked, and no
  // historical payment is re-valued at today's JUS.
  const cobradoSplit = splitGross(pagadoArs);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Honorarios
          {isPaid ? (
            <Badge variant="success">Pagado</Badge>
          ) : (
            baseCubierto && <Badge variant="outline">Honorario cubierto</Badge>
          )}
          {maxAcordado != null && <Badge variant="outline">Acordado</Badge>}
        </CardTitle>
        <CardDescription>
          Valor JUS: {formatArs(jusValue)}
          {jusConfig?.date && ` · vigente desde ${formatArDate(jusConfig.date)}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <HonorariosMontoForm
          ejecutadoId={ejecutadoId}
          montoJus={base}
          maxAcordadoArs={maxAcordado}
          jusValue={jusValue}
          pagadoJus={pagado}
          pagadoArs={pagadoArs}
        />

        {honorario && (
          <div className="space-y-4">
            {/* Progress toward the ceiling that applies, with the fee itself
                marked: past that tick, what is coming in is tax. When a lower
                figure was settled the tick falls off the end and is hidden —
                every peso of a quita is fee. */}
            <div className="space-y-2">
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                {baseFrac < 1 && (
                  <div
                    className="absolute inset-y-0 right-0 bg-foreground/10"
                    style={{ left: PCT(baseFrac * 100) }}
                  />
                )}
                <div
                  className={`absolute inset-y-0 left-0 ${
                    isPaid ? "bg-success" : "bg-primary"
                  }`}
                  style={{ width: PCT(progreso * 100) }}
                />
                {baseFrac < 1 && (
                  <div
                    className="absolute inset-y-0 w-px bg-foreground/50"
                    style={{ left: PCT(baseFrac * 100) }}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Honorario {formatJus(base)}</span>
                <span>
                  {maxAcordado != null ? "Acordado" : "Máximo"}{" "}
                  {maxAcordado != null ? formatArsExacto(cap) : formatArs(cap)}
                </span>
              </div>
            </div>

            {/* Where the case stands. Container-relative, not viewport: this card
                sits in the detail page's secondary rail, so the column count has
                to follow the card's width. */}
            <div className="@container grid grid-cols-1 gap-3 rounded-md border p-4 @xs:grid-cols-3">
              <Summary label="Cobrado" valueArs={pagadoArs} exacto />
              <Summary
                label="Restante honorario"
                valueArs={jusToArs(pendienteBase, jusValue)}
                tone={pendienteBase > 0 ? "warn" : "ok"}
              />
              <Summary
                label="Restante total"
                valueArs={pendiente}
                tone={pendiente > 0 ? "warn" : "ok"}
                exacto={techo.tipo === "acordado"}
              />
            </div>

            {maxAcordado != null && (
              <p className="text-xs text-muted-foreground">
                Máximo acordado con el ejecutado: {formatArsExacto(cap)}. El tope legal
                es {formatArs(jusToArs(capLegal, jusValue))} ({formatJus(capLegal)}).
              </p>
            )}

            {/* What was collected, broken out the way the firm needs it for the
                factura: the fee, the two taxes on it, and the total banked. */}
            {pagadoArs > 0 && (
              <dl className="rounded-md border text-sm">
                <Desglose label="Honorarios" ars={cobradoSplit.base} />
                <Desglose
                  label={`IVA ${Math.round(IVA_RATE * 100)}%`}
                  ars={cobradoSplit.iva}
                />
                <Desglose
                  label={`Aportes ${Math.round(APORTES_RATE * 100)}%`}
                  ars={cobradoSplit.aportes}
                />
                <Desglose label="TOTAL" ars={pagadoArs} strong borderTop />
              </dl>
            )}
          </div>
        )}

        {honorario && !isPaid && (
          <HonorariosAddPagoForm
            honorarioId={honorario.id!}
            jusValue={jusValue}
            pendienteArs={pendiente}
          />
        )}

        {pagos.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Pagos recibidos</h3>
            <ul className="divide-y rounded-md border">
              {pagos.map((p) => {
                const split = splitGross(p.monto_ars);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between px-4 py-2 text-sm"
                  >
                    <div className="flex-1">
                      {/* monto_ars as recorded, not jus x today's value: a pago
                          from an older JUS must keep the pesos that came in. */}
                      <div className="font-medium">{formatArsExacto(p.monto_ars)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatArsExacto(split.base)} + IVA {formatArsExacto(split.iva)}{" "}
                        + aportes {formatArsExacto(split.aportes)}
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

function Desglose({
  label,
  ars,
  strong,
  borderTop,
}: {
  label: string;
  ars: number;
  strong?: boolean;
  borderTop?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between px-3 py-1.5 ${
        borderTop ? "border-t" : ""
      }`}
    >
      <dt className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""}`}>
        {formatArsExacto(ars)}
      </dd>
    </div>
  );
}

// Pesos only. The client reads these three figures to know where a case stands
// and asked not to see JUS on anything derived — JUS stays on the regulated fee,
// which is the one number the arancel actually denominates.
function Summary({
  label,
  valueArs,
  tone,
  // Exact when the figure is a real peso amount (collected, or a settled
  // ceiling); rounded when it is a JUS figure converted at today's value, which
  // is an estimate however many decimals it is printed with.
  exacto,
}: {
  label: string;
  valueArs: number;
  tone?: "warn" | "ok";
  exacto?: boolean;
}) {
  const toneClass =
    tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : "";
  return (
    <div className={toneClass}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="tabular-nums font-semibold">
        {exacto ? formatArsExacto(valueArs) : formatArs(valueArs)}
      </div>
    </div>
  );
}
