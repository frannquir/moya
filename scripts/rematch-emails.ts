/**
 * Moya — bulk re-match of already-synced mail with the improved matcher.
 *   npm run rematch-emails                 # dry-run
 *   npm run rematch-emails -- --estudio=<id>
 *   npm run rematch-emails -- --execute    # WRITE matches to the DB
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  matchEmail,
  explainMatch,
  parseMevHeader,
  normalize,
  type EjecutadoRef,
} from "@/lib/domain/mail-match";

loadEnv({ path: ".env.local" });

const DEFAULT_OUT = "scripts/out/rematch-report.json";

interface Cli {
  execute: boolean;
  estudio: string | null;
  out: string;
  explain: string | null;
}

function fail(msg: string): never {
  console.error(`\n[FATAL] ${msg}\n`);
  process.exit(1);
}

function parseCli(argv: string[]): Cli {
  let execute = false;
  let estudio: string | null = null;
  let out = DEFAULT_OUT;
  let explain: string | null = null;
  for (const arg of argv) {
    if (arg === "--execute") execute = true;
    else if (arg === "--dry-run") execute = false;
    else if (arg.startsWith("--estudio=")) estudio = arg.slice("--estudio=".length);
    else if (arg.startsWith("--out=")) out = arg.slice("--out=".length);
    else if (arg.startsWith("--explain=")) explain = arg.slice("--explain=".length);
    else fail(`unknown flag: ${arg}`);
  }
  return { execute, estudio, out, explain };
}

interface EmailRow {
  id: string;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  from_email: string | null;
  ejecutado_id: string | null;
  candidate_ejecutado_id: string | null;
}

type Bucket = "assigned" | "candidate" | "unmatched";
function bucketOf(ejecutadoId: string | null, candidateId: string | null): Bucket {
  if (ejecutadoId) return "assigned";
  if (candidateId) return "candidate";
  return "unmatched";
}

interface Tally {
  assigned: number;
  candidate: number;
  unmatched: number;
}
const newTally = (): Tally => ({ assigned: 0, candidate: 0, unmatched: 0 });

interface ResidualGroup {
  from_email: string;
  demandado: string | null;
  causa: string | null;
  localidad: string | null; // parsed court city — surfaced to verify court parsing
  numero: number | null; // parsed court number
  count: number;
  sample_subject: string;
}

interface EstudioReport {
  estudio_id: string;
  emails: number;
  before: Tally;
  after: Tally;
  changed: number;
  residual: ResidualGroup[];
}

async function loadEjecutados(
  admin: SupabaseClient,
  estudioId: string,
): Promise<EjecutadoRef[]> {
  // Court number comes via the juzgado_id FK; juzgado_id itself isn't used for matching.
  const { data, error } = await admin
    .from("ejecutados")
    .select("id, nombre, numero_expediente, departamento, juzgado:juzgados(numero)")
    .eq("estudio_id", estudioId)
    .is("archived_at", null);
  if (error) fail(`load ejecutados (${estudioId}): ${error.message}`);
  type Row = {
    id: string;
    nombre: string;
    numero_expediente: string;
    departamento: string;
    juzgado: { numero: number | null } | { numero: number | null }[] | null;
  };
  return ((data ?? []) as Row[]).map((e) => {
    const juz = Array.isArray(e.juzgado) ? e.juzgado[0] : e.juzgado;
    return {
      id: e.id,
      nombre: e.nombre,
      numero_expediente: e.numero_expediente,
      departamento: e.departamento,
      juzgado_numero: juz?.numero ?? null,
    };
  });
}

async function loadEmails(
  admin: SupabaseClient,
  estudioId: string,
): Promise<EmailRow[]> {
  const { data, error } = await admin
    .from("emails")
    .select(
      "id, subject, snippet, body_text, from_email, ejecutado_id, candidate_ejecutado_id",
    )
    .eq("estudio_id", estudioId)
    .eq("match_manual", false)
    .is("archived_at", null);
  if (error) fail(`load emails (${estudioId}): ${error.message}`);
  return (data ?? []) as EmailRow[];
}

async function processEstudio(
  admin: SupabaseClient,
  estudioId: string,
  execute: boolean,
): Promise<EstudioReport> {
  const [ejecutados, emails] = await Promise.all([
    loadEjecutados(admin, estudioId),
    loadEmails(admin, estudioId),
  ]);

  const before = newTally();
  const after = newTally();
  const residual = new Map<string, ResidualGroup>();
  let changed = 0;

  for (const email of emails) {
    before[bucketOf(email.ejecutado_id, email.candidate_ejecutado_id)]++;

    const match = matchEmail(email, ejecutados);
    after[bucketOf(match.ejecutadoId, match.candidateId)]++;

    const changedRow =
      match.ejecutadoId !== email.ejecutado_id ||
      match.candidateId !== email.candidate_ejecutado_id;
    if (changedRow) {
      changed++;
      if (execute) {
        const { error } = await admin
          .from("emails")
          .update({
            ejecutado_id: match.ejecutadoId,
            candidate_ejecutado_id: match.candidateId,
            match_confidence: match.confidence,
          })
          .eq("id", email.id);
        if (error) fail(`update email ${email.id}: ${error.message}`);
      }
    }

    // Residual = still nothing after re-match. Group for Day 33 formalization.
    if (!match.ejecutadoId && !match.candidateId) {
      const header = parseMevHeader(
        `${email.subject ?? ""}\n${email.snippet ?? ""}\n${email.body_text ?? ""}`,
      );
      const demandado = header.demandado ? normalize(header.demandado) : null;
      const from = (email.from_email ?? "").toLowerCase();
      const key = `${from}|${demandado ?? ""}`;
      const g = residual.get(key);
      if (g) g.count++;
      else
        residual.set(key, {
          from_email: from,
          demandado,
          causa: header.causa,
          localidad: header.localidad,
          numero: header.numero,
          count: 1,
          sample_subject: email.subject ?? "",
        });
    }
  }

  return {
    estudio_id: estudioId,
    emails: emails.length,
    before,
    after,
    changed,
    residual: [...residual.values()].sort((a, b) => b.count - a.count),
  };
}

function printEstudio(r: EstudioReport, execute: boolean) {
  const verb = execute ? "re-matched" : "would re-match";
  console.log(`\nestudio ${r.estudio_id} — ${r.emails} non-manual emails`);
  console.log(
    `  before:  assigned=${r.before.assigned}  candidate=${r.before.candidate}  sin_asignar=${r.before.unmatched}`,
  );
  console.log(
    `  after:   assigned=${r.after.assigned}  candidate=${r.after.candidate}  sin_asignar=${r.after.unmatched}`,
  );
  const drop = r.before.unmatched - r.after.unmatched;
  console.log(
    `  ${verb} ${r.changed} rows · Sin Asignar ${drop >= 0 ? "−" : "+"}${Math.abs(drop)} (→ ${r.after.unmatched}) · residual clusters: ${r.residual.length}`,
  );
}

// --explain: print the parsed header + per-ejecutado scoring for emails whose text
// contains the needle, so we can see EXACTLY why a known case matches or doesn't.
async function runExplain(
  admin: SupabaseClient,
  estudioIds: string[],
  needle: string,
) {
  const low = needle.toLowerCase();
  for (const id of estudioIds) {
    const [ejecutados, emails] = await Promise.all([
      loadEjecutados(admin, id),
      loadEmails(admin, id),
    ]);
    const hits = emails.filter((e) =>
      `${e.subject ?? ""} ${e.snippet ?? ""} ${e.body_text ?? ""}`
        .toLowerCase()
        .includes(low),
    );
    if (hits.length === 0) continue;
    console.log(`\n### estudio ${id} — ${hits.length} email(s) matching "${needle}" (showing up to 3)`);
    for (const email of hits.slice(0, 3)) {
      const { header, ranked } = explainMatch(email, ejecutados);
      console.log(`\n— subject: ${email.subject}`);
      console.log(`  current row: ejecutado_id=${email.ejecutado_id ?? "—"} candidate=${email.candidate_ejecutado_id ?? "—"}`);
      console.log(`  parsed:   causa=${header.causa ?? "—"}  año=${header.año ?? "—"}  localidad=${header.localidad ?? "—"}  numero=${header.numero ?? "—"}  demandado=${header.demandado ?? "—"}`);
      console.log(`  top ejecutados by score:`);
      for (const s of ranked) {
        console.log(
          `    [${s.score}] ${s.nombre} | exp="${s.numero_expediente}" ejCausa=${s.ejCausa ?? "—"} causaHit=${s.causaHit} courtHit=${s.courtHit} conflict=${s.courtConflict} nameFull=${s.nameFull} canAuto=${s.canAuto}`,
        );
      }
    }
  }
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    fail("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  let estudioIds: string[];
  if (cli.estudio) {
    estudioIds = [cli.estudio];
  } else {
    const { data, error } = await admin.from("estudios").select("id");
    if (error) fail(`load estudios: ${error.message}`);
    estudioIds = (data ?? []).map((e: { id: string }) => e.id);
  }

  if (cli.explain) {
    console.log(`\n=== rematch-emails EXPLAIN "${cli.explain}" (localidad-court matcher) ===`);
    await runExplain(admin, estudioIds, cli.explain);
    return;
  }

  console.log(
    `\n=== rematch-emails (${cli.execute ? "EXECUTE — WRITING" : "DRY-RUN — no DB writes"}) ===`,
  );

  const reports: EstudioReport[] = [];
  for (const id of estudioIds) {
    const r = await processEstudio(admin, id, cli.execute);
    if (r.emails === 0) continue;
    reports.push(r);
    printEstudio(r, cli.execute);
  }

  const outPath = resolve(cli.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      { generated_at: new Date().toISOString(), mode: cli.execute ? "execute" : "dry-run", estudios: reports },
      null,
      2,
    ),
  );
  console.log(`\nreport → ${outPath}`);
  if (!cli.execute)
    console.log("dry-run: no rows written. Re-run with --execute to apply.\n");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
