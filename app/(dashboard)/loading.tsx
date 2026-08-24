import { Skeleton } from "@/components/ui/skeleton";

/**
 * The dashboard-wide fallback. With no loading.tsx at all Next had nothing to
 * stream, so the browser held the PREVIOUS page until the whole server tree
 * resolved — which is what "navigation feels laggy" actually was on
 * /ejecutados/[id] (eight serialized round trips, measured 2026-08-22).
 *
 * Deliberately generic: a title bar and a few cards. A per-route skeleton that
 * mimics its page exactly is worth it only where the shape is stable, and these
 * pages are about to be redesigned in 4B.
 */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
