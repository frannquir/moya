"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Server actions can't fire client toasts directly, so they redirect with a
// ?toast=<key> param and this component (mounted once in the dashboard layout)
// shows the matching toast and then strips the param from the URL.
const TOASTS: Record<string, { type: "success" | "error"; text: string }> = {
  ejecutado_creado: { type: "success", text: "Ejecutado creado." },
  ejecutado_guardado: { type: "success", text: "Cambios guardados." },
  demanda_creada: { type: "success", text: "Demanda creada." },
  demanda_sin_liquidacion: {
    type: "error",
    text: "Demanda creada, pero sin liquidación: falta la fecha de mora.",
  },
  codemandado_agregado: { type: "success", text: "Codemandado agregado." },
  codemandado_guardado: { type: "success", text: "Codemandado actualizado." },
  codemandado_archivado: { type: "success", text: "Codemandado eliminado." },
  invite_ok: { type: "success", text: "Miembro agregado." },
  invite_notfound: { type: "error", text: "Ese email no tiene cuenta todavía." },
  invite_exists: { type: "error", text: "Ese usuario ya pertenece a un estudio." },
  invite_empty: { type: "error", text: "Ingresá un email." },
  remove_ok: { type: "success", text: "Miembro quitado." },
  remove_head: { type: "error", text: "No se puede quitar al head del estudio." },
  leave_head: { type: "error", text: "Sos head del estudio, no podés salir." },
  gmail_desconectado: { type: "success", text: "Gmail desconectado." },
};

export function FlashToaster() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = params.get("toast");

  useEffect(() => {
    if (!key) return;
    const entry = TOASTS[key];
    if (entry) {
      (entry.type === "error" ? toast.error : toast.success)(entry.text);
    }
    const next = new URLSearchParams(params.toString());
    next.delete("toast");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Only re-run when the toast key changes; router/pathname are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
