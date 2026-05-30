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
import {
  getConfiguredDepartamentos,
  getConfiguredEmpresas,
  type EstudioEscritosConfig,
} from "@/lib/domain/escritos-config";
import { updateEjecutado, archiveEjecutado } from "./actions";
import { CobrosCard } from "./cobros-card";
import { HonorariosCard } from "./honorarios-card";
import { LiquidacionesSection } from "./liquidaciones-section";
import { EscritosSection } from "./escritos-section";
import { Badge } from "@/components/ui/badge";
import { activarBorrador, moverABorrador } from "../../borradores/actions";

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

  const { data: estudioRow } = await supabase
    .from("estudios")
    .select("escritos_config")
    .eq("id", ejecutado.estudio_id)
    .maybeSingle();
  const escritosConfig = (estudioRow?.escritos_config ?? {}) as EstudioEscritosConfig;
  const departamentos = getConfiguredDepartamentos(escritosConfig);
  const depOptions =
    ejecutado.departamento && !departamentos.includes(ejecutado.departamento)
      ? [...departamentos, ejecutado.departamento]
      : departamentos;

  const empresas = getConfiguredEmpresas(escritosConfig);
  const empresaOptions =
    ejecutado.empresa && !empresas.includes(ejecutado.empresa)
      ? [...empresas, ejecutado.empresa]
      : empresas;

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
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-semibold">{ejecutado.nombre}</h1>
            {ejecutado.is_draft && <Badge variant="secondary">Borrador</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ejecutado.is_draft ? (
            <form action={activarBorrador.bind(null, id)}>
              <Button type="submit">Activar</Button>
            </form>
          ) : (
            <form action={moverABorrador.bind(null, id)}>
              <Button type="submit" variant="outline">Mover a borrador</Button>
            </form>
          )}
          <form action={archiveAction}>
            <Button type="submit" variant="outline">Archivar</Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
          <CardDescription>
            Editá los datos del ejecutado. Los cambios se guardan al hacer clic en «Guardar».
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
                <Label htmlFor="fecha_mora">Fecha de mora (desde)</Label>
                <Input
                  id="fecha_mora"
                  name="fecha_mora"
                  type="date"
                  defaultValue={ejecutado.fecha_mora ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_deuda">Fecha de deuda (hasta)</Label>
                <Input
                  id="fecha_deuda"
                  name="fecha_deuda"
                  type="date"
                  defaultValue={ejecutado.fecha_deuda ?? ""}
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
                <Select name="departamento" defaultValue={ejecutado.departamento || "__none__"}>
                  <SelectTrigger id="departamento">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin departamento</SelectItem>
                    {depOptions.map((dep) => (
                      <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="medida_cautelar">Medida cautelar</Label>
                <Select name="medida_cautelar" defaultValue={ejecutado.medida_cautelar ?? "__none__"}>
                  <SelectTrigger id="medida_cautelar">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin definir</SelectItem>
                    <SelectItem value="embargo">Embargo</SelectItem>
                    <SelectItem value="igb">IGB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="diligenciada">Diligenciada</Label>
                <Select
                  name="diligenciada"
                  defaultValue={
                    ejecutado.diligenciada === true
                      ? "si"
                      : ejecutado.diligenciada === false
                        ? "no"
                        : "__unknown__"
                  }
                >
                  <SelectTrigger id="diligenciada">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unknown__">Sin definir</SelectItem>
                    <SelectItem value="si">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa</Label>
                <Select name="empresa" defaultValue={ejecutado.empresa || "__none__"}>
                  <SelectTrigger id="empresa">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin definir</SelectItem>
                    {empresaOptions.map((emp) => (
                      <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
      <EscritosSection ejecutadoId={id} />
      <HonorariosCard ejecutadoId={id} />
      <CobrosCard ejecutadoId={id} />
    </div>
  );
}