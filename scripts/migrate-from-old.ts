/**
 * Moya data migration — old Lovable (Supabase) CSV export -> new Supabase project.
 *
 * HIGHEST-STAKES script in the rewrite: it writes a paying firm's real data.
 * DRY-RUN IS THE DEFAULT. Nothing is written unless `--execute` is passed.
 *
 * Scope: ejecutados (incl. drafts) + cobros_pagos for Estudio Galante only (two old
 * users). Liquidaciones are NOT copied from the old DB — they're regenerated (execute
 * mode only) with the SAME generateLiquidacion() the app calls on create/update, so the
 * interest math has one source of truth.
 *
 * Honorarios (added 2026-09-19, Fran): the BASE is never copied. Every non-archived
 * ejecutado gets one at 7 JUS from trg_ejecutado_default_honorario, and per Fran the
 * two old rows at 2.5 / 3.5 JUS collapse into that same default — so there is nothing
 * to transfer for 24 of the 26 old honorarios. What IS copied is the collection
 * history: honorarios_pagos. Two consequences drive the code below:
 *   - honorarios has UNIQUE(ejecutado_id), so a honorario is never INSERTed for a live
 *     case (the trigger already made it) — its id is looked up instead.
 *   - the trigger SKIPS archived cases, so a Cancelado case that was actually paid has
 *     no honorario to hang its pagos on. Those, and only those, are inserted here.
 * Old monto_total_ars is dropped on purpose: the new schema has no peso column on
 * honorarios, and max_acordado_ars means a ceiling negotiated with the debtor — writing
 * an old arancel-in-pesos there would silently switch the pago trigger to peso units.
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
import { normalizeNumeroExpediente } from "@/lib/domain/ejecutado";

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
  "documento", "domicilio", "dinero_en_cuenta", "fecha_gastos", "interes_gastos",
];
const COBROS_HEADERS = [
  "id", "user_id", "ejecutado_id", "monto", "estado", "nota", "fecha",
  "created_at", "updated_at",
];
const HONORARIOS_HEADERS = [
  "id", "user_id", "ejecutado_id", "monto_total_jus", "monto_total_ars",
  "created_at", "updated_at",
];
const HONORARIOS_PAGOS_HEADERS = [
  "id", "user_id", "honorario_id", "monto_jus", "monto_ars", "nota", "fecha",
  "created_at",
];

// Mirrors create_default_honorario() in 20260905120000_honorarios_max_acordado.sql.
// If the trigger's default ever changes, an inserted honorario for an archived case
// must change with it or the two creation paths disagree.
const DEFAULT_HONORARIO_JUS = 7;
// CHECK (monto_jus > 0), from 20260604120000_honorarios_redesign.sql.
const MIN_PAGO_JUS = 0;

// --- CLI --------------------------------------------------------------------
type Only = "ejecutados" | "cobros" | "honorarios" | "liquidaciones" | "both";

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
      if (v === "ejecutados" || v === "cobros" || v === "honorarios" || v === "liquidaciones") only = v;
      else fail(`--only must be ejecutados|cobros|honorarios|liquidaciones (got "${v}")`);
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
  onConflict = "id",
) {
  if (!execute) {
    console.log(`  [DRY RUN] would upsert ${rows.length} rows into ${table} (onConflict ${onConflict})`);
    return;
  }
  // Chunk to keep payloads reasonable.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await admin.from(table).upsert(slice, { onConflict });
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
  const badExpediente = new Set<string>();

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

    // Expediente: run the inherited free-text mess through the SAME normalizer the
    // form and the mail matcher use, so migrated rows land in the canonical shape
    // ("TD1436 2021" -> "TD-1436-2021", "3815 2021" -> "3815/2021") instead of
    // re-importing a format the UI would now reject. Input with no causa number is
    // kept verbatim and reported below: it is data for Fran, not a reason to abort.
    const rawExpediente = textOr(old.numero_expediente);
    const numeroExpediente = normalizeNumeroExpediente(rawExpediente);
    if (rawExpediente.trim() !== "" && !/\d/.test(numeroExpediente)) {
      badExpediente.add(`${old.id}: ${rawExpediente.trim()}`);
    }

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
      numero_expediente: numeroExpediente,
      deuda_inicial: numOrZero(old.deuda_inicial),
      gastos: numOrZero(old.gastos),
      fecha_gastos: dateOrNull(old.fecha_gastos),
      // num, NOT numOrZero: the column is nullable and "not entered" must stay
      // NULL. generateLiquidacion() and the liquidación snapshot both preserve
      // that distinction on purpose (20260807140000_gastos_interes.sql), so a 0
      // here would make an un-entered interés look like a decided zero.
      interes_gastos: num(old.interes_gastos),
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
  if (badExpediente.size) {
    console.warn(
      `  ! expediente sin número de causa (guardado verbatim, el form lo rechazaría): ` +
        `${[...badExpediente].join("; ")}`,
    );
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

// --- 27.5 honorarios + honorarios_pagos -------------------------------------
// Read both CSVs and work out what actually has to be written. The base amount is
// never carried over (see the header): the only honorarios built here are the ones
// the trigger will not build, i.e. archived cases that hold a real payment.
export function migrateHonorarios(
  dir: string,
  targets: Record<string, Target>,
  ejecutadoRows: Record<string, unknown>[],
): {
  honorarioRows: Record<string, unknown>[];
  pagos: { oldEjecutadoId: string; row: Record<string, unknown> }[];
  counters: Counters;
  rejectedPagos: string[];
  orphanPagos: number;
  overCap: string[];
} {
  const honCsv = loadCsv(dir, "honorarios.csv");
  assertHeaders(honCsv, HONORARIOS_HEADERS, "honorarios.csv");
  const pagoCsv = loadCsv(dir, "honorarios_pagos.csv");
  assertHeaders(pagoCsv, HONORARIOS_PAGOS_HEADERS, "honorarios_pagos.csv");

  // archived_at is set by migrateEjecutados for movimiento='Cancelado'; those are
  // exactly the cases trg_ejecutado_default_honorario declines to serve.
  const archivedEjecutados = new Set(
    ejecutadoRows.filter((r) => r.archived_at != null).map((r) => r.id as string),
  );
  const migratedEjecutados = new Set(ejecutadoRows.map((r) => r.id as string));

  const counters = newCounters();
  const rejectedPagos: string[] = [];
  const overCap: string[] = [];
  let orphanPagos = 0;

  // old honorario id -> its old ejecutado id, so a pago can find its case.
  const honToEjecutado = new Map<string, string>();
  const honBase = new Map<string, number>();
  for (const h of honCsv) {
    honToEjecutado.set(h.id, h.ejecutado_id);
    honBase.set(h.id, num(h.monto_total_jus) ?? 0);
  }

  // Pass 1 — the pagos, because they decide which honorarios are worth creating.
  const pagos: { oldEjecutadoId: string; row: Record<string, unknown> }[] = [];
  const paidByHonorario = new Map<string, number>();
  for (const old of pagoCsv) {
    counters.read++;
    const target = targets[old.user_id];
    if (!target) {
      counters.skippedOtherUser++;
      continue;
    }
    counters.byUser[old.user_id] = (counters.byUser[old.user_id] ?? 0) + 1;

    const montoJus = num(old.monto_jus) ?? 0;
    if (!(montoJus > MIN_PAGO_JUS)) {
      // CHECK (monto_jus > 0) would reject the INSERT outright. Reported, not fatal:
      // it is one miskeyed row, not a reason to withhold the other fourteen.
      rejectedPagos.push(`${old.id} (monto_jus=${old.monto_jus}, monto_ars=${old.monto_ars})`);
      continue;
    }

    const oldEjecutadoId = honToEjecutado.get(old.honorario_id);
    if (!oldEjecutadoId) {
      orphanPagos++;
      console.warn(`  ! pago ${old.id} references unknown honorario ${old.honorario_id} — skipped`);
      continue;
    }
    if (!migratedEjecutados.has(newId(oldEjecutadoId))) {
      orphanPagos++;
      console.warn(`  ! pago ${old.id} hangs off un-migrated ejecutado ${oldEjecutadoId} — skipped`);
      continue;
    }

    paidByHonorario.set(old.honorario_id, (paidByHonorario.get(old.honorario_id) ?? 0) + montoJus);

    pagos.push({
      oldEjecutadoId,
      row: {
        id: newId(old.id),
        estudio_id: target.estudioId,
        created_by_user_id: target.createdBy,
        monto_jus: montoJus,
        monto_ars: numOrZero(old.monto_ars),
        nota: textOr(old.nota),
        fecha: dateOrNull(old.fecha),
        created_at: nullIfEmpty(old.created_at),
        // honorario_id is resolved against the DB once the ejecutados are in.
      },
    });
    counters.migrated++;
  }

  // check_honorario_pago_cap() rejects a pago above base x 1.31. Every case lands at
  // the 7 JUS default, so the ceiling is 9.17 — pre-checked here to turn a mid-run
  // Postgres exception into a line of output before anything is written.
  const cap = Math.round(DEFAULT_HONORARIO_JUS * 1.31 * 100) / 100;
  for (const [honId, paid] of paidByHonorario) {
    if (paid > cap) overCap.push(`${honId}: ${paid} JUS > ${cap} JUS`);
  }

  // Pass 2 — honorarios for archived cases that hold at least one importable pago.
  // A closed case with nothing collected gets nothing, matching the trigger's own
  // reasoning ("a fee nobody will collect is noise on /honorarios").
  const honorarioRows: Record<string, unknown>[] = [];
  for (const h of honCsv) {
    const target = targets[h.user_id];
    if (!target) continue;
    const newEjecutadoId = newId(h.ejecutado_id);
    if (!archivedEjecutados.has(newEjecutadoId)) continue; // trigger already made it
    if (!(paidByHonorario.get(h.id) ?? 0)) continue; // closed and unpaid — skip
    const base = honBase.get(h.id) ?? 0;
    if (base !== DEFAULT_HONORARIO_JUS) {
      console.warn(
        `  ! honorario ${h.id} (archivado) tenía ${base} JUS; se inserta a ` +
          `${DEFAULT_HONORARIO_JUS} JUS como el resto (decisión Fran 2026-09-19)`,
      );
    }
    honorarioRows.push({
      id: newId(h.id),
      estudio_id: target.estudioId,
      ejecutado_id: newEjecutadoId,
      created_by_user_id: target.createdBy,
      monto_total_jus: DEFAULT_HONORARIO_JUS,
      created_at: nullIfEmpty(h.created_at),
      updated_at: nullIfEmpty(h.updated_at),
    });
  }

  return { honorarioRows, pagos, counters, rejectedPagos, orphanPagos, overCap };
}

// honorarios.id is gen_random_uuid() when the trigger writes it, so it cannot be
// derived — it has to be read back per ejecutado_id (which is UNIQUE).
async function resolveHonorarioIds(
  admin: SupabaseClient,
  ejecutadoIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const CHUNK = 200;
  for (let i = 0; i < ejecutadoIds.length; i += CHUNK) {
    const slice = ejecutadoIds.slice(i, i + CHUNK);
    const { data, error } = await admin
      .from("honorarios")
      .select("id, ejecutado_id")
      .in("ejecutado_id", slice);
    if (error) fail(`reading honorarios: ${error.message}`);
    for (const row of data ?? []) map.set(row.ejecutado_id as string, row.id as string);
  }
  return map;
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

  console.log("\n[1/6] Resolving targets in the NEW DB by email...");
  const targets = await resolveTargets(admin);

  const summary: { table: string; read: number; migrated: number; skipped: number }[] = [];

  // ejecutados first (cobros FK to them; liquidaciones generate off them).
  let ejecutadoRows: Record<string, unknown>[] = [];
  let ejecutadoIds = new Set<string>();
  if (cli.only === "both" || cli.only === "ejecutados") {
    console.log("\n[2/6] ejecutados...");
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
    // cobros / honorarios / liquidaciones-only still need the transformed ejecutado
    // set — cobros for FK validation, honorarios to know which cases arrive archived,
    // liquidaciones to know which rows are eligible.
    const { rows } = migrateEjecutados(cli.csvDir, targets);
    ejecutadoRows = rows;
    ejecutadoIds = new Set(rows.map((r) => r.id as string));
  }

  if (cli.only === "both" || cli.only === "cobros") {
    console.log("\n[3/6] cobros_pagos...");
    const { rows, counters, orphans } = migrateCobros(cli.csvDir, targets, ejecutadoIds);
    printCounters("cobros_pagos", counters);
    if (orphans) console.log(`    orphans skipped (FK): ${orphans}`);
    console.log("    sample transformed rows:");
    sampleRows(rows, ["ejecutado_id", "monto", "estado", "nota", "fecha"]);
    await upsert(admin, "cobros_pagos", rows, cli.execute);
    summary.push({ table: "cobros_pagos", read: counters.read, migrated: counters.migrated, skipped: counters.skippedOtherUser });
  }

  // honorarios AFTER ejecutados: the default honorario is written by an AFTER INSERT
  // trigger on ejecutados, so the rows this step reads back do not exist until the
  // ejecutados upsert above has actually run.
  if (cli.only === "both" || cli.only === "honorarios") {
    console.log("\n[4/6] honorarios (base from the trigger; pagos copied)...");
    const { honorarioRows, pagos, counters, rejectedPagos, orphanPagos, overCap } =
      migrateHonorarios(cli.csvDir, targets, ejecutadoRows);

    if (overCap.length) {
      fail(
        `pagos over the 1.31x ceiling — check_honorario_pago_cap() would reject them ` +
          `mid-run:\n  ${overCap.join("\n  ")}`,
      );
    }
    if (rejectedPagos.length) {
      console.warn(
        `  ! ${rejectedPagos.length} pago(s) rejected by CHECK (monto_jus > 0), NOT imported:\n` +
          `      ${rejectedPagos.join("\n      ")}`,
      );
    }
    if (orphanPagos) console.log(`    orphan pagos skipped (FK): ${orphanPagos}`);

    console.log(
      `    honorarios inserted for archived cases: ${honorarioRows.length} ` +
        `(live cases already have one from the trigger, at ${DEFAULT_HONORARIO_JUS} JUS)`,
    );
    await upsert(admin, "honorarios", honorarioRows, cli.execute, "ejecutado_id");
    summary.push({
      table: "honorarios",
      read: honorarioRows.length,
      migrated: honorarioRows.length,
      skipped: 0,
    });

    let pagoRows: Record<string, unknown>[] = [];
    let unresolved = 0;
    if (cli.execute) {
      const honorarioByEjecutado = await resolveHonorarioIds(
        admin,
        [...new Set(pagos.map((p) => newId(p.oldEjecutadoId)))],
      );
      for (const p of pagos) {
        const honorarioId = honorarioByEjecutado.get(newId(p.oldEjecutadoId));
        if (!honorarioId) {
          unresolved++;
          console.warn(
            `  ! no honorario row for ejecutado ${p.oldEjecutadoId} — pago skipped`,
          );
          continue;
        }
        pagoRows.push({ ...p.row, honorario_id: honorarioId });
      }
    } else {
      // Nothing was written, so the honorario ids cannot be read back yet. Count the
      // intent rather than reporting a zero that only means "dry run".
      pagoRows = pagos.map((p) => p.row);
      console.log("    [DRY RUN] honorario_id is resolved from the DB in execute mode.");
    }

    printCounters("honorarios_pagos", counters);
    console.log("    sample transformed rows:");
    sampleRows(pagoRows, ["monto_jus", "monto_ars", "nota", "fecha"]);
    await upsert(admin, "honorarios_pagos", pagoRows, cli.execute);
    summary.push({
      table: "honorarios_pagos",
      read: counters.read,
      migrated: pagoRows.length,
      skipped: counters.read - pagoRows.length + unresolved,
    });
  }

  // liquidaciones LAST — generated from the migrated ejecutados (same generator the app
  // uses). Dry-run only counts; --execute calls generateLiquidacion per eligible row.
  if (cli.only === "both" || cli.only === "liquidaciones") {
    console.log("\n[5/6] liquidaciones (generated, not copied)...");
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

  console.log("\n[6/6] Summary");
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
