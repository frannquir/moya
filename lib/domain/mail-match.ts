
export interface EjecutadoRef {
  id: string;
  nombre: string; // "Apellido, Nombre" or free text
  numero_expediente: string; // free text: bare digits, "OL-840-2019", "TD1436 2021"…
  juzgado_id: string | null; // FK to juzgados; null on the few unlinked rows
  departamento: string; // seat city / localidad, e.g. "Olavarría" (court fallback)
}

export interface JuzgadoRef {
  id: string;
  tipo: string; // "Juzgado Civil y Comercial" | "Juzgado de Paz" | "Receptoria…"
  numero: number | null;
  localidad: string; // seat city, e.g. "Olavarría", "Tandil", "Mar del Plata"
}

export interface MailInput {
  subject?: string | null;
  snippet?: string | null;
  body_text?: string | null;
  from_email?: string | null;
}

export interface MailMatch {
  ejecutadoId: string | null; // set only on a confident AUTO match
  candidateId: string | null; // set on a weaker, human-confirmable match
  confidence: number; // 0..1
}

export interface ParsedHeader {
  causa: string | null; // número de causa, leading-zero-stripped
  año: string | null; // optional year (yearly reset disambiguator)
  tipo: string | null; // court type from Organismo
  numero: number | null; // court number from Organismo ("Nº 1" → 1)
  localidad: string | null; // seat city from the Organismo tail
  demandado: string | null; // defendant name from the Carátula (between C/ and S/)
}

// --- Tunable scoring ---------------------------------------------------------
// Confidence = clamp(score / 10). AUTO additionally requires the identifying gate
export const W_CAUSA = 6; // identifying — número de causa equality
export const W_COURT = 4; // corroborator — juzgado_id (or localidad) match
export const W_NAME_FULL = 5; // full defendant-name match
export const W_NAME_TOKEN = 1; // per shared name token (≥4 chars), capped
export const W_NAME_TOKEN_CAP = 3;
export const W_COURT_CONFLICT = -8; // causa hits but the court is a different one
export const W_AÑO_CONFLICT = -5; // same causa, different year

export const AUTO_ATTACH = 0.9;
export const CANDIDATE_FLOOR = 0.5;
export const CANDIDATE_CAP = 0.85; // a candidate never looks as sure as an auto-match

// --- Text helpers ------------------------------------------------------------
export function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string | null | undefined): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 4);
}

// Collapsed, accent-free key for fuzzy locality comparison.
function locKey(s: string | null | undefined): string {
  return normalize(s).replace(/\s+/g, "");
}

// Bounded Levenshtein — tolerant of the SCBA encoding gremlins ("Olavarr¡a" vs
// "Olavarría") and minor typos in short city names.
function levBounded(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function localidadMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = locKey(a);
  const kb = locKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // Allow one edit for short names; require a solid shared prefix otherwise.
  return levBounded(ka, kb, 1) <= 1;
}

function tipoClass(s: string | null | undefined): string {
  const n = normalize(s);
  if (n.includes("civil") && n.includes("comercial")) return "civil";
  if (n.includes("paz")) return "paz";
  if (n.includes("recept")) return "receptoria";
  return "";
}

// --- Causa extraction --------------------------------------------------------
// Canonical from BOTH sides: the mail's "Nro de causa" / subject, and the stored
// `numero_expediente` (bare digits, "OL-840-2019", "TD1436 2021", "16183 - 2024"…).
// Rule: an optional 2–3 letter departamento prefix, then the FIRST digit run is the
// causa (1–7 digits); a trailing 4-digit run that looks like a year is the año.
export function extractCausa(raw: string | null | undefined): {
  causa: string | null;
  depto: string | null;
  año: string | null;
} {
  const s = (raw ?? "").trim();
  if (!s) return { causa: null, depto: null, año: null };

  const prefix = s.match(/^([A-Za-z]{2,3})(?=[\s\-]*\d)/);
  const depto = prefix ? prefix[1].toUpperCase() : null;
  const rest = prefix ? s.slice(prefix[1].length) : s;

  const nums = rest.match(/\d+/g);
  if (!nums || nums.length === 0) return { causa: null, depto, año: null };

  const first = nums[0];
  if (first.length > 7) return { causa: null, depto, año: null };
  const causa = first.replace(/^0+/, "") || first; // normalize leading zeros

  let año: string | null = null;
  const last = nums[nums.length - 1];
  if (nums.length > 1 && /^(19|20)\d{2}$/.test(last)) año = last;

  return { causa, depto, año };
}

// Pull a causa out of free text: prefer an explicit "Causa: N" / "Nro de causa: N",
// else a composite like "OL-840-2019".
function causaFromText(text: string): { causa: string | null; año: string | null } {
  const labelled = text.match(/causa\s*:?\s*([A-Za-z]{0,3}[-\s]?\d{1,7}(?:[-/\s]\d{2,4})?)/i);
  if (labelled) {
    const { causa, año } = extractCausa(labelled[1]);
    if (causa) return { causa, año };
  }
  const composite = text.match(/\b[A-Za-z]{2,3}[-\s]?\d{1,7}[-/\s]\d{2,4}\b/);
  if (composite) {
    const { causa, año } = extractCausa(composite[0]);
    if (causa) return { causa, año };
  }
  return { causa: null, año: null };
}

// --- MEV header parsing ------------------------------------------------------
function field(text: string, label: RegExp): string | null {
  const m = text.match(label);
  return m ? m[1].trim() : null;
}

export function parseMevHeader(text: string): ParsedHeader {
  const organismo = field(text, /organismo\s*:?\s*([^\n\r]+)/i);
  const caratula = field(text, /car[aá]tula\s*:?\s*([^\n\r]+)/i);
  const causaLine = field(text, /n(?:ro|°|º)?\.?\s*de\s*causa\s*:?\s*([^\n\r]+)/i);

  // Causa: the labelled line first, then any composite/labelled mention in the text.
  let causa: string | null = null;
  let año: string | null = null;
  if (causaLine) {
    const ex = extractCausa(causaLine);
    causa = ex.causa;
    año = ex.año;
  }
  if (!causa) {
    const fromText = causaFromText(text);
    causa = fromText.causa;
    año = año ?? fromText.año;
  } else if (!año) {
    año = causaFromText(text).año;
  }

  // Organismo → tipo / numero / localidad ("Juzgado Civil y Comercial Nº 1 Olavarría").
  let tipo: string | null = null;
  let numero: number | null = null;
  let localidad: string | null = null;
  if (organismo) {
    const m = organismo.match(/^(.*?)\s+n[°ºo]\s*(\d+)\s+(.+?)\s*$/i);
    if (m) {
      tipo = m[1].trim();
      numero = Number(m[2]);
      localidad = m[3].trim();
    } else {
      // No number (Paz / Receptoría): take the city after the last " de " / " en ".
      const tail = organismo.match(/(?:\bde\b|\ben\b|-)\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ¡¿.\s]+?)\s*$/);
      tipo = organismo.trim();
      localidad = tail ? tail[1].trim() : null;
    }
  }

  // Carátula → demandado: text after "C/", cut at "Y OTRO…" or "S/".
  let demandado: string | null = null;
  if (caratula) {
    const afterC = caratula.split(/\s+c\/\s+/i)[1];
    if (afterC) {
      demandado = afterC
        .split(/\s+y\s+otro\b|\s+y\s+otra\b|\s+y\s+otros\b|\s+s\/\s+/i)[0]
        .replace(/[.\-\s]+$/, "")
        .trim();
    }
  }

  return { causa, año, tipo, numero, localidad, demandado };
}

// --- Court resolution --------------------------------------------------------
// Map the mail's parsed Organismo to a single juzgado_id. tipo+numero is NOT unique
// (Azul has a "Nº 1" in both Olavarría and Tandil) — localidad is the disambiguator.
export function resolveJuzgadoId(
  header: ParsedHeader,
  juzgados: JuzgadoRef[],
): string | null {
  const cls = tipoClass(header.tipo);
  if (!cls || !header.localidad) return null;
  const hits = juzgados.filter(
    (j) =>
      tipoClass(j.tipo) === cls &&
      (header.numero == null || j.numero === header.numero) &&
      localidadMatch(header.localidad, j.localidad),
  );
  return hits.length === 1 ? hits[0].id : null;
}

// Defendant name: full match if one side contains the other, or every mail-name
// token (≥4 chars) is present in the ejecutado name.
function nameSignals(
  demandado: string | null,
  ejNombre: string,
): { full: boolean; shared: number } {
  if (!demandado) return { full: false, shared: 0 };
  const mtok = tokens(demandado);
  const etok = tokens(ejNombre);
  if (mtok.length === 0) return { full: false, shared: 0 };
  const shared = mtok.filter((t) => etok.includes(t)).length;
  const nm = normalize(demandado);
  const ne = normalize(ejNombre);
  const contains = nm.length > 0 && (ne.includes(nm) || nm.includes(ne));
  return { full: contains || shared === mtok.length, shared };
}

// --- The matcher -------------------------------------------------------------
export function matchEmail(
  mail: MailInput,
  ejecutados: EjecutadoRef[],
  juzgados: JuzgadoRef[],
): MailMatch {
  const text = `${mail.subject ?? ""}\n${mail.snippet ?? ""}\n${mail.body_text ?? ""}`;
  const header = parseMevHeader(text);
  const mailJuzgadoId = resolveJuzgadoId(header, juzgados);

  type Scored = { id: string; score: number; canAuto: boolean; hasCausa: boolean };
  const scored: Scored[] = [];

  for (const e of ejecutados) {
    const ec = extractCausa(e.numero_expediente);
    const causaHit = !!header.causa && !!ec.causa && ec.causa === header.causa;

    const courtHit = mailJuzgadoId
      ? e.juzgado_id === mailJuzgadoId
      : !!header.localidad && localidadMatch(header.localidad, e.departamento);
    const courtConflict = mailJuzgadoId
      ? !!e.juzgado_id && e.juzgado_id !== mailJuzgadoId
      : !!header.localidad &&
        !!e.departamento &&
        !localidadMatch(header.localidad, e.departamento);

    const { full: nameFull, shared } = nameSignals(header.demandado, e.nombre);
    const añoConflict = !!header.año && !!ec.año && header.año !== ec.año;

    let score = 0;
    if (causaHit) score += W_CAUSA;
    if (courtHit) score += W_COURT;
    if (nameFull) score += W_NAME_FULL;
    else score += Math.min(W_NAME_TOKEN_CAP, shared * W_NAME_TOKEN);
    if (causaHit && courtConflict) score += W_COURT_CONFLICT;
    if (añoConflict) score += W_AÑO_CONFLICT;

    if (score <= 0) continue;

    // AUTO gate: causa (identifying) + a corroborator, with no contradicting signal.
    const canAuto =
      causaHit && (courtHit || nameFull) && !courtConflict && !añoConflict;
    scored.push({ id: e.id, score, canAuto, hasCausa: causaHit });
  }

  if (scored.length === 0) return { ejecutadoId: null, candidateId: null, confidence: 0 };

  scored.sort((a, b) => b.score - a.score || Number(b.canAuto) - Number(a.canAuto));
  const top = scored[0];
  const second = scored[1];
  const tie = !!second && second.score === top.score;
  const confidence = Math.min(1, top.score / 10);

  // AUTO: confident, gated, and unambiguous.
  if (top.canAuto && !tie) {
    return { ejecutadoId: top.id, candidateId: null, confidence };
  }

  // CANDIDATE: above the floor. Drop a top tie that has no identifying signal —
  // a name-only coin-flip shouldn't silently file into someone's folder.
  if (confidence >= CANDIDATE_FLOOR) {
    if (tie && !top.hasCausa) {
      return { ejecutadoId: null, candidateId: null, confidence: 0 };
    }
    return {
      ejecutadoId: null,
      candidateId: top.id,
      confidence: Math.min(CANDIDATE_CAP, confidence),
    };
  }

  return { ejecutadoId: null, candidateId: null, confidence: 0 };
}
