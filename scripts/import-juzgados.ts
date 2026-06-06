/**
 * Import / monthly refresh of the `juzgados` reference table from the SCBA scrape.
 *
 * Source: supabase/seed-data/juzgados.json (committed snapshot — public govt data,
 * not PII) or any --json=<path> (e.g. the live scraper output at
 * C:\Work\juzgados\juzgados.json).
 *
 * Idempotent: upserts onConflict "fuente" (the stable SCBA idrep URL). Existing rows
 * are updated in place — `id` is never sent, so it never changes and
 * ejecutados.juzgado_id stays valid. Rows that disappear from the scrape are NOT
 * deleted (would orphan FKs); prune manually if ever needed.
 *
 * DRY-RUN IS THE DEFAULT. Nothing is written unless `--execute` is passed.
 *
 * Usage:
 *   npm run import-juzgados                       # dry-run, committed snapshot
 *   npm run import-juzgados -- --execute          # WRITE to the DB
 *   npm run import-juzgados -- --json=C:/Work/juzgados/juzgados.json --execute
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { type Database } from "@/lib/supabase/types";

loadEnv({ path: ".env.local" });

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const jsonArg = args.find((a) => a.startsWith("--json="))?.slice("--json=".length);
const JSON_PATH = resolve(jsonArg ?? "supabase/seed-data/juzgados.json");

// Scrape stores ASCII departamento display names; map to canonical accented forms.
const DEPTO_ACCENTS: Record<string, string> = {
  "Avellaneda - Lanus": "Avellaneda - Lanús",
  "Bahia Blanca": "Bahía Blanca",
  "General San Martin": "General San Martín",
  Junin: "Junín",
  "Moreno - General Rodriguez": "Moreno - General Rodríguez",
  Moron: "Morón",
  "San Nicolas": "San Nicolás",
  "Zarate Campana": "Zárate - Campana",
};

type ScrapeRecord = {
  departamento_judicial: string;
  organismo: string;
  direccion: string;
  localidad: string;
  telefono: string;
  internos: string[];
  email: string;
  juez: string;
  fuero: string;
  numero: number | null;
  fuente: string;
  tipo: string;
};

type JuzgadoInsert = Database["public"]["Tables"]["juzgados"]["Insert"];

function toRow(r: ScrapeRecord): JuzgadoInsert {
  return {
    departamento_judicial: DEPTO_ACCENTS[r.departamento_judicial] ?? r.departamento_judicial,
    organismo: r.organismo,
    tipo: r.tipo,
    fuero: r.fuero ?? "",
    numero: r.numero,
    direccion: r.direccion ?? "",
    localidad: r.localidad ?? "",
    telefono: r.telefono ?? "",
    email: r.email ?? "",
    juez: r.juez ?? "",
    internos: r.internos ?? [],
    fuente: r.fuente,
  };
}

async function main() {
  const raw = JSON.parse(readFileSync(JSON_PATH, "utf-8")) as ScrapeRecord[];
  const withKey = raw.filter((r) => r.fuente && r.fuente.trim() !== "");
  const skipped = raw.length - withKey.length;
  const rows = withKey.map(toRow);

  const byTipo = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.tipo] = (acc[r.tipo] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Source: ${JSON_PATH}`);
  console.log(`Records: ${raw.length} (importable: ${rows.length}, skipped no-fuente: ${skipped})`);
  for (const [tipo, n] of Object.entries(byTipo)) console.log(`  ${tipo}: ${n}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Report new vs existing for visibility (both modes).
  const { data: existing, error: selErr } = await supabase.from("juzgados").select("fuente");
  if (selErr) throw selErr;
  const existingSet = new Set((existing ?? []).map((e) => e.fuente));
  const toInsert = rows.filter((r) => !existingSet.has(r.fuente)).length;
  console.log(`\nWould insert: ${toInsert} new, update: ${rows.length - toInsert} existing.`);

  if (!EXECUTE) {
    console.log("\nDRY-RUN: no changes written. Re-run with --execute to apply.");
    return;
  }

  const { error } = await supabase
    .from("juzgados")
    .upsert(rows, { onConflict: "fuente", ignoreDuplicates: false });
  if (error) throw error;

  console.log(`\nDONE: upserted ${rows.length} juzgados.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
