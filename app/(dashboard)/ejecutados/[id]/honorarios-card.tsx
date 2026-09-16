import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import {
  HONORARIO_JUS_DEFAULT,
  IVA_RATE,
  APORTES_RATE,
  composeGross,
  composeGrossArs,
  formatJus,
  formatArs,
  formatArsExacto,
  techoHonorario,
} from "@/lib/domain/honorarios";
import { formatArDate } from "@/lib/domain/dates";
import { getHonorarioWithBalance } from "@/lib/data/honorarios";
import { getJusConfig } from "@/lib/data/config";
import { HonorariosEditarDialog } from "./honorarios-editar-dialog";
import { HonorariosAddPagoForm } from "./honorarios-add-pago-form";

/**
 * What the firm may charge on this case, and what has come in against it.
 *
 * Four lines and a total: the regulated fee, the two taxes on top of it, the
 * ceiling. Only the first line carries a JUS figure — the JUS is the unit the
 * arancel is written in and the arancel is the fee before tax, so IVA, aportes
 * and the ceiling are pesos and nothing else. Nobody perceives 9,17 JUS.
 * Everything else the card used to carry (progress bar, pendiente split,
 * per-pago breakdowns) was arithmetic nobody read; the two knobs moved into the
 * Editar dialog.
 */
export async function HonorariosCard({ ejecutadoId }: { ejecutadoId: string }) {
  const supabase = await createClient();

  const [honorario, jusConfig] = await Promise.all([
    getHonorarioWithBalance(supabase, ejecutadoId),
    getJusConfig(supabase),
  ]);

  const jusValue = jusConfig?.value ?? 0;

  // A honorario exists for every ejecutado since 20260905120000 (trigger +
  // backfill). The fallback only covers a row archived by hand; the dialog's
  // upsert recreates it on save.
  const base = honorario?.monto_total_jus ?? HONORARIO_JUS_DEFAULT;
  const maxAcordado = honorario?.max_acordado_ars ?? null;
  const pagado = honorario?.pagado_jus ?? 0;
  const pagadoArs = honorario?.pagado_ars ?? 0;

  const comp = composeGross(base);
  // The same four figures in pesos, reconciling to the centavo: the three lines
  // are read as an addition now that only the first one carries a JUS number.
  const pesos = composeGrossArs(base, jusValue);
  // The ceiling that actually applies: the arancel's, or the peso figure settled
  // with the debtor. Mirrors check_honorario_pago_cap().
  const techo = techoHonorario({
    baseJus: base,
    maxAcordadoArs: maxAcordado,
    pagadoJus: pagado,
    pagadoArs,
    jusValue,
  });
  const isPaid = techo.capArs > 0 && techo.pendienteArs <= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Honorarios
          {isPaid && <Badge variant="success">Pagado</Badge>}
          {maxAcordado != null && <Badge variant="outline">Acordado</Badge>}
        </CardTitle>
        <CardDescription>
          Valor JUS: {formatArs(jusValue)}
          {jusConfig?.date && ` · vigente desde ${formatArDate(jusConfig.date)}`}
        </CardDescription>
        <CardAction>
          <HonorariosEditarDialog
            ejecutadoId={ejecutadoId}
            montoJus={base}
            maxAcordadoArs={maxAcordado}
            jusValue={jusValue}
            pagadoJus={pagado}
            pagadoArs={pagadoArs}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <ItemGroup className="rounded-lg border">
          <Fila label="Honorario" baseJus={comp.base} ars={pesos.base} />
          <Fila label={`IVA ${Math.round(IVA_RATE * 100)}%`} ars={pesos.iva} />
          <Fila
            label={`Aportes ${Math.round(APORTES_RATE * 100)}%`}
            ars={pesos.aportes}
          />
          <ItemSeparator className="my-0" />
          {/* A settled figure replaces the arancel's ceiling outright, including
              below it (a quita). Both ceilings print in pesos: one is the exact
              amount agreed, the other is the fee plus the tax the juzgado
              withholds, and neither is a number of JUS anybody collects. */}
          {techo.tipo === "acordado" ? (
            <Fila label="Máximo acordado" ars={techo.capArs} strong />
          ) : (
            <Fila
              label="Máximo a cobrar"
              nota="IVA y aportes incluidos"
              ars={pesos.total}
              strong
            />
          )}
        </ItemGroup>

        <Item variant="muted">
          <ItemContent>
            <ItemTitle className="font-normal text-muted-foreground">Cobrado</ItemTitle>
          </ItemContent>
          <ItemActions>
            <span className="w-32 text-right font-medium tabular-nums">
              {formatArsExacto(pagadoArs)}
            </span>
          </ItemActions>
        </Item>

        {honorario && !isPaid && (
          <HonorariosAddPagoForm
            honorarioId={honorario.id!}
            jusValue={jusValue}
            pendienteArs={techo.pendienteArs}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One line of the breakdown: label, the pesos, and a JUS figure only where one
 * means something.
 *
 * `baseJus` is the regulated fee and nothing else — never a total, never a tax.
 * The peso column is fixed-width so the lines align whether or not a JUS figure
 * sits beside them, and every figure prints to the centavo because the three
 * lines have to visibly add up to the ceiling below them.
 */
function Fila({
  label,
  nota,
  baseJus,
  ars,
  strong,
}: {
  label: string;
  nota?: string;
  baseJus?: number;
  ars: number;
  strong?: boolean;
}) {
  return (
    <Item>
      <ItemContent>
        <ItemTitle className={strong ? "font-semibold" : "font-normal"}>
          {label}
        </ItemTitle>
        {nota && <ItemDescription>{nota}</ItemDescription>}
      </ItemContent>
      <ItemActions className="tabular-nums">
        {baseJus !== undefined && (
          <span className="text-xs text-muted-foreground">{formatJus(baseJus)}</span>
        )}
        <span className={`w-32 text-right ${strong ? "font-semibold" : ""}`}>
          {formatArsExacto(ars)}
        </span>
      </ItemActions>
    </Item>
  );
}
