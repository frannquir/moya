import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  formatCurrency,
  isClampedEnd,
  getUltimaTasa,
  sortTasasChronological,
  type TasaRow,
} from "@/lib/domain/liquidaciones";
import { parseLocalDate } from "@/lib/domain/dates";
import { LiquidacionDownloadButton } from "../../../../components/liquidacion-download-button";

export async function LiquidacionesSection({
  ejecutadoId,
}: {
  ejecutadoId: string;
}) {
  const supabase = await createClient();

  const [{ data: liq }, { data: tasaRows }] = await Promise.all([
    supabase
      .from("liquidaciones")
      .select("*")
      .eq("ejecutado_id", ejecutadoId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase.from("bcra_tasas").select("mes, anio, tna"),
  ]);

  const tasas = sortTasasChronological((tasaRows ?? []) as TasaRow[]);
  const clamped = !!liq && isClampedEnd(parseLocalDate(liq.fecha_hasta), tasas);
  const ultima = getUltimaTasa(tasas);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liquidación</CardTitle>
        <CardDescription>
          Se recalcula sola al guardar los datos del ejecutado (requiere fecha desde y deuda inicial).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!liq ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay liquidación. Completá <strong>Fecha desde</strong> y{" "}
            <strong>Deuda inicial</strong> arriba y guardá para generarla.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-md border p-4 bg-muted/30">
              <Money label="Capital" value={liq.capital} />
              <Money label="Intereses" value={liq.total_intereses} />
              <Money label="IVA (21%)" value={liq.iva} />
              <Money label="Gastos" value={liq.gastos} />
              <Money label="Monto adeudado" value={liq.monto_adeudado} highlight />
            </div>

            <div className="text-xs text-muted-foreground">
              Período: {fmtDate(liq.fecha_desde)} → {fmtDate(liq.fecha_hasta)}
            </div>

            {clamped && ultima && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Faltan tasas posteriores a {ultima.mes.toLowerCase()} {ultima.anio};
                el cálculo usa la última disponible. Cargá las tasas nuevas para
                un resultado exacto.
              </div>
            )}

            <LiquidacionDownloadButton
              input={{
                cuenta: liq.cuenta,
                apynom: liq.apellido_nombre,
                fechaDesde: liq.fecha_desde,
                fechaHasta: liq.fecha_hasta,
                capital: Number(liq.capital),
                gastos: Number(liq.gastos),
              }}
              tasas={tasas}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Money({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "text-primary" : ""}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`tabular-nums ${highlight ? "text-lg font-bold" : "font-semibold"}`}>
        ${formatCurrency(Number(value))}
      </div>
    </div>
  );
}

function fmtDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("es-AR");
}