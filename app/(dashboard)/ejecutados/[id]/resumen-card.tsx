import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCobrosTotals } from "@/lib/data/cobros";
import { getHonorarioWithBalance, getJusValue } from "@/lib/data/honorarios";
import { formatMonedaAr } from "@/lib/domain/moneda-ar";
import { remainingGrossJus, formatJus } from "@/lib/domain/honorarios";
import { type Tables } from "@/lib/supabase/db-helpers";

/**
 * The money column's four figures. They do not add up: the first three are the
 * debtor's ledger in pesos, honorarios is the firm's in JUS, so it sits apart.
 */
export async function ResumenCard({
  ejecutadoId,
  ejecutado,
}: {
  ejecutadoId: string;
  ejecutado: Tables<"ejecutados">;
}) {
  const supabase = await createClient();

  const [{ data: liq }, cobros, honorario, jusValue] = await Promise.all([
    supabase
      .from("liquidaciones")
      .select("monto_adeudado, fecha_hasta")
      .eq("ejecutado_id", ejecutadoId)
      .is("archived_at", null)
      .maybeSingle(),
    getCobrosTotals(supabase, ejecutadoId),
    getHonorarioWithBalance(supabase, ejecutadoId),
    getJusValue(supabase),
  ]);

  const reclamado = Number(ejecutado.deuda_inicial ?? 0);
  const liquidado = liq ? Number(liq.monto_adeudado ?? 0) : null;
  const cobrado = Number(cobros?.total_proveido ?? 0);
  const dineroEnCuenta = Number(ejecutado.dinero_en_cuenta ?? 0);

  const baseJus = Number(honorario?.monto_total_jus ?? 0);
  const pagadoJus = Number(honorario?.pagado_jus ?? 0);
  const pendienteJus = baseJus > 0 ? remainingGrossJus(baseJus, pagadoJus) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="@container/cifras grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 @sm/cifras:grid-cols-3">
          <Cifra label="Reclamado" value={`$${formatMonedaAr(reclamado)}`} />
          <Cifra
            label="Liquidado"
            value={liquidado === null ? "—" : `$${formatMonedaAr(liquidado)}`}
            muted={liquidado === null}
            // No fecha_mora means no liquidación; a bare dash reads as a bug.
            hint={liquidado === null ? "Falta la fecha de mora" : undefined}
          />
          <Cifra
            label="Cobrado"
            value={`$${formatMonedaAr(cobrado)}`}
            muted={cobrado === 0}
          />
        </div>

        {/* Different debtor, different unit. */}
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Honorarios pendientes</p>
          <p className="font-heading text-lg font-semibold tabular-nums">
            {pendienteJus === null ? (
              <span className="text-muted-foreground">Sin honorario cargado</span>
            ) : (
              <>
                {formatJus(pendienteJus)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ≈ ${formatMonedaAr(pendienteJus * jusValue)}
                </span>
              </>
            )}
          </p>
        </div>

        {dineroEnCuenta > 0 && (
          <p className="text-xs text-muted-foreground">
            Dinero en cuenta por el embargo:{" "}
            <span className="font-medium text-foreground tabular-nums">
              ${formatMonedaAr(dineroEnCuenta)}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Cifra({
  label,
  value,
  muted = false,
  hint,
}: {
  label: string;
  value: string;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`font-heading text-base font-semibold tabular-nums ${
          muted ? "text-muted-foreground" : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
