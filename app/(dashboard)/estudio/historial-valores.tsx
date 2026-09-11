"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatArDate } from "@/lib/domain/dates";
import { formatArs } from "@/lib/domain/honorarios";
import {
  type ConfigHistorialEntry,
  type JusValue,
  type TasaValue,
} from "@/lib/data/config";
import { restaurarValor, type ValoresState } from "./actions";

const EMPTY: ValoresState = { ok: null, error: null };

/**
 * Every change to the JUS and to the BCRA rates, and a way back to any of them.
 *
 * Both values are global — one wrong digit moves money on every escrito of every
 * estudio — and both were edited by hand over SQL for months with no record of
 * who or what. The rows come from DB triggers, so an edit made outside the app
 * shows up here too (as an author-less entry, which is the point).
 */
export function HistorialValores({ entradas }: { entradas: ConfigHistorialEntry[] }) {
  // One action for the whole list: each row's button posts its own id, the same
  // way the pago form's two submits share one action. A per-row useActionState
  // would give each row a feedback slot that is empty 29 times out of 30.
  const [state, action, pending] = useActionState(restaurarValor, EMPTY);

  if (entradas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay cambios registrados.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {(state.ok || state.error) && (
        <Alert variant={state.error ? "destructive" : "default"}>
          <AlertDescription>{state.error ?? state.ok}</AlertDescription>
        </Alert>
      )}

      <ul className="divide-y rounded-md border">
        {entradas.map((e) => (
          <li
            key={e.id}
            className="@container flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{e.tipo === "jus" ? "JUS" : "Tasa"}</Badge>
                <span className="font-medium">{e.etiqueta}</span>
              </div>
              <div className="mt-0.5 tabular-nums text-muted-foreground">
                {describir(e.tipo, e.anterior)} → {describir(e.tipo, e.nuevo)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatArDate(e.cuando.slice(0, 10))}
                {/* '' means no auth.uid(): a SQL or service-role edit. Saying so
                    is more useful than leaving the line blank. */}
                {e.porNombre ? ` · ${e.porNombre}` : " · fuera de la app"}
              </div>
            </div>

            {e.restaurable ? (
              <Button
                type="submit"
                name="historial_id"
                value={e.id}
                size="sm"
                variant="outline"
                disabled={pending}
              >
                Restaurar
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">sin valor previo</span>
            )}
          </li>
        ))}
      </ul>
    </form>
  );
}

function describir(
  tipo: "jus" | "tasa",
  valor: JusValue | TasaValue | null,
): string {
  if (!valor) return "—";
  if (tipo === "jus") {
    const v = valor as JusValue;
    return formatArs(Number(v.value));
  }
  const v = valor as TasaValue;
  // Only what the month actually has: the 303 rows loaded before 2026-09-05 hold
  // Fin. Saldos alone, and printing three dashes after it reads as data loss.
  const nums = [v.tna, v.ints_punitorios, v.tea, v.cft].filter((n) => n !== null);
  return nums.map((n) => Number(n).toLocaleString("es-AR")).join(" · ");
}
