import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatOrganismo, type Juzgado } from "@/lib/data/juzgados";

// Read-only court details for a linked ejecutado. An unlinked case says so
// rather than rendering nothing: the convenio prints [JUZGADO] and the recusación
// cannot fire without a court, and that has to be visible on the case itself. The
// case's own free text, if any, is already in the header strip.
export function JuzgadoInfoCard({ juzgado }: { juzgado: Juzgado | null }) {
  if (!juzgado) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">Sin juzgado</CardTitle>
        </CardHeader>
      </Card>
    );
  }

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
        <CardTitle className="text-base">{formatOrganismo(juzgado.organismo)}</CardTitle>
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
