// Template engine (port of the old templateEngine.ts). Replaces known {{TOKEN}}s
// from the provided sources; any unresolved {{X}} stays visible as [X] so the
// lawyer fills it before filing.

const TOKEN_RE = /\{\{([A-Z0-9_]+)\}\}/g;

export function renderTemplate(
  contenido: string,
  tokens: Record<string, string | null | undefined>,
): string {
  return contenido.replace(TOKEN_RE, (_match, key: string) => {
    const value = tokens[key];
    return value != null && String(value).trim() !== "" ? String(value) : `[${key}]`;
  });
}

export function extractPlaceholders(contenido: string): string[] {
  const found = new Set<string>();
  for (const m of contenido.matchAll(TOKEN_RE)) found.add(m[1]);
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
]);

// The manual-input placeholders present in a template body.
export function detectManualPlaceholders(contenido: string): string[] {
  return extractPlaceholders(contenido).filter((t) => MANUAL_INPUT_TOKENS.has(t));
}
