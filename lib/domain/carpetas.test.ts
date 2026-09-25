import { describe, expect, it } from "vitest";
import {
  CARPETA_COLORES,
  CARPETA_COLOR_LABEL,
  CARPETA_NOMBRE_MAX,
  carpetaColorOf,
  moverCarpeta,
  ordenarParaMostrar,
  siguienteOrden,
  textoCompartir,
  validarNombreCarpeta,
} from "./carpetas";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("carpetaColorOf", () => {
  it("keeps every palette key", () => {
    for (const c of CARPETA_COLORES) expect(carpetaColorOf(c)).toBe(c);
  });

  it("falls back to grey for anything else, a hex included", () => {
    expect(carpetaColorOf("#ff0000")).toBe("gris");
    expect(carpetaColorOf(null)).toBe("gris");
    expect(carpetaColorOf(undefined)).toBe("gris");
    expect(carpetaColorOf("Azul")).toBe("gris");
  });

  it("labels every key", () => {
    expect(Object.keys(CARPETA_COLOR_LABEL).sort()).toEqual([...CARPETA_COLORES].sort());
  });
});

describe("the palette matches the database", () => {
  const root = process.cwd();
  const migration = readFileSync(
    join(root, "supabase", "migrations", "20260925120000_carpetas_de_ejecutados.sql"),
    "utf8",
  );
  const css = readFileSync(join(root, "app", "globals.css"), "utf8");
  const chip = readFileSync(join(root, "components", "carpeta-color.tsx"), "utf8");

  it("the CHECK constraint lists exactly these keys", () => {
    const check = migration.match(/carpetas_color_check CHECK \(color IN \(([^)]*)\)\)/);
    expect(check).not.toBeNull();
    const keys = check![1].split(",").map((k) => k.trim().replace(/'/g, ""));
    expect(keys).toEqual([...CARPETA_COLORES]);
  });

  it("the default column value is the domain default", () => {
    expect(migration).toMatch(/color TEXT NOT NULL DEFAULT 'gris'/);
  });

  it("every key has a light and a dark token, and a theme alias", () => {
    for (const c of CARPETA_COLORES) {
      const defs = css.match(new RegExp(`--carpeta-${c}:`, "g")) ?? [];
      expect(defs, c).toHaveLength(2);
      expect(css, c).toContain(`--color-carpeta-${c}: var(--carpeta-${c});`);
    }
  });

  it("every key has its full class strings written out (Tailwind cannot see interpolation)", () => {
    for (const c of CARPETA_COLORES) {
      expect(chip, c).toContain(`bg-carpeta-${c}`);
    }
    expect(chip).not.toMatch(/carpeta-\$\{/);
  });
});

describe("validarNombreCarpeta", () => {
  it("trims and collapses inner whitespace", () => {
    expect(validarNombreCarpeta("  En   caducidad \n")).toEqual({ ok: true, nombre: "En caducidad" });
  });

  it("rejects an empty or blank name", () => {
    expect(validarNombreCarpeta("")).toEqual({ ok: false, error: "Poné un nombre." });
    expect(validarNombreCarpeta("   ")).toMatchObject({ ok: false });
    expect(validarNombreCarpeta(null)).toMatchObject({ ok: false });
  });

  it(`accepts ${CARPETA_NOMBRE_MAX} characters and rejects one more`, () => {
    expect(validarNombreCarpeta("a".repeat(CARPETA_NOMBRE_MAX))).toMatchObject({ ok: true });
    expect(validarNombreCarpeta("a".repeat(CARPETA_NOMBRE_MAX + 1))).toMatchObject({ ok: false });
  });

  it("counts characters, not bytes", () => {
    expect(validarNombreCarpeta("ñ".repeat(CARPETA_NOMBRE_MAX))).toMatchObject({ ok: true });
  });
});

describe("siguienteOrden", () => {
  it("starts at 0 and goes after the last one", () => {
    expect(siguienteOrden([])).toBe(0);
    expect(siguienteOrden([{ id: "a", orden: 0 }, { id: "b", orden: 4 }])).toBe(5);
  });
});

describe("moverCarpeta", () => {
  const tres = [
    { id: "a", orden: 0 },
    { id: "b", orden: 1 },
    { id: "c", orden: 2 },
  ];

  it("swaps with the neighbour and returns only what changed", () => {
    expect(moverCarpeta(tres, "b", "arriba")).toEqual([
      { id: "b", orden: 0 },
      { id: "a", orden: 1 },
    ]);
    expect(moverCarpeta(tres, "b", "abajo")).toEqual([
      { id: "c", orden: 1 },
      { id: "b", orden: 2 },
    ]);
  });

  it("does nothing at either end, or for an unknown id", () => {
    expect(moverCarpeta(tres, "a", "arriba")).toEqual([]);
    expect(moverCarpeta(tres, "c", "abajo")).toEqual([]);
    expect(moverCarpeta(tres, "z", "abajo")).toEqual([]);
  });

  it("sorts by orden first, whatever the input order", () => {
    const desordenadas = [tres[2], tres[0], tres[1]];
    expect(moverCarpeta(desordenadas, "c", "arriba")).toEqual([
      { id: "c", orden: 1 },
      { id: "b", orden: 2 },
    ]);
  });

  it("renumbers gaps and ties into 0..n-1, keeping the visible order", () => {
    const raras = [
      { id: "a", orden: 5 },
      { id: "b", orden: 5 },
      { id: "c", orden: 9 },
    ];
    // Visible order is a, b, c. Moving c up gives a, c, b.
    expect(moverCarpeta(raras, "c", "arriba")).toEqual([
      { id: "a", orden: 0 },
      { id: "c", orden: 1 },
      { id: "b", orden: 2 },
    ]);
  });

  it("moving up and back down restores the order", () => {
    const aplicar = (base: typeof tres, cambios: typeof tres) =>
      base.map((c) => cambios.find((x) => x.id === c.id) ?? c);
    const una = aplicar(tres, moverCarpeta(tres, "c", "arriba"));
    const vuelta = aplicar(una, moverCarpeta(una, "c", "abajo"));
    expect(vuelta).toEqual(tres);
  });
});

describe("textoCompartir", () => {
  it("names the member and the count, and says later cases go too", () => {
    expect(textoCompartir({ miembro: "Matías", cantidad: 12 })).toBe(
      "Matías va a poder ver y editar los 12 ejecutados de esta carpeta, y los que agregues después.",
    );
  });

  it("singular", () => {
    expect(textoCompartir({ miembro: "Matías", cantidad: 1 })).toBe(
      "Matías va a poder ver y editar el ejecutado de esta carpeta, y los que agregues después.",
    );
  });

  it("an empty folder", () => {
    expect(textoCompartir({ miembro: "Matías", cantidad: 0 })).toBe(
      "Matías va a poder ver y editar los ejecutados que pongas en esta carpeta.",
    );
  });

  it("a read-only share says only ver", () => {
    expect(textoCompartir({ miembro: "Matías", cantidad: 3, puedeEditar: false })).toBe(
      "Matías va a poder ver los 3 ejecutados de esta carpeta, y los que agregues después.",
    );
  });
});

describe("ordenarParaMostrar", () => {
  const yo = "u1";
  const c = (id: string, orden: number, nombre: string, owner: string) => ({
    id,
    orden,
    nombre,
    created_by_user_id: owner,
  });

  it("own folders by orden first, then shared ones by name", () => {
    const lista = [
      c("s2", 0, "Zeta", "head"),
      c("p2", 1, "Beta", yo),
      c("s1", 3, "Árbol", "head"),
      c("p1", 0, "Alfa", yo),
    ];
    expect(ordenarParaMostrar(lista, yo).map((x) => x.id)).toEqual(["p1", "p2", "s1", "s2"]);
  });
});
