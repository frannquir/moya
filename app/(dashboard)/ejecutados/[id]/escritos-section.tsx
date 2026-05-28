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
  MEDIDA_CAUTELAR_LABELS,
  type EscritoSignalState,
  type MedidaCautelar,
} from "@/lib/domain/escritos";
import { type Movimiento } from "@/lib/domain/ejecutado";
import { generarEscrito } from "./escritos-actions";

export async function EscritosSection({ ejecutadoId }: { ejecutadoId: string }) {
  const supabase = await createClient();

  const { data: ej } = await supabase
    .from("ejecutados")
    .select("movimiento, medida_cautelar, diligenciada")
    .eq("id", ejecutadoId)
    .single();

  const [{ data: templates }, { data: ultEvento }, { data: liq }] =
    await Promise.all([
      supabase
        .from("escritos_templates")
        .select("*")
        .is("archived_at", null)
        .order("orden", { ascending: true }),
      supabase
        .from("ejecutado_eventos")
        .select("tipo_evento")
        .eq("ejecutado_id", ejecutadoId)
        .eq("aplicado", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("liquidaciones")
        .select("id")
        .eq("ejecutado_id", ejecutadoId)
        .is("archived_at", null)
        .maybeSingle(),
    ]);

  const state: EscritoSignalState = {
    movimiento: (ej?.movimiento ?? null) as Movimiento | null,
    medida_cautelar: (ej?.medida_cautelar ?? null) as MedidaCautelar | null,
    diligenciada: ej?.diligenciada ?? null,
    ultimo_evento: ultEvento?.tipo_evento ?? null,
    tiene_liquidacion: !!liq,
  };

  const ranked = rankEscritos(templates ?? [], state);
  const generate = generarEscrito.bind(null, ejecutadoId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Escritos</CardTitle>
        <CardDescription>
          Ordenados por relevancia para el estado actual del ejecutado. Los{" "}
          <strong>Recomendados</strong> coinciden con la etapa y las señales; el
          resto queda disponible más abajo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <SignalChip label="Etapa" value={state.movimiento ?? "—"} />
          <SignalChip
            label="Medida"
            value={
              state.medida_cautelar
                ? MEDIDA_CAUTELAR_LABELS[state.medida_cautelar]
                : "—"
            }
          />
          <SignalChip
            label="Diligenciada"
            value={
              state.diligenciada === true
                ? "Sí"
                : state.diligenciada === false
                  ? "No"
                  : "—"
            }
          />
          <SignalChip label="Último evento" value={state.ultimo_evento ?? "—"} />
        </div>

        <ul className="space-y-2">
          {ranked.map((t, i) => {
            const isTop = i < 3 && t.recomendado;
            return (
              <li
                key={t.id}
                className={`flex items-start justify-between gap-3 rounded-md border p-3 ${
                  t.recomendado ? "border-primary/40 bg-primary/5" : ""
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.titulo}</span>
                    {t.recomendado && (
                      <Badge variant={isTop ? "default" : "secondary"}>
                        Recomendado
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{t.categoria}</div>
                  {t.reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {t.reasons.map((r) => (
                        <Badge key={r} variant="outline">
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
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function SignalChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border px-2 py-0.5">
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}
