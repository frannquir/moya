/**
 * Moya data migration — old Lovable (Supabase) CSV export -> new Supabase project.
 *
 * HIGHEST-STAKES script in the rewrite: it writes a paying firm's real data.
 * DRY-RUN IS THE DEFAULT. Nothing is written unless `--execute` is passed.
 *
 * Scope: ejecutados (incl. drafts) + cobros_pagos for Estudio Galante only (two old
 * users). Liquidaciones are NOT copied from the old DB — they're regenerated (execute
 * mode only) with the SAME generateLiquidacion() the app calls on create/update, so the
 * interest math has one source of truth. Honorarios are NOT migrated — Fran enters his
 * handful manually after the redesign.
 *
 * Idempotent: every new row id is uuidv5(oldId, NAMESPACE); upserts onConflict "id".
 * Child FKs (cobro.ejecutado_id) are recomputed with the same function, so re-runs
 * update in place instead of duplicating. Liquidaciones upsert onConflict "ejecutado_id".
 *
 * Usage:
 *   npm run migrate                          # dry-run (default), everything
 *   npm run migrate -- --only=ejecutados     # dry-run, ejecutados only
 *   npm run migrate -- --only=liquidaciones  # dry-run, liquidaciones only (counts)
 *   npm run migrate -- --execute             # WRITE to the DB
 *   npm run migrate -- --csv-dir=<path>      # override CSV directory
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { v5 as uuidv5 } from "uuid";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateLiquidacion } from "@/lib/data/liquidaciones";

// --- Load env from .env.local (new project URL + service-role key) ----------
loadEnv({ path: ".env.local" });

// Fixed namespace for deterministic uuidv5. LOAD-BEARING: never change this — a
// new value would remap every id and re-runs would duplicate rather than upsert.
const NAMESPACE = "6da14721-a2cb-492b-8ea2-5e3a243ac8f6";

// Old Estudio Galante users to migrate; everything else (incl. the test estudio
// 785ead60-...) is dropped. Row eligibility is keyed off the `targets` map built from
// these two ids (a row whose user_id isn't a target is skipped).
const OLD_USER_LAUTARO = "227df7bc-73e4-4b16-9336-c2b2cf63db66";
const OLD_USER_MATIAS = "0690a915-3ab8-422c-b8fe-c98e8cf44e97";

// New accounts (resolved by email at runtime — never hardcode new UUIDs).
const EMAIL_LAUTARO = "moyanolautaro.estudiogalante@gmail.com";
const EMAIL_MATIAS = "prussomatias@gmail.com";

const DEFAULT_CSV_DIR = "C:/Users/block/Downloads/db-export/db-export";

// Value maps (verified against the real export, Appendix A) -------------------
const MOVIMIENTO_MAP: Record<string, string> = {
  "Cedula": "Enviar Cédula",
  "Mandamiento": "Enviar Mandamiento",
  "Sentencia": "Pedir Sentencia",
  "Cobro": "En Cobro",
  "Inicio Causa": "Inicio Causa",
  "Cancelado": "Pedir Sentencia", // also archived — handled in transform
};
const MEDIDA_CAUTELAR_MAP: Record<string, string | null> = {
  "Embargo": "embargo",
  "IGB": "igb",
  "Ninguna": null,
};
// Gender flip — the new CHECK only accepts the feminine forms.
const MEDIDA_ESTADO_MAP: Record<string, string> = {
  "Solicitado": "Solicitada",
  "Proveído": "Proveída",
};
const EMPRESA_KNOWN = new Set(["Tartan", "Contar", "Promaq"]);
const COBRO_ESTADO_VALID = new Set(["Solicitado", "Proveído"]);

// Expected CSV headers — STOP on schema drift.
const EJECUTADOS_HEADERS = [
  "id", "user_id", "juzgado", "departamento", "numero_expediente", "demandado",
  "deuda_inicial", "gastos", "movimiento", "observaciones", "created_at",
  "updated_at", "codemandado", "diligenciada", "is_draft", "fecha_mora",
  "empresa", "medida_cautelar", "fecha_deuda", "medida_cautelar_nota",
  "practica_liquidacion", "medida_cautelar_estado", "medida_cautelar_diligenciada",
  "documento", "domicilio", "dinero_en_cuenta",
];
const COBROS_HEADERS = [
  "id", "user_id", "ejecutado_id", "monto", "estado", "nota", "fecha",
  "created_at", "updated_at",
];

// --- CLI --------------------------------------------------------------------
type Only = "ejecutados" | "cobros" | "liquidaciones" | "both";

interface Cli {
  execute: boolean;
  only: Only;
  csvDir: string;
}

function parseCli(argv: string[]): Cli {
  let execute = false;
  let only: Only = "both";
  let csvDir = process.env.MIGRATION_CSV_DIR ?? DEFAULT_CSV_DIR;

  for (const arg of argv) {
    if (arg === "--execute") execute = true;
    else if (arg === "--dry-run") execute = false; // explicit alias of the default
    else if (arg.startsWith("--only=")) {
      const v = arg.slice("--only=".length);
      if (v === "ejecutados" || v === "cobros" || v === "liquidaciones") only = v;
      else fail(`--only must be ejecutados|cobros|liquidaciones (got "${v}")`);
    } else if (arg.startsWith("--csv-dir=")) {
      csvDir = arg.slice("--csv-dir=".length);
    } else {
      fail(`unknown flag: ${arg}`);
    }
  }
  return { execute, only, csvDir };
}

// --- small helpers ----------------------------------------------------------
function fail(msg: string): never {
  console.error(`\n[FATAL] ${msg}\n`);
  process.exit(1);
}

const newId = (oldId: string) => uuidv5(oldId, NAMESPACE);

function loadCsv(dir: string, file: string): Record<string, string>[] {
  const path = resolve(dir, file);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    fail(`cannot read CSV: ${path}`);
  }
  return parse(text, { columns: true, skip_empty_lines: true, bom: true });
}

function assertHeaders(rows: Record<string, string>[], expected: string[], file: string) {
  if (rows.length === 0) fail(`${file} is empty`);
  const actual = new Set(Object.keys(rows[0]));
  const missing = expected.filter((c) => !actual.has(c));
  if (missing.length) fail(`${file} missing expected columns: ${missing.join(", ")}`);
  const extra = [...actual].filter((c) => !expected.includes(c));
  if (extra.length) console.warn(`  ! ${file} has unexpected extra columns (ignored): ${extra.join(", ")}`);
}

// Field coercion. Old export uses ISO dates, plain "."-decimal numbers, and
// Postgres "t"/"f" booleans.
const isEmpty = (v: string | undefined) => v === undefined || v.trim() === "";
const textOr = (v: string | undefined, fallback = "") => (v ?? fallback);
const nullIfEmpty = (v: string | undefined) => (isEmpty(v) ? null : v!.trim());

function num(v: string | undefined): number | null {
  if (isEmpty(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function numOrZero(v: string | undefined): number {
  return num(v) ?? 0;
}
function dateOrNull(v: string | undefined): string | null {
  return isEmpty(v) ? null : v!.trim();
}
function boolOrNull(v: string | undefined): boolean | null {
  if (isEmpty(v)) return null;
  if (v === "t" || v === "true") return true;
  if (v === "f" || v === "false") return false;
  return null;
}

// codemandado -> at most one public.codemandados row, name verbatim (Fran's
// decision 2026-06-02, unchanged by the 2026-08-20 move off the TEXT[]). The real
// data has no multi-value delimiter we can trust (commas are "APELLIDO, NOMBRE");
// the one two-defendant " Y " row stays combined. Everything but the name is left
// at its default - the old system never captured a codemandado's CUIL, domicilio
// or employer, and the demanda form is where that data starts existing.
function codemandadoNombre(v: string | undefined): string {
  return (v ?? "").trim();
}

// --- counters ---------------------------------------------------------------
interface Counters {
  read: number;
  migrated: number;
  skippedOtherUser: number;
  byUser: Record<string, number>;
}
const newCounters = (): Counters => ({ read: 0, migrated: 0, skippedOtherUser: 0, byUser: {} });

// --- target resolution (27.2) -----------------------------------------------
interface Target {
  createdBy: string;
  estudioId: string;
}

async function resolveUserIdByEmail(admin: SupabaseClient, email: string): Promise<string> {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) fail(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < perPage) break;
    page++;
  }
  fail(`account not found in NEW DB: ${email}. Create it before migrating.`);
}

async function resolveTargets(admin: SupabaseClient): Promise<Record<string, Target>> {
  const lautaroId = await resolveUserIdByEmail(admin, EMAIL_LAUTARO);
  const matiasId = await resolveUserIdByEmail(admin, EMAIL_MATIAS);

  const { data: lautaroMem, error: e1 } = await admin
    .from("estudio_members")
    .select("estudio_id")
    .eq("user_id", lautaroId)
    .maybeSingle();
  if (e1) fail(`reading ${EMAIL_LAUTARO} membership: ${e1.message}`);
  if (!lautaroMem) fail(`${EMAIL_LAUTARO} is not a member of any estudio.`);
  const sharedEstudioId = lautaroMem.estudio_id as string;

  const { data: matiasMem, error: e2 } = await admin
    .from("estudio_members")
    .select("estudio_id")
    .eq("user_id", matiasId)
    .maybeSingle();
  if (e2) fail(`reading ${EMAIL_MATIAS} membership: ${e2.message}`);
  if (!matiasMem) {
    fail(`${EMAIL_MATIAS} is not a member of any estudio. Add him to the shared estudio first.`);
  }
  if (matiasMem.estudio_id !== sharedEstudioId) {
    fail(
      `${EMAIL_MATIAS} is in a different estudio (${matiasMem.estudio_id}) than ` +
        `${EMAIL_LAUTARO} (${sharedEstudioId}). Move him to the shared estudio first.`,
    );
  }

  console.log("  Resolved targets:");
  console.log(`    ${EMAIL_LAUTARO} -> user ${lautaroId}`);
  console.log(`    ${EMAIL_MATIAS} -> user ${matiasId}`);
  console.log(`    shared estudio_id -> ${sharedEstudioId}`);

  return {
    [OLD_USER_LAUTARO]: { createdBy: lautaroId, estudioId: sharedEstudioId },
    [OLD_USER_MATIAS]: { createdBy: matiasId, estudioId: sharedEstudioId },
  };
}

// --- upsert helper ----------------------------------------------------------
async function upsert(
  admin: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  execute: boolean,
) {
  if (!execute) {
    console.log(`  [DRY RUN] would upsert ${rows.length} rows into ${table} (onConflict id)`);
    return;
  }
  // Chunk to keep payloads reasonable.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await admin.from(table).upsert(slice, { onConflict: "id" });
    if (error) fail(`upsert into ${table} failed at chunk ${i}: ${error.message}`);
  }
  console.log(`  [EXECUTE] upserted ${rows.length} rows into ${table}`);
}

// --- 27.3 ejecutados --------------------------------------------------------
export function migrateEjecutados(
  dir: string,
  targets: Record<string, Target>,
): {
  rows: Record<string, unknown>[];
  codemandadoRows: Record<string, unknown>[];
  counters: Counters;
  drafts: number;
  archived: number;
} {
  const csv = loadCsv(dir, "ejecutados.csv");
  assertHeaders(csv, EJECUTADOS_HEADERS, "ejecutados.csv");

  const counters = newCounters();
  const rows: Record<string, unknown>[] = [];
  const codemandadoRows: Record<string, unknown>[] = [];
  let drafts = 0;
  let archived = 0;
  const unmappedMovimiento = new Set<string>();
  const unmappedMedida = new Set<string>();
  const unmappedEstado = new Set<string>();
  const unknownEmpresa = new Set<string>();

  for (const old of csv) {
    counters.read++;
    const target = targets[old.user_id];
    if (!target) {
      counters.skippedOtherUser++;
      continue;
    }
    counters.byUser[old.user_id] = (counters.byUser[old.user_id] ?? 0) + 1;

    // movimiento
    const rawMov = (old.movimiento ?? "").trim();
    let movimiento: string | null = null;
    let isCancelado = false;
    if (rawMov !== "") {
      if (!(rawMov in MOVIMIENTO_MAP)) {
        unmappedMovimiento.add(rawMov);
        continue; // don't write an unmapped value; reported below as a STOP
      }
      movimiento = MOVIMIENTO_MAP[rawMov];
      isCancelado = rawMov === "Cancelado";
    }

    // medida_cautelar
    const rawMedida = (old.medida_cautelar ?? "").trim();
    let medida: string | null = null;
    if (rawMedida !== "") {
      if (!(rawMedida in MEDIDA_CAUTELAR_MAP)) {
        unmappedMedida.add(rawMedida);
        continue;
      }
      medida = MEDIDA_CAUTELAR_MAP[rawMedida];
    }

    // medida_cautelar_estado (gender flip)
    const rawEstado = (old.medida_cautelar_estado ?? "").trim();
    let medidaEstado: string | null = null;
    if (rawEstado !== "") {
      if (!(rawEstado in MEDIDA_ESTADO_MAP)) {
        unmappedEstado.add(rawEstado);
        continue;
      }
      medidaEstado = MEDIDA_ESTADO_MAP[rawEstado];
    }

    // empresa (1:1; no DB check, but flag unknowns)
    const empresa = nullIfEmpty(old.empresa);
    if (empresa && !EMPRESA_KNOWN.has(empresa)) unknownEmpresa.add(empresa);

    const isDraft = boolOrNull(old.is_draft) ?? false;
    if (isDraft) drafts++;

    const archivedAt = isCancelado
      ? (old.updated_at?.trim() || old.created_at?.trim() || new Date().toISOString())
      : null;
    if (archivedAt) archived++;

    rows.push({
      id: newId(old.id),
      estudio_id: target.estudioId,
      created_by_user_id: target.createdBy,
      // Delegate each migrated case to its creator (matches the SQL backfill in
      // 20260603120000_ejecutados_delegation.sql) so a re-run keeps delegation.
      assigned_to_user_id: target.createdBy,
      nombre: textOr(old.demandado),
      juzgado: textOr(old.juzgado),
      departamento: textOr(old.departamento),
      numero_expediente: textOr(old.numero_expediente),
      deuda_inicial: numOrZero(old.deuda_inicial),
      gastos: numOrZero(old.gastos),
      movimiento,
      observaciones: textOr(old.observaciones),
      fecha_mora: dateOrNull(old.fecha_mora),
      fecha_deuda: dateOrNull(old.fecha_deuda),
      practica_liquidacion: dateOrNull(old.practica_liquidacion),
      dinero_en_cuenta: num(old.dinero_en_cuenta),
      documento: textOr(old.documento),
      domicilio: textOr(old.domicilio),
      empresa,
      medida_cautelar: medida,
      medida_cautelar_estado: medidaEstado,
      medida_cautelar_nota: textOr(old.medida_cautelar_nota),
      medida_cautelar_diligenciada: boolOrNull(old.medida_cautelar_diligenciada) ?? false,
      movimiento_diligenciada: boolOrNull(old.diligenciada),
      is_draft: isDraft,
      created_at: nullIfEmpty(old.created_at),
      updated_at: nullIfEmpty(old.updated_at),
      archived_at: archivedAt,
      origen: "migracion",
    });

    // Sibling row in public.codemandados. The id is derived from the same old id
    // with a suffix, so re-runs upsert rather than duplicate and the NAMESPACE
    // constant stays untouched (gotcha #23).
    const cdNombre = codemandadoNombre(old.codemandado);
    if (cdNombre !== "") {
      codemandadoRows.push({
        id: newId(`${old.id}:codemandado:0`),
        estudio_id: target.estudioId,
        ejecutado_id: newId(old.id),
        created_by_user_id: target.createdBy,
        orden: 0,
        nombre: cdNombre,
        created_at: nullIfEmpty(old.created_at),
        updated_at: nullIfEmpty(old.updated_at),
        archived_at: archivedAt,
      });
    }
    counters.migrated++;
  }

  // STOP conditions: any value outside the mapping.
  const problems: string[] = [];
  if (unmappedMovimiento.size) problems.push(`movimiento: ${[...unmappedMovimiento].join(", ")}`);
  if (unmappedMedida.size) problems.push(`medida_cautelar: ${[...unmappedMedida].join(", ")}`);
  if (unmappedEstado.size) problems.push(`medida_cautelar_estado: ${[...unmappedEstado].join(", ")}`);
  if (problems.length) {
    fail(`Unmapped values found (would lose data — ask Fran):\n  ${problems.join("\n  ")}`);
  }
  if (unknownEmpresa.size) {
    console.warn(`  ! empresa values outside Tartan/Contar/Promaq (kept verbatim): ${[...unknownEmpresa].join(", ")}`);
  }

  return { rows, codemandadoRows, counters, drafts, archived };
}

// --- 27.4 cobros_pagos ------------------------------------------------------
export function migrateCobros(
  dir: string,
  targets: Record<string, Target>,
  migratedEjecutadoIds: Set<string>,
): { rows: Record<string, unknown>[]; counters: Counters; orphans: number } {
  const csv = loadCsv(dir, "cobros_pagos.csv");
  assertHeaders(csv, COBROS_HEADERS, "cobros_pagos.csv");

  const counters = newCounters();
  const rows: Record<string, unknown>[] = [];
  let orphans = 0;
  const badEstado = new Set<string>();

  for (const old of csv) {
    counters.read++;
    const target = targets[old.user_id];
    if (!target) {
      counters.skippedOtherUser++;
      continue;
    }
    counters.byUser[old.user_id] = (counters.byUser[old.user_id] ?? 0) + 1;

    const estado = (old.estado ?? "").trim();
    if (!COBRO_ESTADO_VALID.has(estado)) {
      badEstado.add(estado || "(empty)");
      continue;
    }

    const ejecutadoId = newId(old.ejecutado_id);
    if (!migratedEjecutadoIds.has(ejecutadoId)) {
      // FK would fail (ejecutado wasn't migrated). Log and skip.
      orphans++;
      console.warn(`  ! cobro ${old.id} references un-migrated ejecutado ${old.ejecutado_id} — skipped`);
      continue;
    }

    rows.push({
      id: newId(old.id),
      estudio_id: target.estudioId,
      ejecutado_id: ejecutadoId,
      created_by_user_id: target.createdBy,
      monto: numOrZero(old.monto),
      estado, // direct — stays masculine (new cobros enum is masculine)
      nota: textOr(old.nota),
      fecha: dateOrNull(old.fecha),
      created_at: nullIfEmpty(old.created_at),
    });
    counters.migrated++;
  }

  if (badEstado.size) {
    fail(`cobros_pagos.estado has values outside Solicitado/Proveído: ${[...badEstado].join(", ")}`);
  }

  return { rows, counters, orphans };
}

async function generateLiquidaciones(
  admin: SupabaseClient,
  ejecutadoRows: Record<string, unknown>[],
  execute: boolean,
): Promise<{ eligible: number; generated: number; skipped: number }> {
  const eligibleRows = ejecutadoRows.filter(
    (r) => r.fecha_mora != null && Number(r.deuda_inicial) > 0,
  );
  const eligible = eligibleRows.length;

  if (!execute) {
    console.log(
      `  [DRY RUN] would generate ~${eligible} liquidaciones ` +
        `(eligible ejecutados: fecha_mora set AND deuda_inicial > 0).`,
    );
    console.log(
      `    actual count can be lower if a row's fecha_mora falls outside the tasa range.`,
    );
    return { eligible, generated: 0, skipped: 0 };
  }

  let generated = 0;
  let skipped = 0;
  for (const r of eligibleRows) {
    const result = await generateLiquidacion(admin, r.id as string);
    if (result === "generated") generated++;
    else skipped++;
  }
  console.log(`  [EXECUTE] generated ${generated} liquidaciones (skipped ${skipped})`);
  return { eligible, generated, skipped };
}

// --- reporting --------------------------------------------------------------
function printCounters(label: string, c: Counters) {
  console.log(`  ${label}: read ${c.read} | migrated ${c.migrated} | skipped(other-user) ${c.skippedOtherUser}`);
  const byUser = Object.entries(c.byUser)
    .map(([u, n]) => `${u === OLD_USER_LAUTARO ? "Lautaro" : u === OLD_USER_MATIAS ? "Matías" : u}=${n}`)
    .join(", ");
  if (byUser) console.log(`    by user: ${byUser}`);
}

function sampleRows(rows: Record<string, unknown>[], keys: string[], n = 3) {
  for (const r of rows.slice(0, n)) {
    const picked = Object.fromEntries(keys.map((k) => [k, r[k]]));
    console.log("    " + JSON.stringify(picked));
  }
}

// --- main -------------------------------------------------------------------
async function main() {
  const cli = parseCli(process.argv.slice(2));

  console.log("\n========================================");
  console.log(" Moya migration — old CSV -> new Supabase");
  console.log("========================================");
  console.log(cli.execute ? " *** EXECUTE MODE — WILL WRITE ***" : " DRY RUN — no writes");
  console.log(` only:    ${cli.only}`);
  console.log(` csv-dir: ${cli.csvDir}`);
  console.log(` namespace: ${NAMESPACE}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.log(` target project: ${url}`);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\n[1/5] Resolving targets in the NEW DB by email...");
  const targets = await resolveTargets(admin);

  const summary: { table: string; read: number; migrated: number; skipped: number }[] = [];

  // ejecutados first (cobros FK to them; liquidaciones generate off them).
  let ejecutadoRows: Record<string, unknown>[] = [];
  let ejecutadoIds = new Set<string>();
  if (cli.only === "both" || cli.only === "ejecutados") {
    console.log("\n[2/5] ejecutados...");
    const { rows, codemandadoRows, counters, drafts, archived } = migrateEjecutados(cli.csvDir, targets);
    ejecutadoRows = rows;
    ejecutadoIds = new Set(rows.map((r) => r.id as string));
    printCounters("ejecutados", counters);
    console.log(`    drafts: ${drafts} | archived(Cancelado): ${archived}`);
    console.log("    sample transformed rows:");
    sampleRows(rows, ["nombre", "movimiento", "medida_cautelar", "medida_cautelar_estado", "empresa", "origen", "is_draft", "archived_at"]);
    await upsert(admin, "ejecutados", rows, cli.execute);
    summary.push({ table: "ejecutados", read: counters.read, migrated: counters.migrated, skipped: counters.skippedOtherUser });

    // codemandados must follow ejecutados: it FKs to them.
    console.log(`    codemandados: ${codemandadoRows.length} rows`);
    await upsert(admin, "codemandados", codemandadoRows, cli.execute);
    summary.push({ table: "codemandados", read: codemandadoRows.length, migrated: codemandadoRows.length, skipped: 0 });
  } else {
    // cobros-only / liquidaciones-only still need the transformed ejecutado set —
    // cobros for FK validation, liquidaciones to know which rows are eligible.
    const { rows } = migrateEjecutados(cli.csvDir, targets);
    ejecutadoRows = rows;
    ejecutadoIds = new Set(rows.map((r) => r.id as string));
  }

  if (cli.only === "both" || cli.only === "cobros") {
    console.log("\n[3/5] cobros_pagos...");
    const { rows, counters, orphans } = migrateCobros(cli.csvDir, targets, ejecutadoIds);
    printCounters("cobros_pagos", counters);
    if (orphans) console.log(`    orphans skipped (FK): ${orphans}`);
    console.log("    sample transformed rows:");
    sampleRows(rows, ["ejecutado_id", "monto", "estado", "nota", "fecha"]);
    await upsert(admin, "cobros_pagos", rows, cli.execute);
    summary.push({ table: "cobros_pagos", read: counters.read, migrated: counters.migrated, skipped: counters.skippedOtherUser });
  }

  // liquidaciones LAST — generated from the migrated ejecutados (same generator the app
  // uses). Dry-run only counts; --execute calls generateLiquidacion per eligible row.
  if (cli.only === "both" || cli.only === "liquidaciones") {
    console.log("\n[4/5] liquidaciones (generated, not copied)...");
    const { eligible, generated, skipped } = await generateLiquidaciones(
      admin,
      ejecutadoRows,
      cli.execute,
    );
    summary.push({
      table: "liquidaciones",
      read: ejecutadoRows.length,
      migrated: cli.execute ? generated : eligible,
      skipped: cli.execute ? skipped : 0,
    });
  }

  console.log("\n[5/5] Summary");
  console.log("  table          | read | migrated | skipped");
  console.log("  ---------------+------+----------+--------");
  for (const s of summary) {
    console.log(
      `  ${s.table.padEnd(14)} | ${String(s.read).padStart(4)} | ${String(s.migrated).padStart(8)} | ${String(s.skipped).padStart(7)}`,
    );
  }

  console.log(
    cli.execute
      ? "\nEXECUTE complete. Verify the data in the app.\n"
      : "\nDRY RUN complete — nothing was written. Re-run with `-- --execute` to write.\n",
  );
}

// Only run when invoked directly (so the transforms can be imported for tests
// without hitting the DB).
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
}
