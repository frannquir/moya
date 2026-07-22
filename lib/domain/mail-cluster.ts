// Cluster unassigned MEV mail by the court case it belongs to, so the head can create
// the missing ejecutado from each group. A "cluster" is one court case: the matcher
// left these mails unassigned because the firm never loaded the ejecutado, so every
// cluster maps to exactly one ejecutado to create.
//
// Pure TS over lib/domain/mail-match parsing. The /mail/sin-asignar page and the
// createEjecutado attach step both reuse it so the UI and the server-side recompute
// can't drift.

import {
  parseMevHeader,
  normalize,
  localidadMatch,
  type ParsedHeader,
} from "./mail-match";

export interface ClusterMailInput {
  id: string;
  subject?: string | null;
  snippet?: string | null;
  body_text?: string | null;
  from_email?: string | null;
  received_at?: string | null;
}

export interface MailCluster {
  key: string;
  causa: string;
  año: string | null;
  localidad: string | null;
  tipo: string | null; // organismo type, e.g. "Juzgado Civil y Comercial"
  numero: number | null; // court number
  demandado: string | null; // most frequent parsed defendant name in the cluster
  count: number;
  firstDate: string | null;
  lastDate: string | null;
  sampleSubjects: string[]; // up to 2 distinct subjects, for the card
}

// Parse the same text the matcher reads (subject + snippet + body).
export function headerOfMail(mail: ClusterMailInput): ParsedHeader {
  return parseMevHeader(
    `${mail.subject ?? ""}\n${mail.snippet ?? ""}\n${mail.body_text ?? ""}`,
  );
}

// Collapsed, accent-free locality token (mirrors mail-match's internal locKey) so
// the cluster key matches the matcher's composite identity.
function locKey(s: string | null | undefined): string {
  return normalize(s).replace(/\s+/g, "");
}

// Composite cluster identity: causa + normalized localidad + court number. Two mails
// with the same number in different cities never collapse together.
export function clusterKey(
  causa: string,
  localidad: string | null,
  numero: number | null,
): string {
  return `${causa}|${locKey(localidad)}|${numero ?? ""}`;
}

interface Acc {
  key: string;
  causa: string;
  año: string | null;
  localidad: string | null;
  tipo: string | null;
  numero: number | null;
  demandadoCounts: Map<string, number>;
  count: number;
  firstDate: string | null;
  firstTs: number;
  lastDate: string | null;
  lastTs: number;
  subjects: string[];
}

export function clusterUnassigned(mails: ClusterMailInput[]): MailCluster[] {
  const map = new Map<string, Acc>();

  for (const mail of mails) {
    const header = headerOfMail(mail);
    // Keep only mails with a parsed causa: this is what filters out non-MEV noise
    // (Temu/Steam/Rappi/password-resets parse to causa=null).
    if (!header.causa) continue;

    const key = clusterKey(header.causa, header.localidad, header.numero);
    let acc = map.get(key);
    if (!acc) {
      acc = {
        key,
        causa: header.causa,
        año: header.año,
        localidad: header.localidad,
        tipo: header.tipo,
        numero: header.numero,
        demandadoCounts: new Map(),
        count: 0,
        firstDate: null,
        firstTs: Infinity,
        lastDate: null,
        lastTs: -Infinity,
        subjects: [],
      };
      map.set(key, acc);
    }

    acc.count++;
    // These are consistent within a causa; keep the first non-null we see.
    if (acc.año == null) acc.año = header.año;
    if (acc.localidad == null) acc.localidad = header.localidad;
    if (acc.tipo == null) acc.tipo = header.tipo;
    if (acc.numero == null) acc.numero = header.numero;

    const demandado = header.demandado?.trim();
    if (demandado) {
      acc.demandadoCounts.set(demandado, (acc.demandadoCounts.get(demandado) ?? 0) + 1);
    }

    const ts = mail.received_at ? new Date(mail.received_at).getTime() : NaN;
    if (Number.isFinite(ts)) {
      if (ts < acc.firstTs) {
        acc.firstTs = ts;
        acc.firstDate = mail.received_at ?? null;
      }
      if (ts > acc.lastTs) {
        acc.lastTs = ts;
        acc.lastDate = mail.received_at ?? null;
      }
    }

    const subject = (mail.subject ?? "").trim();
    if (subject && acc.subjects.length < 2 && !acc.subjects.includes(subject)) {
      acc.subjects.push(subject);
    }
  }

  return [...map.values()]
    .map((acc) => ({
      key: acc.key,
      causa: acc.causa,
      año: acc.año,
      localidad: acc.localidad,
      tipo: acc.tipo,
      numero: acc.numero,
      demandado: mostFrequent(acc.demandadoCounts),
      count: acc.count,
      firstDate: acc.firstDate,
      lastDate: acc.lastDate,
      sampleSubjects: acc.subjects,
    }))
    .sort((a, b) => b.count - a.count || a.causa.localeCompare(b.causa));
}

function mostFrequent(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = 0;
  for (const [value, n] of counts) {
    if (n > bestN) {
      best = value;
      bestN = n;
    }
  }
  return best;
}

// Locality compatibility used when recomputing a cluster server-side: both-missing
// counts as the same (noisy) cluster; one-present-one-missing never matches; both
// present use the matcher's mojibake-tolerant compare.
export function localidadCompatible(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = (a ?? "").trim();
  const nb = (b ?? "").trim();
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  return localidadMatch(a, b);
}

// True when a parsed mail header belongs to the (causa, localidad) cluster. Used by
// createEjecutado to attach unassigned mail to a newly created ejecutado without
// shipping email-id lists through the URL.
export function mailMatchesCluster(
  header: ParsedHeader,
  causa: string,
  localidad: string | null,
): boolean {
  if (!header.causa || header.causa !== causa) return false;
  return localidadCompatible(header.localidad, localidad);
}
