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
    .select("movimiento, medida_cautelar, movimiento_diligenciada")
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
    diligenciada: ej?.movimiento_diligenciada ?? null,
    ultimo_evento: ultEvento?.tipo_evento ?? null,
    tiene_liquidacion: !!liq,
  };

  const ranked = rankEscritos(templates ?? [], state);
  const generate = generarEscrito.bind(null, ejecutadoId);

  const recomendados = ranked.filter((t) => t.recomendado);
  const resto = ranked.filter((t) => !t.recomendado);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Escritos</CardTitle>
        <CardDescription>
          Los <strong>Recomendados</strong> coinciden con la etapa y las señales del
          ejecutado. El resto queda disponible en «Ver todos».
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

        {recomendados.length > 0 ? (
          <ul className="space-y-2">
            {recomendados.map((t) => (
              <EscritoItem key={t.id} t={t} generate={generate} recomendado />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ningún escrito coincide con el estado actual; elegí uno de la lista
            completa.
          </p>
        )}

        {resto.length > 0 && (
          <details className="group rounded-md border">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              Ver todos los escritos ({resto.length})
            </summary>
            <ul className="space-y-2 p-3 pt-0">
              {resto.map((t) => (
                <EscritoItem key={t.id} t={t} generate={generate} />
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function EscritoItem({
  t,
  generate,
  recomendado = false,
}: {
  t: { id: string; titulo: string; categoria: string; reasons: string[] };
  generate: (formData: FormData) => void;
  recomendado?: boolean;
}) {
  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-md border p-3 ${
        recomendado ? "border-primary/40 bg-primary/5" : ""
      }`}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t.titulo}</span>
          {recomendado && <Badge>Recomendado</Badge>}
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
}

function SignalChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border px-2 py-0.5">
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}
