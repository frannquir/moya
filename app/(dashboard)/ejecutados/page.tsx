import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { listActive } from "@/lib/data/ejecutados";
import { requireUser } from "@/lib/data/auth";
import { getMembership, listMembers } from "@/lib/data/estudio";
import { EjecutadosBoard, type BoardMember } from "./ejecutados-board";

const PAGE_SIZE = 25;

export default async function EjecutadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; vista?: string }>;
}) {
  const { q, page, vista } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const term = (q ?? "").trim().slice(0, 100);

  const supabase = await createClient();
  const user = await requireUser(supabase);
  const membership = await getMembership(supabase, user.id);
  const isHead = membership?.role === "head";

  // Default to the user's own cases; "Estudio" (firm-wide, grouped) is a head-only opt-in.
  const view = isHead && vista === "estudio" ? "estudio" : "miembro";

  // Head-only firm-wide folder view needs the member directory.
  const members: BoardMember[] = isHead
    ? (await listMembers(supabase)).map((m) => ({
        user_id: m.user_id,
        nombre: m.nombre,
        email: m.email,
        role: m.role,
      }))
    : [];

  const qc = new QueryClient();

  // Only the paginated "Miembro" view is prefetched/snapped; "Estudio" fetches its
  // full set client-side. assignedTo scopes the count + cache seed to the user's cases.
  if (view === "miembro") {
    const result = await listActive(supabase, {
      q: term,
      page: pageNum,
      pageSize: PAGE_SIZE,
      assignedTo: user.id,
    });

    const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));
    if (pageNum > totalPages) {
      const params = new URLSearchParams({
        ...(term ? { q: term } : {}),
        page: String(totalPages),
      });
      redirect(`?${params}`);
    }

    qc.setQueryData(
      ["ejecutados", { q: term, page: pageNum, view: "miembro", assignedTo: user.id }],
      result,
    );
  }

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <EjecutadosBoard
        initialQ={term}
        initialPage={pageNum}
        pageSize={PAGE_SIZE}
        isHead={isHead}
        currentUserId={user.id}
        members={members}
      />
    </HydrationBoundary>
  );
}
