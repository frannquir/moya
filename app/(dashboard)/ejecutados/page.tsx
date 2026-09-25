import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { listActive } from "@/lib/data/ejecutados";
import { listCarpetas } from "@/lib/data/carpetas";
import { requireUser } from "@/lib/data/auth";
import { getMembership, listMembers } from "@/lib/data/estudio";
import { EjecutadosBoard, type BoardMember } from "./ejecutados-board";
import { VIA_OPTIONS, ordenOf, type Via } from "@/lib/domain/ejecutado";

export const metadata: Metadata = { title: "Ejecutados" };

const PAGE_SIZE = 25;

export default async function EjecutadosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    vista?: string;
    via?: string;
    orden?: string;
    carpeta?: string;
  }>;
}) {
  const { q, page, vista, via, orden: ordenRaw, carpeta } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const term = (q ?? "").trim().slice(0, 100);

  const supabase = await createClient();
  const user = await requireUser(supabase);
  const membership = await getMembership(supabase, user.id);
  const isHead = membership?.role === "head";

  // Default to the user's own cases; "Estudio" (firm-wide, grouped) is a head-only opt-in.
  const view = isHead && vista === "estudio" ? "estudio" : "miembro";

  // Anything not in VIA_OPTIONS is "Todos" — a hand-typed ?via= must not 500.
  const viaFilter: "" | Via = (VIA_OPTIONS as readonly string[]).includes(via ?? "")
    ? (via as Via)
    : "";
  // Anything unrecognised falls back to the default rather than 500ing.
  const orden = ordenOf(ordenRaw);

  // The directory feeds the head's grouped view and, for everyone, the names on
  // shared folders ("Compartida por …"). get_estudio_members is estudio-scoped.
  const [directorio, carpetasData] = await Promise.all([
    listMembers(supabase),
    listCarpetas(supabase),
  ]);
  const members: BoardMember[] = directorio.map((m) => ({
    user_id: m.user_id,
    nombre: m.nombre,
    email: m.email,
    role: m.role,
  }));

  // Same rule as the board: only a folder the user can see filters the list.
  const carpetaId = carpetasData.carpetas.some((c) => c.id === carpeta) ? carpeta! : "";

  const qc = new QueryClient();
  qc.setQueryData(["carpetas"], carpetasData);

  // Only the paginated list is prefetched/snapped: the "Miembro" view, or any
  // picked folder. "Estudio" fetches its full set client-side. assignedTo scopes
  // the count + cache seed to the user's cases when no folder is picked.
  if (view === "miembro" || carpetaId) {
    const result = await listActive(supabase, {
      q: term,
      page: pageNum,
      pageSize: PAGE_SIZE,
      ...(carpetaId ? { carpetaId } : { assignedTo: user.id }),
      orden,
      ...(viaFilter ? { via: viaFilter } : {}),
    });

    const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));
    if (pageNum > totalPages) {
      const params = new URLSearchParams({
        ...(term ? { q: term } : {}),
        ...(view === "estudio" ? { vista: "estudio" } : {}),
        ...(viaFilter ? { via: viaFilter } : {}),
        ...(orden !== "recientes" ? { orden } : {}),
        ...(carpetaId ? { carpeta: carpetaId } : {}),
        page: String(totalPages),
      });
      redirect(`?${params}`);
    }

    // Key must match the board's exactly, or the prefetch is a cache miss.
    qc.setQueryData(
      [
        "ejecutados",
        {
          q: term,
          page: pageNum,
          view: "miembro",
          assignedTo: carpetaId ? null : user.id,
          via: viaFilter,
          orden,
          carpeta: carpetaId,
        },
      ],
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
