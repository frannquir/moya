import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { listActive } from "@/lib/data/ejecutados";
import { EjecutadosBoard } from "./ejecutados-board";

const PAGE_SIZE = 25;

export default async function EjecutadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const term = (q ?? "").trim().slice(0, 100);

  const supabase = await createClient();

  // One fetch serves both the snap-to-last-page redirect (needs the count) and
  // the TQ prefetch (seeded into the cache below — no second query on first load).
  const result = await listActive(supabase, {
    q: term,
    page: pageNum,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));

  // Past the last page (e.g. a stale ?page= after the set shrank): snap to the
  // last real page instead of rendering an empty "no results" table.
  if (pageNum > totalPages) {
    const params = new URLSearchParams({
      ...(term ? { q: term } : {}),
      page: String(totalPages),
    });
    redirect(`?${params}`);
  }

  const qc = new QueryClient();
  qc.setQueryData(["ejecutados", { q: term, page: pageNum }], result);

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <EjecutadosBoard initialQ={term} initialPage={pageNum} pageSize={PAGE_SIZE} />
    </HydrationBoundary>
  );
}
