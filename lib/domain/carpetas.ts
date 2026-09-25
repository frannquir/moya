/**
 * Carpetas de ejecutados (G2). Pure: the palette, the name rule, the order
 * arithmetic and the sentence that tells the head what sharing does.
 *
 * Access is not decided here. Who sees which case lives in RLS
 * (20260925120000_carpetas_de_ejecutados.sql); this module only shapes what
 * the screens show and post.
 */

/**
 * Palette KEYS, stored in `carpetas.color` and checked by a CHECK constraint
 * with the same list. The colour itself is a `--carpeta-*` token resolved in
 * components/carpeta-color.tsx, the way MOVIMIENTO_ETAPA keys the stage
 * colours: renaming or re-theming never touches a stored row, and dark mode
 * gets its own values.
 */
export const CARPETA_COLORES = [
  "gris",
  "azul",
  "turquesa",
  "verde",
  "ambar",
  "naranja",
  "rojo",
  "violeta",
] as const;

export type CarpetaColor = (typeof CARPETA_COLORES)[number];

export const CARPETA_COLOR_DEFAULT: CarpetaColor = "gris";

export const CARPETA_COLOR_LABEL: Record<CarpetaColor, string> = {
  gris: "Gris",
  azul: "Azul",
  turquesa: "Turquesa",
  verde: "Verde",
  ambar: "Ámbar",
  naranja: "Naranja",
  rojo: "Rojo",
  violeta: "Violeta",
};

/** A stored or posted value, narrowed. Anything unknown renders grey. */
export function carpetaColorOf(raw: unknown): CarpetaColor {
  return (CARPETA_COLORES as readonly unknown[]).includes(raw)
    ? (raw as CarpetaColor)
    : CARPETA_COLOR_DEFAULT;
}

/** Same bound as the `carpetas_nombre_check` constraint. */
export const CARPETA_NOMBRE_MAX = 60;

/**
 * Trims and collapses inner whitespace, so "En  caducidad" and "En caducidad"
 * are the same name. The unique index compares `lower(btrim(nombre))`, and it
 * cannot see a doubled inner space.
 */
export function validarNombreCarpeta(
  raw: unknown,
): { ok: true; nombre: string } | { ok: false; error: string } {
  const nombre = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (nombre === "") return { ok: false, error: "Poné un nombre." };
  if (nombre.length > CARPETA_NOMBRE_MAX) {
    return { ok: false, error: `Hasta ${CARPETA_NOMBRE_MAX} caracteres.` };
  }
  return { ok: true, nombre };
}

export type CarpetaOrdenable = { id: string; orden: number };

/** Where a new folder goes: after the owner's last one. */
export function siguienteOrden(carpetas: readonly CarpetaOrdenable[]): number {
  return carpetas.reduce((max, c) => Math.max(max, c.orden + 1), 0);
}

/**
 * Moves one folder a place up or down among the owner's own folders. It
 * returns only the rows whose `orden` changes, renumbered 0..n-1 from the
 * current order. Ties (two folders created with the same `orden`) are broken
 * by their position in the input, so the list the user sees is the list that
 * gets renumbered. At either end it returns nothing.
 */
export function moverCarpeta(
  carpetas: readonly CarpetaOrdenable[],
  id: string,
  direccion: "arriba" | "abajo",
): CarpetaOrdenable[] {
  const ordenadas = carpetas
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.orden - b.c.orden || a.i - b.i)
    .map(({ c }) => c);

  const desde = ordenadas.findIndex((c) => c.id === id);
  if (desde === -1) return [];
  const hasta = direccion === "arriba" ? desde - 1 : desde + 1;
  if (hasta < 0 || hasta >= ordenadas.length) return [];

  const nuevas = [...ordenadas];
  [nuevas[desde], nuevas[hasta]] = [nuevas[hasta], nuevas[desde]];

  return nuevas
    .map((c, orden) => ({ id: c.id, orden }))
    .filter(({ id: cid, orden }) => ordenadas.find((c) => c.id === cid)!.orden !== orden);
}

/**
 * What sharing does, said before it is done. Sharing hands over every case in
 * the folder, and every case filed into it later. That second half is the easy
 * one to miss, and it is how a folder gets over-shared by accident.
 */
export function textoCompartir({
  miembro,
  cantidad,
  puedeEditar = true,
}: {
  miembro: string;
  cantidad: number;
  puedeEditar?: boolean;
}): string {
  const verbo = puedeEditar ? "ver y editar" : "ver";
  if (cantidad <= 0) {
    return `${miembro} va a poder ${verbo} los ejecutados que pongas en esta carpeta.`;
  }
  const casos =
    cantidad === 1 ? "el ejecutado de esta carpeta" : `los ${cantidad} ejecutados de esta carpeta`;
  return `${miembro} va a poder ${verbo} ${casos}, y los que agregues después.`;
}

/**
 * The order the chips render in: the user's own folders by their `orden`, then
 * the ones shared with them, by name. Shared folders keep their owner's
 * `orden`, but that order is not the reader's, so it would look arbitrary.
 */
export function ordenarParaMostrar<
  T extends CarpetaOrdenable & { nombre: string; created_by_user_id: string | null },
>(carpetas: readonly T[], userId: string): T[] {
  const propias = carpetas
    .filter((c) => c.created_by_user_id === userId)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.orden - b.c.orden || a.i - b.i)
    .map(({ c }) => c);
  const compartidas = carpetas
    .filter((c) => c.created_by_user_id !== userId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return [...propias, ...compartidas];
}
