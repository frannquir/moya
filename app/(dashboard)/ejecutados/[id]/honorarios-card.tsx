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
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import {
  HONORARIO_JUS_DEFAULT,
  IVA_RATE,
  APORTES_RATE,
  composeGross,
  formatJus,
  formatArs,
  formatArsExacto,
  jusToArs,
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
 * ceiling. Each in JUS — the unit the arancel is written in — and in pesos at
 * today's value, which is the figure anyone actually acts on. Everything else
 * the card used to carry (progress bar, pendiente split, per-pago breakdowns)
 * was arithmetic nobody read; the two knobs moved into the Editar dialog.
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
          <Fila label="Honorario" jus={comp.base} jusValue={jusValue} />
          <Fila
            label={`IVA ${Math.round(IVA_RATE * 100)}%`}
            jus={comp.iva}
            jusValue={jusValue}
          />
          <Fila
            label={`Aportes ${Math.round(APORTES_RATE * 100)}%`}
            jus={comp.aportes}
            jusValue={jusValue}
          />
          <ItemSeparator className="my-0" />
          {/* A settled figure replaces the arancel's ceiling outright, including
              below it (a quita). It is exact pesos, so it prints to the centavo
              and carries no JUS equivalent — converting one back would invent
              precision the agreement never had. */}
          {techo.tipo === "acordado" ? (
            <Fila label="Máximo acordado" ars={techo.capArs} exacto strong />
          ) : (
            <Fila
              label="Máximo a cobrar"
              jus={comp.total}
              jusValue={jusValue}
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
 * One line of the breakdown: label, the JUS figure muted, the pesos.
 *
 * Pass `jus` for anything the arancel denominates, and the pesos are derived at
 * today's value; pass `ars` for a figure that is natively pesos. The peso column
 * is fixed-width so the four lines align whether or not a JUS figure sits beside
 * them.
 */
function Fila({
  label,
  jus,
  jusValue,
  ars,
  strong,
  // Exact when the figure is a real peso amount; rounded when it is JUS
  // converted at today's value, which is an estimate however many decimals it
  // is printed with.
  exacto,
}: {
  label: string;
  jus?: number;
  jusValue?: number;
  ars?: number;
  strong?: boolean;
  exacto?: boolean;
}) {
  const pesos = ars ?? jusToArs(jus ?? 0, jusValue ?? 0);
  return (
    <Item>
      <ItemContent>
        <ItemTitle className={strong ? "font-semibold" : "font-normal"}>
          {label}
        </ItemTitle>
      </ItemContent>
      <ItemActions className="tabular-nums">
        {jus !== undefined && (
          <span className="text-xs text-muted-foreground">{formatJus(jus)}</span>
        )}
        <span className={`w-32 text-right ${strong ? "font-semibold" : ""}`}>
          {exacto ? formatArsExacto(pesos) : formatArs(pesos)}
        </span>
      </ItemActions>
    </Item>
  );
}
