import { cache } from "react";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { listEmailsInWindow, getGmailConnection } from "@/lib/data/mail";
import { requireUser } from "@/lib/data/auth";
import { getMembership } from "@/lib/data/estudio";
import { MailBoard } from "./mail-board";

// Wrapping Date.now() with cache() makes it pure for a given request — the
// React purity rule otherwise flags impure calls during render.
const getRequestNow = cache(() => Date.now());

const WINDOW_DAYS = 30;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string; window?: string }>;
}) {
  const { gmail, reason, window: windowParam } = await searchParams;
  const offset = Math.max(0, parseInt(windowParam ?? "0", 10) || 0);

  // Rolling 30-day windows. offset=0 is the most recent 30 days; each step back
  // shifts the window another 30 days into the past.
  const end = new Date(getRequestNow() - offset * WINDOW_DAYS * 86_400_000);
  const start = new Date(end.getTime() - WINDOW_DAYS * 86_400_000);

  const supabase = await createClient();

  // Resolve head status the same way /estudio does — gates the "Sincronizar
  // ahora" button (members don't see it).
  const user = await requireUser(supabase);
  const membership = await getMembership(supabase, user.id);
  const isHead = membership?.role === "head";

  const qc = new QueryClient();
  await Promise.all([
    qc.prefetchQuery({
      queryKey: ["emails", "window", offset],
      queryFn: () => listEmailsInWindow(supabase, { start, end }),
    }),
    qc.prefetchQuery({
      queryKey: ["gmail-connection"],
      queryFn: () => getGmailConnection(supabase),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <MailBoard
        offset={offset}
        start={start.toISOString()}
        end={end.toISOString()}
        gmail={gmail}
        reason={reason}
        isHead={isHead}
      />
    </HydrationBoundary>
  );
}
