import { Alert, AlertDescription } from "@/components/ui/alert";
import { type FaltanteConfig } from "@/lib/domain/escritos-config";

/**
 * Qué van a imprimir entre corchetes los escritos, arriba del formulario que lo
 * arregla.
 *
 * El escrito ya avisa dos veces — la card de Demanda antes de generar, y el
 * editor con badges después — pero las dos lo dicen en el caso, una por una. Acá
 * se ve el estudio entero de un vistazo, que es donde el head puede resolverlo.
 *
 * No es un error: un estudio recién creado tiene todo esto vacío y funciona. Por
 * eso es un aviso y no una alerta destructiva.
 */
export function FaltantesConfig({
  faltantes,
  departamentosSinDomicilio,
}: {
  faltantes: FaltanteConfig[];
  /** Con casos activos y sin domicilio procesal cargado, de mayor a menor. */
  departamentosSinDomicilio: { departamento: string; casos: number }[];
}) {
  const total = faltantes.length + departamentosSinDomicilio.length;
  if (total === 0) {
    return (
      <Alert>
        <AlertDescription className="text-sm">
          La configuración está completa: ningún escrito va a imprimir un campo
          del estudio entre corchetes.
        </AlertDescription>
      </Alert>
    );
  }

  const porSeccion = new Map<string, string[]>();
  for (const f of faltantes) {
    porSeccion.set(f.seccion, [...(porSeccion.get(f.seccion) ?? []), f.label]);
  }

  return (
    <Alert variant="warning">
      <AlertDescription className="space-y-2">
        <p className="text-sm font-medium">
          Tus escritos van a imprimir{" "}
          {total === 1 ? "1 campo vacío" : `${total} campos vacíos`} entre
          corchetes.
        </p>
        <ul className="space-y-1 text-sm">
          {[...porSeccion].map(([seccion, labels]) => (
            <li key={seccion}>
              <span className="font-medium">{seccion}:</span> {labels.join(", ")}
            </li>
          ))}
          {departamentosSinDomicilio.length > 0 && (
            <li>
              <span className="font-medium">Domicilios procesales:</span>{" "}
              {departamentosSinDomicilio
                .map((d) => `${d.departamento} (${d.casos})`)
                .join(", ")}
            </li>
          )}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
