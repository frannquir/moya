import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type Juzgado } from "@/lib/data/juzgados";

// Read-only court details for a linked ejecutado. Renders nothing when unlinked.
export function JuzgadoInfoCard({ juzgado }: { juzgado: Juzgado | null }) {
  if (!juzgado) return null;

  const rows: Array<[string, string]> = [
    ["Domicilio", juzgado.direccion],
    ["Localidad", juzgado.localidad],
    ["Departamento", juzgado.departamento_judicial],
    ["Teléfono", juzgado.telefono],
    ["Email", juzgado.email],
    ["Juez/a", juzgado.juez],
  ].filter(([, v]) => v && v.trim() !== "") as Array<[string, string]>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{juzgado.organismo}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
