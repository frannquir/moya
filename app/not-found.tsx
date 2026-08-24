import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Reached by notFound() — most often /ejecutados/[id] for an id the RLS policy
 * hides, since a row the user cannot read comes back null and 404s rather than
 * rendering blank (gotcha #39). So the copy says "no existe o no tenés acceso"
 * rather than asserting it is gone.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <p className="font-heading text-5xl font-semibold text-muted-foreground">404</p>
        <h1 className="font-heading text-xl font-semibold">No encontramos esta página</h1>
        <p className="text-sm text-muted-foreground">
          El expediente o la página no existe, o no tenés acceso.
        </p>
        <Button asChild>
          <Link href="/ejecutados">Ir a Ejecutados</Link>
        </Button>
      </div>
    </div>
  );
}
