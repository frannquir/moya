import { Skeleton } from "@/components/ui/skeleton";

// Shared pieces for the route-level loading states. Each skeleton mirrors the
// grid its page settles into, so the fallback does not reflow when the real
// content arrives.

/** Wraps a fallback: announces to screen readers and matches the page's spacing. */
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}

/** Title plus its one-line description. */
export function HeaderSkeleton({ sub = true }: { sub?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      {sub && <Skeleton className="h-4 w-80" />}
    </div>
  );
}

/** The row of figures above a list or dashboard. */
export function FigurasSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="space-y-2 rounded-lg border bg-card p-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
      ))}
    </div>
  );
}

/** A card: header, then a few lines of body. */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-6">
      <Skeleton className="h-5 w-40" />
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${92 - i * 11}%` }} />
        ))}
      </div>
    </div>
  );
}

/** A list of rows: a name over a caption, with a figure on the right. */
export function FilasSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="divide-y rounded-xl border bg-card">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4" style={{ width: `${38 + ((i * 13) % 34)}%` }} />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * The 3/2 split both /ejecutados/[id] and the home page settle into. Matching the
 * real `xl:grid-cols-5` is the point — a 2+1 fallback shifts the whole page when
 * the content lands.
 */
export function SplitSkeleton({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-5 xl:items-start">
      <div className="min-w-0 space-y-4 xl:col-span-3">{left}</div>
      <div className="min-w-0 space-y-4 xl:col-span-2">{right}</div>
    </div>
  );
}
