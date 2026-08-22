// Template engine (port of the old templateEngine.ts, extended with blocks in
// Week 2B). Replaces known {{TOKEN}}s from the provided sources; any unresolved
// {{X}} stays visible as [X] so the lawyer fills it before filing.
//
// That [X] fallback is load-bearing and applies inside blocks too: the demanda
// prints every party's CUIL and domicilio, and a missing one has to be visible
// in the document rather than silently collapse to an empty string.
//
// Block syntax added 2026-08-21:
//   {{#if NAME}} … {{else}} … {{/if}}     — {{else}} optional
//   {{#each LIST}} … {{/each}}            — LIST is a list of records; inside,
//                                           {{FIELD}} resolves against the
//                                           current item first, then outward
//
// Deliberately not a general-purpose template language: no expressions, no
// helpers, no paths. One level of nesting is supported (an {{#if}} inside an
// {{#each}} is what the cautelar fragments need); deeper nesting throws rather
// than misrendering a legal document.

// Order matters: the block alternatives are tried before the bare-token one, so
// {{#if X}} never parses as a token. The bare-token alternative is character for
// character the old /\{\{([A-Z0-9_]+)\}\}/ — that is what keeps every pre-block
// template byte-identical.
const TAG_RE =
  /\{\{(?:(#if|#each)[ \t]+([A-Z0-9_]+)|(else)|\/(if|each)|([A-Z0-9_]+))\}\}/g;

// One block may contain another; a third level throws.
const MAX_BLOCK_DEPTH = 2;

export type TemplateValue = string | number | boolean | null | undefined;
export type TemplateRecord = Record<string, TemplateValue>;
export type TemplateScope = Record<string, TemplateValue | TemplateRecord[]>;

// --- scanning ---------------------------------------------------------------

type Piece =
  | { kind: "text"; value: string }
  | { kind: "token"; name: string }
  | { kind: "open"; block: "if" | "each"; name: string }
  | { kind: "else" }
  | { kind: "close"; block: "if" | "each" };

function scan(input: string): Piece[] {
  const pieces: Piece[] = [];
  let last = 0;
  TAG_RE.lastIndex = 0;
  for (const m of input.matchAll(TAG_RE)) {
    const at = m.index ?? 0;
    if (at > last) pieces.push({ kind: "text", value: input.slice(last, at) });
    if (m[1]) {
      pieces.push({ kind: "open", block: m[1] === "#if" ? "if" : "each", name: m[2] });
    } else if (m[3]) {
      pieces.push({ kind: "else" });
    } else if (m[4]) {
      pieces.push({ kind: "close", block: m[4] as "if" | "each" });
    } else {
      pieces.push({ kind: "token", name: m[5] });
    }
    last = at + m[0].length;
  }
  if (last < input.length) pieces.push({ kind: "text", value: input.slice(last) });
  return pieces;
}

/**
 * A block tag alone on its own line leaves no blank line behind. Legal documents
 * are read as prose and a stray empty paragraph is visible on the page, so the
 * tag's indentation and its trailing newline are both removed. Bare {{TOKEN}}s
 * are untouched — they stand where the text stands.
 */
function stripStandaloneLines(pieces: Piece[]): Piece[] {
  const out = pieces.map((p) => ({ ...p }) as Piece);

  // Whether the current output line already carries something visible. A block
  // tag prints nothing, so it does not set this — but a {{TOKEN}} or any
  // non-blank text does, and that is what distinguishes "{{/each}} alone on its
  // line" from "{{DOMICILIO}} {{/each}}", where the trailing space is content.
  let lineHasContent = false;

  for (let i = 0; i < out.length; i++) {
    const p = out[i];

    if (p.kind === "text") {
      const nl = p.value.lastIndexOf("\n");
      lineHasContent =
        nl === -1
          ? lineHasContent || /[^ \t]/.test(p.value)
          : /[^ \t]/.test(p.value.slice(nl + 1));
      continue;
    }
    if (p.kind === "token") {
      lineHasContent = true;
      continue;
    }

    const prev = i > 0 ? out[i - 1] : undefined;
    const next = i + 1 < out.length ? out[i + 1] : undefined;
    const nextOk =
      next === undefined ||
      (next.kind === "text" && /^[ \t]*(\r?\n|$)/.test(next.value));

    if (lineHasContent || !nextOk) continue;

    if (prev && prev.kind === "text") {
      prev.value = prev.value.replace(/[ \t]*$/, "");
    }
    if (next && next.kind === "text") {
      next.value = next.value.replace(/^[ \t]*\r?\n/, "");
    }
    // The tag consumed its own line, so whatever follows starts a clean one.
    lineHasContent = false;
  }
  return out;
}

// --- parsing ----------------------------------------------------------------

type Node =
  | { type: "text"; value: string }
  | { type: "token"; name: string }
  | { type: "if"; name: string; consequent: Node[]; alternate: Node[] }
  | { type: "each"; name: string; body: Node[] };

class TemplateError extends Error {}

function parse(pieces: Piece[]): Node[] {
  let i = 0;

  function parseNodes(inside: "if" | "each" | null, depth: number): Node[] {
    const nodes: Node[] = [];
    while (i < pieces.length) {
      const p = pieces[i];

      if (p.kind === "text") {
        nodes.push({ type: "text", value: p.value });
        i++;
      } else if (p.kind === "token") {
        nodes.push({ type: "token", name: p.name });
        i++;
      } else if (p.kind === "else" || p.kind === "close") {
        // Handled by the caller that opened the block.
        if (inside === null) {
          const what = p.kind === "else" ? "{{else}}" : `{{/${p.block}}}`;
          throw new TemplateError(`Unexpected ${what} with no open block`);
        }
        return nodes;
      } else {
        if (depth >= MAX_BLOCK_DEPTH) {
          throw new TemplateError(
            `Blocks nested more than ${MAX_BLOCK_DEPTH} deep are not supported ` +
              `(at {{#${p.block} ${p.name}}})`,
          );
        }
        i++; // consume the opening tag
        if (p.block === "if") {
          const consequent = parseNodes("if", depth + 1);
          let alternate: Node[] = [];
          const afterConsequent = pieces[i];
          if (afterConsequent && afterConsequent.kind === "else") {
            i++;
            alternate = parseNodes("if", depth + 1);
          }
          expectClose("if", p.name);
          nodes.push({ type: "if", name: p.name, consequent, alternate });
        } else {
          const body = parseNodes("each", depth + 1);
          expectClose("each", p.name);
          nodes.push({ type: "each", name: p.name, body });
        }
      }
    }
    if (inside !== null) {
      throw new TemplateError(`Unclosed {{#${inside}}} block`);
    }
    return nodes;
  }

  function expectClose(block: "if" | "each", name: string) {
    const p = pieces[i];
    if (!p || p.kind !== "close") {
      throw new TemplateError(`Unclosed {{#${block} ${name}}} block`);
    }
    if (p.block !== block) {
      throw new TemplateError(
        `Mismatched close: {{#${block} ${name}}} closed by {{/${p.block}}}`,
      );
    }
    i++;
  }

  const nodes = parseNodes(null, 0);
  return nodes;
}

// --- rendering --------------------------------------------------------------

function lookup(
  name: string,
  item: TemplateRecord | null,
  outer: TemplateScope,
): TemplateValue | TemplateRecord[] {
  // Inside an {{#each}}, the current item shadows the outer scope.
  if (item && Object.prototype.hasOwnProperty.call(item, name)) return item[name];
  return outer[name];
}

/** Empty string, null/undefined, false, 0 and an empty list are all falsy. */
function truthy(value: TemplateValue | TemplateRecord[]): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = String(value).trim();
  return s !== "" && s !== "false" && s !== "0";
}

function renderNodes(
  nodes: Node[],
  item: TemplateRecord | null,
  outer: TemplateScope,
): string {
  let out = "";
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        out += node.value;
        break;
      case "token": {
        const value = lookup(node.name, item, outer);
        // A list is not printable; falling through to [NAME] would be noise, so
        // an accidental {{PARTES}} outside an each renders as the marker too.
        const printable =
          value != null && !Array.isArray(value) && String(value).trim() !== "";
        out += printable ? String(value) : `[${node.name}]`;
        break;
      }
      case "if": {
        const branch = truthy(lookup(node.name, item, outer))
          ? node.consequent
          : node.alternate;
        out += renderNodes(branch, item, outer);
        break;
      }
      case "each": {
        const list = lookup(node.name, item, outer);
        if (!Array.isArray(list)) break;
        for (const entry of list) {
          out += renderNodes(node.body, entry, outer);
        }
        break;
      }
    }
  }
  return out;
}

export function renderTemplate(contenido: string, tokens: TemplateScope): string {
  const pieces = stripStandaloneLines(scan(contenido));
  return renderNodes(parse(pieces), null, tokens);
}

/**
 * The {{TOKEN}}s in a body. Block tags and the names they control ({{#if X}},
 * {{#each Y}}) are deliberately excluded: they are structure, not fields the
 * lawyer can be prompted for, and the detect-placeholders Route Handler feeds
 * exactly that prompt.
 */
export function extractPlaceholders(contenido: string): string[] {
  const found = new Set<string>();
  for (const p of scan(contenido)) {
    if (p.kind === "token") found.add(p.name);
  }
  return [...found];
}

// Unresolved markers left behind by renderTemplate (e.g. "[DOCUMENTO]").
export function extractUnresolved(rendered: string): string[] {
  const found = new Set<string>();
  for (const m of rendered.matchAll(/\[([A-Z0-9_]+)\]/g)) found.add(m[1]);
  return [...found];
}

// Tokens the lawyer is prompted for at generate time (§7). These cannot be
// derived from config/ejecutado/liquidación and must be filled manually.
export const MANUAL_INPUT_TOKENS = new Set<string>([
  "FECHA_PROVIDENCIA",
  "TIMBRADO_18_DIGITOS",
  "FECHA_DILIGENCIAMIENTO",
  "MONTO_TRANSFERENCIA",
  "MONTO_HONORARIOS",
  "MONTO_IVA",
  "MONTO_APORTES",
  "TOTAL_HONORARIOS",
  "FECHA_LIQUIDACION_ANTERIOR",
  "FECHA_HOY",
  "CAPITAL_IMPAGO",
  "INTERESES_TASA_BIP",
  "FECHA_PAGO",
  "TOTAL_NUEVA_LIQUIDACION",
  "TOTAL_PENDIENTE",
  "MONTO_LIQUIDACION_ANTERIOR",
  "BANCO",
  "SUCURSAL",
  "NUMERO_CUENTA",
  "CBU",
  // Demanda (2B): the page counts of the attached exhibits are physical facts
  // about the paperwork, not data the app holds — the two source demandas carry
  // 10 vs 12 fojas of resúmenes for otherwise identical documentation.
  "FOJAS_RESUMENES",
  "FOJAS_CONTRATO",
  "FOJAS_ACUSE",
]);

// The manual-input placeholders present in a template body.
export function detectManualPlaceholders(contenido: string): string[] {
  return extractPlaceholders(contenido).filter((t) => MANUAL_INPUT_TOKENS.has(t));
}
