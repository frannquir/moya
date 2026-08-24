"use client";

import { Button } from "@/components/ui/button";

/**
 * The auth route group has no sidebar, no header and no session, so it cannot
 * reuse the dashboard boundary — a "Ir a Ejecutados" link from a signed-out
 * error would bounce straight back to /login through the proxy.
 */
export default function AuthError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="font-heading text-xl font-semibold">Algo salió mal</h1>
        <p className="text-sm text-muted-foreground">
          No pudimos completar la operación. Probá de nuevo.
        </p>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </div>
  );
}
