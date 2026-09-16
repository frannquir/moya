import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The defect G1 fixed, guarded at the source: a figure carrying IVA and aportes
 * printed as a number of JUS.
 *
 * The JUS is the unit the arancel is written in and the arancel is the fee
 * before tax, so $213.909,90 is 3,06 JUS of honorario — never 4,02 — and a
 * ceiling of 9,17 JUS is not something anybody collects. It came back once
 * already (five surfaces were printing it), and the next reader of this code
 * will reach for `formatJus()` on whatever number is in hand, so the rule is
 * enforced rather than documented.
 *
 * It lives under lib/ because that is what vitest.config.ts collects; what it
 * reads is the UI, which has no other test.
 */

// Every surface that prints a honorario figure. A file that disappears from
// disk fails the test rather than silently dropping out of the scan.
const SUPERFICIES = [
  "app/(dashboard)/ejecutados/[id]/honorarios-card.tsx",
  "app/(dashboard)/ejecutados/[id]/honorarios-add-pago-form.tsx",
  "app/(dashboard)/ejecutados/[id]/honorarios-editar-dialog.tsx",
  "app/(dashboard)/(inicio)/page.tsx",
  "app/(dashboard)/(inicio)/ejecutados-destacados.tsx",
  "app/(dashboard)/honorarios/page.tsx",
  "lib/data/honorarios.ts",
];

// Names that read as a total but hold the regulated base. honorarios
// .monto_total_jus predates the distinction; renaming it is a migration, not a
// display fix.
const ALIAS_DE_BASE = [/monto_total_jus/g, /montoJus/g];

// Words that mean "this number has tax inside it". arsToJus( is on the list
// because dividing gross pesos by the JUS value IS the defect — arsToBaseJus(),
// the conversion that denominates something, does not contain it.
const CON_IMPUESTOS = [
  "total",
  "gross",
  "bruto",
  "cap",
  "techo",
  "iva",
  "aporte",
  "pendiente",
  "arsToJus(",
];

/**
 * The code with its comments removed. The rule is about what renders, and the
 * comments in these files deliberately name the figures not to print — a scan
 * that read them would flag the very notes that explain the rule. `://` is
 * spared so a URL does not swallow the rest of its line.
 */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function leer(rel: string): string {
  const abs = join(process.cwd(), rel);
  expect(existsSync(abs), `${rel} no existe — ¿se renombró sin actualizar este test?`).toBe(
    true,
  );
  return readFileSync(abs, "utf8");
}

/** One expression starting at `desde`, with brackets matched so nesting survives. */
function expresionDesde(src: string, desde: number): string {
  let depth = 1;
  let j = desde;
  while (j < src.length && depth > 0) {
    const c = src[j];
    if (c === "(" || c === "{") depth++;
    else if (c === ")" || c === "}") depth--;
    if (depth > 0) j++;
  }
  return src.slice(desde, j).trim();
}

/** Every expression passed to `marca` — e.g. every formatJus() argument. */
function expresionesTras(src: string, marca: string): string[] {
  const out: string[] = [];
  let i = src.indexOf(marca);
  while (i !== -1) {
    const desde = i + marca.length;
    out.push(expresionDesde(src, desde));
    i = src.indexOf(marca, desde);
  }
  return out;
}

/** `baseJus={...}`, `jus={...}` — a prop whose name claims to be JUS. */
function propsEnJus(src: string): string[] {
  return [...src.matchAll(/\b[A-Za-z]*[Jj]us=\{/g)].map((m) =>
    expresionDesde(src, (m.index ?? 0) + m[0].length),
  );
}

/** `${algo} JUS` inside a message — the same defect in prose. */
function interpolacionesConJus(src: string): string[] {
  return [...src.matchAll(/\$\{([^{}]*)\}\s*JUS\b/g)].map((m) => m[1].trim());
}

function denominaLaBase(expr: string): boolean {
  const limpio = ALIAS_DE_BASE.reduce((s, re) => s.replace(re, ""), expr).toLowerCase();
  if (limpio.includes("base")) return true;
  return !CON_IMPUESTOS.some((t) => limpio.includes(t.toLowerCase()));
}

describe("ninguna cifra con impuestos se imprime en JUS", () => {
  it.each(SUPERFICIES)("%s", (rel) => {
    const src = sinComentarios(leer(rel));
    const sospechosas = [
      ...expresionesTras(src, "formatJus("),
      ...propsEnJus(src),
      ...interpolacionesConJus(src),
    ];
    const conImpuestos = sospechosas.filter((e) => !denominaLaBase(e));
    expect(
      conImpuestos,
      `${rel}: el JUS denomina el honorario base. Estas expresiones llevan IVA ` +
        `y aportes adentro y tienen que imprimirse en pesos, o convertirse con ` +
        `arsToBaseJus() / splitGross().base primero.`,
    ).toEqual([]);
  });

  it("el escaneo mira algo: las superficies siguen imprimiendo JUS", () => {
    // A rename that empties every file of formatJus() would make the test above
    // pass by doing nothing.
    const total = SUPERFICIES.reduce(
      (n, rel) => n + expresionesTras(sinComentarios(leer(rel)), "formatJus(").length,
      0,
    );
    expect(total).toBeGreaterThan(0);
  });

  it("reconoce el defecto que arregló G1", () => {
    // The five expressions the five surfaces printed before this change.
    expect(denominaLaBase("comp.total")).toBe(false);
    expect(denominaLaBase("comp.iva")).toBe(false);
    expect(denominaLaBase("techo.capJus")).toBe(false);
    expect(denominaLaBase("arsToJus(n, jusValue)")).toBe(false);
    expect(denominaLaBase("resumen.honorariosPendientesJus")).toBe(false);
    // And what is legitimately a fee.
    expect(denominaLaBase("comp.base")).toBe(true);
    expect(denominaLaBase("arsToBaseJus(n, jusValue)")).toBe(true);
    expect(denominaLaBase("splitGross(montoArs).base")).toBe(true);
    expect(denominaLaBase("h.monto_total_jus ?? 0")).toBe(true);
    expect(denominaLaBase("input.montoJus")).toBe(true);
  });
});

// The view's own peso columns. Both are computed with jus_value() at query
// time — cap_cobrable_ars converts the JUS ceiling at TODAY's value, and
// pendiente_cobrable_ars then subtracts pesos that came in at the JUS of their
// own dates. So they mix units: a honorario settled in full at a JUS of 50.000
// reads $29.637 still owing once the JUS moves to 53.232. saldoHonorario()
// replaces both, and the view is left alone (no migration).
const COLUMNAS_MIXTAS = ["cap_cobrable_ars", "pendiente_cobrable_ars"];

describe("las columnas de pesos de la vista no se leen", () => {
  it.each([...SUPERFICIES, "lib/data/estadisticas.ts"])("%s", (rel) => {
    const src = sinComentarios(leer(rel));
    const usadas = COLUMNAS_MIXTAS.filter((c) => src.includes(c));
    expect(
      usadas,
      `${rel}: honorarios_with_balance.${usadas.join(" / ")} mezcla el JUS de hoy ` +
        `con pesos cobrados al JUS de otra fecha. Usá saldoHonorario(fila, jusValue), ` +
        `que resuelve el techo en la unidad en que está denominado.`,
    ).toEqual([]);
  });
});
