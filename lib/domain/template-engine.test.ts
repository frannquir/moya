import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MANUAL_INPUT_TOKENS,
  detectManualPlaceholders,
  extractPlaceholders,
  extractUnresolved,
  renderTemplate,
} from "./template-engine";

describe("renderTemplate — legacy token behaviour", () => {
  it("substitutes a known token", () => {
    expect(renderTemplate("Hola {{NOMBRE}}.", { NOMBRE: "Perez" })).toBe("Hola Perez.");
  });

  it("leaves an unresolved token visible as [TOKEN]", () => {
    expect(renderTemplate("Hola {{NOMBRE}}.", {})).toBe("Hola [NOMBRE].");
    expect(renderTemplate("Hola {{NOMBRE}}.", { NOMBRE: null })).toBe("Hola [NOMBRE].");
    expect(renderTemplate("Hola {{NOMBRE}}.", { NOMBRE: "   " })).toBe("Hola [NOMBRE].");
  });

  it("ignores anything that is not an uppercase token", () => {
    expect(renderTemplate("{{nombre}} {{ NOMBRE }} {{}}", { nombre: "x" })).toBe(
      "{{nombre}} {{ NOMBRE }} {{}}",
    );
  });

  it("replaces every occurrence", () => {
    expect(renderTemplate("{{A}}-{{A}}-{{B}}", { A: "1", B: "2" })).toBe("1-1-2");
  });
});

describe("{{#if}}", () => {
  it("renders the consequent when truthy and drops it when not", () => {
    const t = "a{{#if X}}SI{{/if}}b";
    expect(renderTemplate(t, { X: "1" })).toBe("aSIb");
    expect(renderTemplate(t, { X: "" })).toBe("ab");
    expect(renderTemplate(t, {})).toBe("ab");
  });

  it("supports {{else}}", () => {
    const t = "{{#if X}}SI{{else}}NO{{/if}}";
    expect(renderTemplate(t, { X: true })).toBe("SI");
    expect(renderTemplate(t, { X: false })).toBe("NO");
  });

  it("treats empty string, false, 0 and an empty list as falsy", () => {
    const t = "{{#if X}}SI{{else}}NO{{/if}}";
    for (const X of ["", "   ", "false", "0", false, 0, null, undefined]) {
      expect(renderTemplate(t, { X })).toBe("NO");
    }
    expect(renderTemplate(t, { X: [] })).toBe("NO");
    expect(renderTemplate(t, { X: [{ a: "1" }] })).toBe("SI");
  });

  it("still resolves tokens inside the branch", () => {
    expect(renderTemplate("{{#if X}}{{A}}/{{B}}{{/if}}", { X: "1", A: "a" })).toBe("a/[B]");
  });
});

describe("{{#each}}", () => {
  const PARTES = [
    { NOMBRE: "Uno", CUIL: "20-11111111-1" },
    { NOMBRE: "Dos", CUIL: "27-22222222-2" },
  ];

  it("iterates the records", () => {
    expect(renderTemplate("{{#each PARTES}}[{{NOMBRE}}]{{/each}}", { PARTES })).toBe(
      "[Uno][Dos]",
    );
  });

  it("falls back to the outer scope for a field the item lacks", () => {
    expect(
      renderTemplate("{{#each PARTES}}{{NOMBRE}}@{{CIUDAD}} {{/each}}", {
        PARTES,
        CIUDAD: "Tandil",
      }),
    ).toBe("Uno@Tandil Dos@Tandil ");
  });

  it("lets the item shadow the outer scope", () => {
    expect(
      renderTemplate("{{#each PARTES}}{{NOMBRE}} {{/each}}{{NOMBRE}}", {
        PARTES,
        NOMBRE: "Externo",
      }),
    ).toBe("Uno Dos Externo");
  });

  it("renders nothing when the list is missing or empty", () => {
    expect(renderTemplate("a{{#each PARTES}}x{{/each}}b", {})).toBe("ab");
    expect(renderTemplate("a{{#each PARTES}}x{{/each}}b", { PARTES: [] })).toBe("ab");
  });

  it("keeps the [FIELD] marker for a field missing everywhere", () => {
    expect(renderTemplate("{{#each PARTES}}{{DOMICILIO}} {{/each}}", { PARTES })).toBe(
      "[DOMICILIO] [DOMICILIO] ",
    );
  });

  it("renders a list used as a bare token as a marker, not as [object Object]", () => {
    expect(renderTemplate("{{PARTES}}", { PARTES })).toBe("[PARTES]");
  });
});

describe("nesting", () => {
  it("supports {{#if}} inside {{#each}}", () => {
    const t = "{{#each PARTES}}{{NOMBRE}}:{{#if TRABAJA}}sí{{else}}no{{/if}} {{/each}}";
    const PARTES = [
      { NOMBRE: "Uno", TRABAJA: true },
      { NOMBRE: "Dos", TRABAJA: false },
    ];
    expect(renderTemplate(t, { PARTES })).toBe("Uno:sí Dos:no ");
  });

  it("supports {{#each}} inside {{#if}}", () => {
    const t = "{{#if HAY}}{{#each PARTES}}{{NOMBRE}} {{/each}}{{/if}}";
    expect(renderTemplate(t, { HAY: true, PARTES: [{ NOMBRE: "Uno" }] })).toBe("Uno ");
    expect(renderTemplate(t, { HAY: false, PARTES: [{ NOMBRE: "Uno" }] })).toBe("");
  });

  it("throws a clear error beyond one level of nesting rather than misrendering", () => {
    const t = "{{#each A}}{{#if B}}{{#if C}}x{{/if}}{{/if}}{{/each}}";
    expect(() => renderTemplate(t, {})).toThrow(/nested more than 2 deep/);
  });
});

describe("malformed blocks throw rather than misrender", () => {
  it("rejects an unclosed block", () => {
    expect(() => renderTemplate("{{#if X}}a", {})).toThrow(/Unclosed/);
    expect(() => renderTemplate("{{#each X}}a", {})).toThrow(/Unclosed/);
  });

  it("rejects a stray close or else", () => {
    expect(() => renderTemplate("a{{/if}}", {})).toThrow(/Unexpected/);
    expect(() => renderTemplate("a{{else}}b", {})).toThrow(/Unexpected/);
  });

  it("rejects a mismatched close", () => {
    expect(() => renderTemplate("{{#if X}}a{{/each}}", {})).toThrow(/Mismatched/);
  });
});

describe("whitespace: a standalone block tag leaves no blank line", () => {
  it("removes the line a block tag sits alone on", () => {
    const t = ["uno", "{{#if X}}", "dos", "{{/if}}", "tres"].join("\n");
    expect(renderTemplate(t, { X: true })).toBe("uno\ndos\ntres");
    expect(renderTemplate(t, { X: false })).toBe("uno\ntres");
  });

  it("removes indented standalone tags too", () => {
    const t = ["uno", "  {{#each L}}", "  {{NOMBRE}}", "  {{/each}}", "fin"].join("\n");
    expect(renderTemplate(t, { L: [{ NOMBRE: "a" }, { NOMBRE: "b" }] })).toBe(
      "uno\n  a\n  b\nfin",
    );
  });

  it("leaves an inline tag's surrounding text alone", () => {
    expect(renderTemplate("uno {{#if X}}dos{{/if}} tres", { X: true })).toBe(
      "uno dos tres",
    );
  });

  it("handles consecutive standalone tags", () => {
    const t = ["{{#each L}}", "{{#if T}}", "x", "{{/if}}", "{{/each}}", "fin"].join("\n");
    expect(renderTemplate(t, { L: [{ T: true }, { T: false }] })).toBe("x\nfin");
  });

  it("does not strip a bare token sitting alone on a line", () => {
    expect(renderTemplate("uno\n{{A}}\ntres", { A: "dos" })).toBe("uno\ndos\ntres");
  });
});

describe("extractPlaceholders", () => {
  it("returns plain tokens only, never block tags or the names they control", () => {
    const t = "{{A}} {{#if FLAG}}{{B}}{{else}}{{C}}{{/if}} {{#each LISTA}}{{D}}{{/each}}";
    expect(extractPlaceholders(t).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("deduplicates", () => {
    expect(extractPlaceholders("{{A}}{{A}}{{B}}").sort()).toEqual(["A", "B"]);
  });
});

describe("extractUnresolved", () => {
  it("reports the markers renderTemplate left behind", () => {
    const out = renderTemplate("{{A}} {{B}}", { A: "ok" });
    expect(extractUnresolved(out)).toEqual(["B"]);
  });
});

describe("detectManualPlaceholders", () => {
  it("reports only the manual-input tokens present", () => {
    expect(detectManualPlaceholders("{{CBU}} {{DEMANDADO}} {{BANCO}}").sort()).toEqual([
      "BANCO",
      "CBU",
    ]);
  });

  it("finds manual tokens inside blocks", () => {
    expect(detectManualPlaceholders("{{#if X}}{{CBU}}{{/if}}")).toEqual(["CBU"]);
  });

  it("carries the demanda fojas tokens", () => {
    for (const t of ["FOJAS_RESUMENES", "FOJAS_CONTRATO", "FOJAS_ACUSE"]) {
      expect(MANUAL_INPUT_TOKENS.has(t)).toBe(true);
    }
  });
});

// --- backward compatibility -------------------------------------------------
//
// The engine every escrito in the product runs through was rewritten from a
// single regex replace into a parser. Nothing that predates the block syntax may
// render even one byte differently, so this reimplements the OLD engine in four
// lines and asserts equivalence over every template body actually seeded in the
// migrations — a stronger claim than a pinned snapshot, and one that keeps
// holding as more legacy templates are seeded.

const LEGACY_TOKEN_RE = /\{\{([A-Z0-9_]+)\}\}/g;

function renderLegacy(
  contenido: string,
  tokens: Record<string, string | null | undefined>,
): string {
  return contenido.replace(LEGACY_TOKEN_RE, (_m, key: string) => {
    const value = tokens[key];
    return value != null && String(value).trim() !== "" ? String(value) : `[${key}]`;
  });
}

function seededBodies(): string[] {
  const dir = join(process.cwd(), "supabase", "migrations");
  const bodies: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(dir, file), "utf8");
    // Bodies are dollar-quoted as $esc$…$esc$, so the odd segments are the bodies.
    const parts = sql.split("$esc$");
    for (let i = 1; i < parts.length; i += 2) bodies.push(parts[i]);
  }
  return bodies;
}

describe("backward compatibility with the pre-block engine", () => {
  // A deliberately partial map: some tokens resolve, some must come out as [X].
  const TOKENS: Record<string, string> = {
    ENCABEZADO: "ENCABEZADO RESUELTO",
    DEMANDADO: "PEREZ, JUAN",
    EMPRESA: "EMPRESA DE PRUEBA S.A.",
    CUIT_EMPRESA: "30-70123456-8",
    DEPARTAMENTO: "Azul",
    JUZGADO: "Juzgado Civil y Comercial N° 1",
    JUEZ: "Dr. Prueba",
    CAPITAL: "$100.000,00",
    TOTAL_LIQUIDACION: "$150.000,00",
    FECHA_HOY: "21/08/2026",
    CUENTA_HONORARIOS: "CUENTA DE PRUEBA",
  };

  const legacy = seededBodies().filter(
    (b) => !b.includes("{{#") && !b.includes("{{else}}") && !b.includes("{{/"),
  );

  it("found the seeded bodies to compare (guards against testing nothing)", () => {
    expect(legacy.length).toBeGreaterThanOrEqual(24);
  });

  it("renders every pre-block seeded body byte-identically", () => {
    for (const body of legacy) {
      expect(renderTemplate(body, TOKENS)).toBe(renderLegacy(body, TOKENS));
    }
  });

  it("extracts the same placeholders as the old regex for every such body", () => {
    for (const body of legacy) {
      const old = [...new Set([...body.matchAll(LEGACY_TOKEN_RE)].map((m) => m[1]))];
      expect(extractPlaceholders(body).sort()).toEqual(old.sort());
    }
  });

  it("renders identically with an empty token map too", () => {
    for (const body of legacy) {
      expect(renderTemplate(body, {})).toBe(renderLegacy(body, {}));
    }
  });
});
