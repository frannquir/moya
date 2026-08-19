/**
 * Moya — gap ejecutado finder (REPORT-ONLY, never writes to the DB).
 *
 * The migration copied only `ejecutados` + `cobros_pagos`. Several old tables still
 * reference ejecutados that may never have landed in the new DB — either dropped
 * (non-target user, unmapped movimiento) or simply never migrated. This mines those
 * tables from the OLD CSV export, maps each referenced old ejecutado id to its new id
 * with the SAME deterministic uuidv5 namespace the migration used, and checks which
 * ones are absent from the new `ejecutados` table.
 *
 * Pairs with the /mail/sin-asignar clusters: together they are the full "gap" picture.
 * Each gap is created from the UI — this script only reports.
 *
 * Usage:
 *   npx tsx scripts/find-gap-ejecutados.ts
 *   npx tsx scripts/find-gap-ejecutados.ts --csv-dir=<path>
 *
 * Output: scripts/out/gap-ejecutados.json (gitignored). Console prints COUNTS ONLY —
 * no names / causa / documento (no-PII rule).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parse } from "csv-parse/sync";
import { v5 as uuidv5 } from "uuid";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

// LOAD-BEARING: copied verbatim from scripts/migrate-from-old.ts. The new ejecutado
// id is uuidv5(oldId, NAMESPACE); a different value here would never line up with the
// migrated rows and every reference would look like a gap.
const NAMESPACE = "6da14721-a2cb-492b-8ea2-5e3a243ac8f6";

// Target users the migration kept (everyone else was intentionally dropped). Surfaced
// per gap so Fran can tell a real gap (target user) from an intentional drop.
const OLD_USER_LAUTARO = "227df7bc-73e4-4b16-9336-c2b2cf63db66";
const OLD_USER_MATIAS = "0690a915-3ab8-422c-b8fe-c98e8cf44e97";
const TARGET_USERS = new Set([OLD_USER_LAUTARO, OLD_USER_MATIAS]);

const DEFAULT_CSV_DIR = "C:/Users/block/Downloads/db-export/db-export";
const DEFAULT_OUT = "scripts/out/gap-ejecutados.json";

// Old tables that carry references to ejecutados. The FK column is `ejecutado_id` in
// the export; we also scan headers for anything containing "ejecutado" as a fallback.
const SOURCE_FILES = [
  "caducidades.csv",
  "ejecutado_notas.csv",
  "notas_generales.csv",
  "pagos_extrajudiciales.csv",
  "iniciados_por_mi.csv",
];
const ID_COLUMN_CANDIDATES = ["ejecutado_id", "ejecutadoId", "ejecutado"];

function fail(msg: string): never {
  console.error(`\n[FATAL] ${msg}\n`);
  process.exit(1);
}

const newId = (oldId: string) => uuidv5(oldId, NAMESPACE);

interface Cli {
  csvDir: string;
  out: string;
}

function parseCli(argv: string[]): Cli {
  let csvDir = process.env.MIGRATION_CSV_DIR ?? DEFAULT_CSV_DIR;
  let out = DEFAULT_OUT;
  for (const arg of argv) {
    if (arg.startsWith("--csv-dir=")) csvDir = arg.slice("--csv-dir=".length);
    else if (arg.startsWith("--out=")) out = arg.slice("--out=".length);
    else fail(`unknown flag: ${arg}`);
  }
  return { csvDir, out };
}

// Lenient loader: a missing/empty source table is a warning, not a stop — the export
// may not include every table.
function loadCsvSafe(dir: string, file: string): Record<string, string>[] | null {
  const path = resolve(dir, file);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.warn(`  ! ${file}: not found (skipped)`);
    return null;
  }
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Record<string, string>[];
  return rows;
}

function pickIdColumn(headers: string[]): string | null {
  for (const c of ID_COLUMN_CANDIDATES) if (headers.includes(c)) return c;
  return headers.find((h) => h.toLowerCase().includes("ejecutado")) ?? null;
}

// Old ejecutados export → context for each referenced id (demandado/causa/user) so the
// JSON report is actionable. Not all ids referenced by the child tables necessarily
// exist here (dangling references), hence the optional lookup.
interface OldEjecutado {
  demandado: string;
  numero_expediente: string;
  departamento: string;
  juzgado: string;
  user_id: string;
}

function loadOldEjecutados(dir: string): Map<string, OldEjecutado> {
  const map = new Map<string, OldEjecutado>();
  const rows = loadCsvSafe(dir, "ejecutados.csv");
  if (!rows) return map;
  for (const r of rows) {
    if (!r.id) continue;
    map.set(r.id, {
      demandado: r.demandado ?? "",
      numero_expediente: r.numero_expediente ?? "",
      departamento: r.departamento ?? "",
      juzgado: r.juzgado ?? "",
      user_id: r.user_id ?? "",
    });
  }
  return map;
}

interface GapRef {
  source_table: string;
  old_ejecutado_id: string;
  new_ejecutado_id: string;
  // Enrichment from the old ejecutados export (null when the id is dangling).
  demandado: string | null;
  numero_expediente: string | null;
  departamento: string | null;
  old_user_id: string | null;
  belonged_to_target_user: boolean | null;
  reference_count: number; // how many rows in this table point at the ejecutado
}

interface TableScan {
  table: string;
  rows_scanned: number;
  id_column: string | null;
  distinct_refs: number;
  // distinct old ejecutado ids referenced from this table
  refs: Map<string, number>; // oldId -> count
}

function scanTable(dir: string, file: string): TableScan {
  const rows = loadCsvSafe(dir, file);
  if (!rows) {
    return { table: file, rows_scanned: 0, id_column: null, distinct_refs: 0, refs: new Map() };
  }
  if (rows.length === 0) {
    return { table: file, rows_scanned: 0, id_column: null, distinct_refs: 0, refs: new Map() };
  }
  const headers = Object.keys(rows[0]);
  const idColumn = pickIdColumn(headers);
  const refs = new Map<string, number>();
  if (idColumn) {
    for (const r of rows) {
      const id = (r[idColumn] ?? "").trim();
      if (id) refs.set(id, (refs.get(id) ?? 0) + 1);
    }
  }
  return {
    table: file,
    rows_scanned: rows.length,
    id_column: idColumn,
    distinct_refs: refs.size,
    refs,
  };
}

// Which of the given NEW ids exist in the new ejecutados table (chunked IN query).
async function existingNewIds(
  admin: SupabaseClient,
  ids: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  const CHUNK = 300;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await admin
      .from("ejecutados")
      .select("id")
      .in("id", slice);
    if (error) fail(`querying ejecutados existence: ${error.message}`);
    for (const row of data ?? []) found.add((row as { id: string }).id);
  }
  return found;
}

async function main() {
  const cli = parseCli(process.argv.slice(2));

  console.log("\n=== find-gap-ejecutados (REPORT-ONLY — no DB writes) ===");
  console.log(` csv-dir: ${cli.csvDir}`);
  console.log(` namespace: ${NAMESPACE}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    fail("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const oldEjecutados = loadOldEjecutados(cli.csvDir);

  // Scan every source table, collect distinct referenced old ejecutado ids.
  const scans = SOURCE_FILES.map((f) => scanTable(cli.csvDir, f));
  const allOldIds = new Set<string>();
  for (const s of scans) for (const id of s.refs.keys()) allOldIds.add(id);

  // Map old -> new, check which new ids exist, derive the gap (absent ones).
  const oldToNew = new Map<string, string>();
  for (const oldId of allOldIds) oldToNew.set(oldId, newId(oldId));
  const present = await existingNewIds(admin, [...oldToNew.values()]);

  const gapByTable: Record<string, GapRef[]> = {};
  const distinctGapOldIds = new Set<string>();

  for (const scan of scans) {
    const gaps: GapRef[] = [];
    for (const [oldId, count] of scan.refs) {
      const newEjId = oldToNew.get(oldId)!;
      if (present.has(newEjId)) continue; // landed in the new DB — not a gap
      distinctGapOldIds.add(oldId);
      const old = oldEjecutados.get(oldId) ?? null;
      gaps.push({
        source_table: scan.table,
        old_ejecutado_id: oldId,
        new_ejecutado_id: newEjId,
        demandado: old?.demandado ?? null,
        numero_expediente: old?.numero_expediente ?? null,
        departamento: old?.departamento ?? null,
        old_user_id: old?.user_id ?? null,
        belonged_to_target_user: old ? TARGET_USERS.has(old.user_id) : null,
        reference_count: count,
      });
    }
    gaps.sort((a, b) => b.reference_count - a.reference_count);
    gapByTable[scan.table] = gaps;
  }

  // Console: COUNTS ONLY (no-PII rule).
  console.log("\n  table                      | rows | id col       | refs | gap");
  console.log("  ---------------------------+------+--------------+------+----");
  for (const scan of scans) {
    const gap = gapByTable[scan.table].length;
    console.log(
      `  ${scan.table.padEnd(26)} | ${String(scan.rows_scanned).padStart(4)} | ` +
        `${(scan.id_column ?? "(none)").padEnd(12)} | ${String(scan.distinct_refs).padStart(4)} | ${String(gap).padStart(3)}`,
    );
  }
  const targetGap = [...distinctGapOldIds].filter((id) => {
    const old = oldEjecutados.get(id);
    return old ? TARGET_USERS.has(old.user_id) : false;
  }).length;
  console.log(
    `\n  distinct gap ejecutados: ${distinctGapOldIds.size} ` +
      `(of target users: ${targetGap})`,
  );

  const outPath = resolve(cli.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        csv_dir: cli.csvDir,
        namespace: NAMESPACE,
        summary: scans.map((s) => ({
          table: s.table,
          rows_scanned: s.rows_scanned,
          id_column: s.id_column,
          distinct_refs: s.distinct_refs,
          gap: gapByTable[s.table].length,
        })),
        distinct_gap_ejecutados: distinctGapOldIds.size,
        gap_by_table: gapByTable,
      },
      null,
      2,
    ),
  );
  console.log(`\n  report -> ${outPath} (gitignored; contains names — do not commit)\n`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
