import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rankEscritos } from "@/lib/domain/escritos-scorer";
import {
  REASON_LABELS,
  type EscritoSignalState,
  type MedidaCautelar,
} from "@/lib/domain/escritos";
import { type Movimiento } from "@/lib/domain/ejecutado";
import { generarEscrito } from "../ejecutados/[id]/escritos-actions";

const FEED_LIMIT = 12;
const PER_CARD = 3;

export default async function EscritosPage() {
  const supabase = await createClient();

  const { data: ejecutados, error } = await supabase
    .from("ejecutados")
    .select("id, nombre, numero_expediente, movimiento, medida_cautelar, diligenciada")
    .is("archived_at", null)
    .eq("is_draft", false)
    .order("updated_at", { ascending: false })
    .limit(FEED_LIMIT);

  if (error) throw error;

  const ids = (ejecutados ?? []).map((e) => e.id);

  const [{ data: templates }, { data: eventos }, { data: liqs }] =
    await Promise.all([
      supabase
        .from("escritos_templates")
        .select("*")
        .is("archived_at", null)
        .order("orden", { ascending: true }),
      ids.length
        ? supabase
            .from("ejecutado_eventos")
            .select("ejecutado_id, tipo_evento, created_at")
            .in("ejecutado_id", ids)
            .eq("aplicado", true)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as { ejecutado_id: string; tipo_evento: string }[] }),
      ids.length
        ? supabase
            .from("liquidaciones")
            .select("ejecutado_id")
            .in("ejecutado_id", ids)
            .is("archived_at", null)
        : Promise.resolve({ data: [] as { ejecutado_id: string }[] }),
    ]);

  const ultimoEvento = new Map<string, string>();
  for (const ev of eventos ?? []) {
    if (!ultimoEvento.has(ev.ejecutado_id)) {
      ultimoEvento.set(ev.ejecutado_id, ev.tipo_evento);
    }
  }
  const conLiquidacion = new Set((liqs ?? []).map((l) => l.ejecutado_id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Escritos</h1>
        <p className="text-sm text-muted-foreground">
          Ejecutados con actividad reciente y los escritos recomendados para su
          estado actual.
        </p>
      </div>

      {ejecutados && ejecutados.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ejecutados.map((ej) => {
            const state: EscritoSignalState = {
              movimiento: (ej.movimiento ?? null) as Movimiento | null,
              medida_cautelar: (ej.medida_cautelar ?? null) as MedidaCautelar | null,
              diligenciada: ej.diligenciada ?? null,
              ultimo_evento: ultimoEvento.get(ej.id) ?? null,
              tiene_liquidacion: conLiquidacion.has(ej.id),
            };
            const recomendados = rankEscritos(templates ?? [], state)
              .filter((t) => t.recomendado)
              .slice(0, PER_CARD);
            const generate = generarEscrito.bind(null, ej.id);

            return (
              <Card key={ej.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">
                    <Link href={`/ejecutados/${ej.id}`} className="hover:underline">
                      {ej.nombre}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {[
                      ej.movimiento ?? null,
                      ej.numero_expediente ? `Expte. ${ej.numero_expediente}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos de etapa"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2">
                  {recomendados.length > 0 ? (
                    <ul className="space-y-2">
                      {recomendados.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-start justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 p-2"
                        >
                          <div className="min-w-0 space-y-1">
                            <span className="text-sm font-medium">{t.titulo}</span>
                            {t.reasons.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {t.reasons.map((r) => (
                                  <Badge key={r} variant="outline" className="text-[10px]">
                                    {REASON_LABELS[r] ?? r}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <form action={generate}>
                            <input type="hidden" name="template_id" value={t.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Generar
                            </Button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sin recomendaciones para el estado actual.
                    </p>
                  )}
                  <Link
                    href={`/ejecutados/${ej.id}`}
                    className="mt-auto pt-1 text-sm text-primary hover:underline"
                  >
                    Ver todos los escritos →
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border py-8 text-center text-muted-foreground">
          Aún no hay ejecutados activos. Creá uno para ver escritos recomendados.
        </div>
      )}
    </div>
  );
}
