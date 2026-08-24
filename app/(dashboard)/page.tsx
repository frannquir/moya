import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Placeholder. Fran deferred the real home page (2026-08-24) and it interacts
 * with Phase 4C — if /estadisticas becomes the dashboard, this may become a thin
 * landing or disappear into it.
 *
 * The "Sign out" button that used to live here is gone: the account menu moved
 * into the header in 4A and two sign-outs on one screen is one too many.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-2">
      <h1 className="font-heading text-2xl font-semibold">Hola, {user?.email}</h1>
      <p className="text-sm text-muted-foreground">
        Elegí una sección en el menú lateral para empezar.
      </p>
    </div>
  );
}