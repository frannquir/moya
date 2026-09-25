"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CarpetaEtiqueta } from "@/components/carpeta-color";
import { type CarpetaVista } from "@/lib/data/carpetas";
import { CarpetasMenu } from "../carpetas-menu";
import { CarpetasDialog, type MiembroCarpeta } from "../carpetas-dialog";

/**
 * The detail page's view of folders: the ones this case is in, and the same
 * checkbox menu the list rows use. "Nueva carpeta" opens the same manager the
 * list opens.
 */
export function CarpetasCaso({
  ejecutadoId,
  carpetas,
  vinculadas,
  currentUserId,
  isHead,
  members,
}: {
  ejecutadoId: string;
  carpetas: CarpetaVista[];
  vinculadas: string[];
  currentUserId: string;
  isHead: boolean;
  members: MiembroCarpeta[];
}) {
  const router = useRouter();
  const [gestionarAbierto, setGestionarAbierto] = useState(false);
  const suyas = carpetas.filter((c) => vinculadas.includes(c.id));
  const refrescar = () => router.refresh();

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {suyas.map((c) => (
        <CarpetaEtiqueta
          key={c.id}
          nombre={c.nombre}
          color={c.color}
          compartida={c.created_by_user_id !== currentUserId || c.shares.length > 0}
        />
      ))}
      <CarpetasMenu
        ejecutadoId={ejecutadoId}
        carpetas={carpetas}
        vinculadas={vinculadas}
        currentUserId={currentUserId}
        onCambio={refrescar}
        onNueva={() => setGestionarAbierto(true)}
        variante="boton"
      />
      <CarpetasDialog
        open={gestionarAbierto}
        onOpenChange={setGestionarAbierto}
        carpetas={carpetas}
        currentUserId={currentUserId}
        isHead={isHead}
        members={members}
        onCambio={refrescar}
      />
    </div>
  );
}
