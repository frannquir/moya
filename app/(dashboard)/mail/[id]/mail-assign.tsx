"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { listActive } from "@/lib/data/ejecutados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignEmail, confirmCandidate, rejectCandidate } from "../actions";

interface Ejecutado {
  id: string;
  nombre: string;
  numero_expediente: string;
}

// Assignment widget for a single mail: current status, the matcher's pending
// suggestion (Confirmar / No es), and a search-picker to (re)assign. The picker
// is RLS-scoped — a member only finds their own cases, the head finds all.
export function MailAssign({
  emailId,
  ejecutado,
  candidato,
}: {
  emailId: string;
  ejecutado: Ejecutado | null;
  candidato: Ejecutado | null;
}) {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [picking, setPicking] = useState(!ejecutado);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["ejecutados-picker", debounced],
    queryFn: async () => {
      const { items } = await listActive(supabase, { q: debounced, pageSize: 8 });
      return items;
    },
    enabled: picking,
  });

  const assignMutation = useMutation({
    mutationFn: (ejecutadoId: string) => assignEmail(emailId, ejecutadoId),
    onSuccess: () => {
      setPicking(false);
      setTerm("");
      router.refresh();
    },
    onError: () => toast.error("No se pudo asignar."),
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmCandidate(emailId),
    onSuccess: () => router.refresh(),
    onError: () => toast.error("No se pudo confirmar."),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectCandidate(emailId),
    onSuccess: () => router.refresh(),
    onError: () => toast.error("No se pudo descartar."),
  });

  const busy =
    assignMutation.isPending ||
    confirmMutation.isPending ||
    rejectMutation.isPending;
  const pendingCandidate = candidato && !ejecutado ? candidato : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {ejecutado ? (
          <span>
            Asignado a{" "}
            <Link
              href={`/ejecutados/${ejecutado.id}`}
              className="font-medium hover:underline"
            >
              {ejecutado.nombre}
            </Link>
            {ejecutado.numero_expediente && (
              <span className="text-muted-foreground">
                {" "}
                · {ejecutado.numero_expediente}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Sin asignar</span>
        )}
        {ejecutado && !picking && (
          <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
            Reasignar
          </Button>
        )}
      </div>

      {pendingCandidate && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span>
            ¿Es <strong>{pendingCandidate.nombre}</strong>
            {pendingCandidate.numero_expediente && (
              <span className="text-muted-foreground">
                {" "}
                · {pendingCandidate.numero_expediente}
              </span>
            )}
            ?
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => confirmMutation.mutate()}
            >
              Confirmar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => rejectMutation.mutate()}
            >
              No es
            </Button>
          </div>
        </div>
      )}

      {picking && (
        <div className="space-y-2 rounded-md border p-3">
          <Input
            placeholder="Buscar ejecutado por nombre…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoFocus
          />
          <ul className="max-h-64 divide-y overflow-auto">
            {results.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted-foreground">
                {isFetching ? "Buscando…" : "Sin resultados."}
              </li>
            ) : (
              results.map((ej) => (
                <li key={ej.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => assignMutation.mutate(ej.id)}
                    className="flex w-full items-baseline justify-between gap-2 px-1 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                  >
                    <span className="truncate font-medium">{ej.nombre}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {ej.numero_expediente || "—"}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {ejecutado && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPicking(false);
                setTerm("");
              }}
            >
              Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
