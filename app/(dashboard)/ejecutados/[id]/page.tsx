import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOVIMIENTO_OPTIONS } from "@/lib/domain/ejecutado";
import { updateEjecutado, archiveEjecutado } from "./actions";
import { CobrosCard } from "./cobros-card";
import { HonorariosCard } from "./honorarios-card";
import { LiquidacionesSection } from "./liquidaciones-section";

export default async function EjecutadoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: ejecutado } = await supabase
    .from("ejecutados")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (!ejecutado) notFound();

  const updateAction = updateEjecutado.bind(null, id);
  const archiveAction = archiveEjecutado.bind(null, id);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/ejecutados"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Ejecutados
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{ejecutado.nombre}</h1>
        </div>
        <form action={archiveAction}>
          <Button type="submit" variant="outline">Archivar</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
          <CardDescription>
            Editá los datos del ejecutado. Los cambios se guardan al hacer clic en "Guardar".
          </CardDescription>
        </CardHeader>
        <form action={updateAction}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" name="nombre" defaultValue={ejecutado.nombre} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero_expediente">N° de expediente</Label>
                <Input id="numero_expediente" name="numero_expediente" defaultValue={ejecutado.numero_expediente} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deuda_inicial">Deuda inicial (ARS)</Label>
                <Input id="deuda_inicial" name="deuda_inicial" type="number" step="0.01" min="0" defaultValue={ejecutado.deuda_inicial} />
              </div>
                          <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_desde">Fecha desde (vto.)</Label>
                <Input
                  id="fecha_desde"
                  name="fecha_desde"
                  type="date"
                  defaultValue={ejecutado.fecha_desde ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_hasta">Fecha hasta</Label>
                <Input
                  id="fecha_hasta"
                  name="fecha_hasta"
                  type="date"
                  defaultValue={ejecutado.fecha_hasta ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gastos">Gastos (ARS)</Label>
                <Input
                  id="gastos"
                  name="gastos"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={ejecutado.gastos ?? 0}
                />
              </div>
            </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="juzgado">Juzgado</Label>
                <Input id="juzgado" name="juzgado" defaultValue={ejecutado.juzgado} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departamento">Departamento</Label>
                <Input id="departamento" name="departamento" defaultValue={ejecutado.departamento} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="movimiento">Movimiento</Label>
              <Select name="movimiento" defaultValue={ejecutado.movimiento ?? "__none__"}>
                <SelectTrigger id="movimiento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin movimiento</SelectItem>
                  {MOVIMIENTO_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea id="observaciones" name="observaciones" rows={4} defaultValue={ejecutado.observaciones} />
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit">Guardar cambios</Button>
          </CardFooter>
        </form>
      </Card>

      <LiquidacionesSection ejecutadoId={id} />
      <HonorariosCard ejecutadoId={id} />
      <CobrosCard ejecutadoId={id} />
    </div>
  );
}