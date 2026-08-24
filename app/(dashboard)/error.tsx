"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The dashboard error boundary. Before this, any server-side throw showed Next's
 * raw error page — stack trace in development, an unstyled default in
 * production, and no way back except the browser's Back button.
 *
 * The message is deliberately NOT the exception text: these throws are things
 * like `new Error("Only the head can delegate ejecutados")` from server actions,
 * which are already Spanish and user-facing, alongside Postgres errors that are
 * neither. Showing `error.message` verbatim would leak constraint names into the
 * lawyer's face. It is rendered in a collapsed block for when Fran needs it.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on a production stack trace, which Next
    // strips from the client for security.
    console.error("dashboard error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <CardTitle>Algo salió mal</CardTitle>
          </div>
          <CardDescription>
            No pudimos cargar esta pantalla. Los datos no se modificaron.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <details className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Detalle técnico
            </summary>
            <p className="mt-2 break-words font-mono">{error.message}</p>
            {error.digest && (
              <p className="mt-1 font-mono text-muted-foreground">
                digest: {error.digest}
              </p>
            )}
          </details>
        </CardContent>

        <CardFooter className="gap-2">
          <Button onClick={reset}>
            <RotateCw className="mr-2 size-4" />
            Reintentar
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ejecutados">Ir a Ejecutados</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
