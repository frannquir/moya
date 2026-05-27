import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { createEjecutado } from "./actions";

export default function NewEjecutadoPage() {
  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo ejecutado</CardTitle>
        </CardHeader>
        <form action={createEjecutado}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" name="nombre" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero_expediente">N° de expediente</Label>
                <Input id="numero_expediente" name="numero_expediente" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deuda_inicial">Deuda inicial (ARS)</Label>
                <Input
                  id="deuda_inicial"
                  name="deuda_inicial"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={0}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="juzgado">Juzgado</Label>
                <Input id="juzgado" name="juzgado" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departamento">Departamento</Label>
                <Input id="departamento" name="departamento" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="movimiento">Movimiento</Label>
              <Select name="movimiento">
                <SelectTrigger id="movimiento">
                  <SelectValue placeholder="Sin movimiento" />
                </SelectTrigger>
                <SelectContent>
                  {MOVIMIENTO_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea id="observaciones" name="observaciones" rows={4} />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button variant="outline" asChild type="button">
              <Link href="/ejecutados">Cancelar</Link>
            </Button>
            <Button type="submit">Crear</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}