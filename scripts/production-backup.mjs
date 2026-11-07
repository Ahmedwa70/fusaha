#!/usr/bin/env node
/**
 * Full pre-launch backup of the Fusaha production database (read-only operation).
 *
 * - Reads owner credentials from `.env.production-owner.local` (git-ignored).
 * - Runs `pg_dump -Fc` (PostgreSQL Custom Format) into ~/backups/fusaha-production/.
 * - Verifies WITHOUT restoring anywhere live:
 *     1. `pg_restore --list` succeeds and object counts are reported.
 *     2. Full SQL extraction (`pg_restore -f -`) completes with zero errors.
 *     3. Per-table row counts from the dump match live counts (owner connection).
 *     4. SHA-256 sidecar file is written next to the dump.
 *
 * Usage: node scripts/production-backup.mjs
 * No writes are performed against the source database at any point.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ENV_FILE = process.env.FUSABA_BACKUP_ENV_FILE || join(ROOT, ".env.production-owner.local");
const BACKUP_DIR = process.env.FUSABA_BACKUP_DIR || join(homedir(), "backups", "fusaha-production");

function loadEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    out[line.slice(0, idx).trim()] = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

function fail(msg) {
  console.error(`\n[backup] FAILED: ${msg}`);
  process.exit(1);
}

function which(bin) {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

const env = loadEnv(ENV_FILE);
let url = env.PRODUCTION_DATABASE_URL;
// Optional override (e.g. session-pooler variant) without touching the env file.
if (process.env.FUSABA_BACKUP_DATABASE_URL) url = process.env.FUSABA_BACKUP_DATABASE_URL;
if (!url || !url.startsWith("postgresql://")) {
  fail(`${ENV_FILE} does not contain a valid PRODUCTION_DATABASE_URL.`);
}

// Self-contained client toolchain (PostgreSQL 17.11, exact server match),
// falls back to PATH lookup.
const DEFAULT_BIN_DIR = "/tmp/pgclient/homebrew/opt/postgresql@17/bin";
const pgDump = env.PG_DUMP_BIN || (existsSync(join(DEFAULT_BIN_DIR, "pg_dump")) ? join(DEFAULT_BIN_DIR, "pg_dump") : which("pg_dump"));
const pgRestore = env.PG_RESTORE_BIN || (existsSync(join(DEFAULT_BIN_DIR, "pg_restore")) ? join(DEFAULT_BIN_DIR, "pg_restore") : which("pg_restore"));
if (!pgDump || !pgRestore) fail("pg_dump / pg_restore not found (set PG_DUMP_BIN / PG_RESTORE_BIN).");

console.log(`[backup] pg_dump:    ${pgDump}`);
console.log(`[backup] pg_restore: ${pgRestore}`);
console.log(`[backup] pg_dump ${execFileSync(pgDump, ["--version"], { encoding: "utf8" }).trim()}`);

mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dumpFile = join(BACKUP_DIR, `fusaha-production-${stamp}.dump`);

console.log(`[backup] target: ${dumpFile}`);

// ---- 1. Dump (custom format) -------------------------------------------------
const dumpArgs = ["-Fc", "--no-password", "--verbose", "-f", dumpFile, url];
const dump = spawnSync(pgDump, dumpArgs, { encoding: "utf8" });
if (dump.status !== 0) {
  console.error(dump.stderr);
  fail("pg_dump exited non-zero.");
}
console.log(`[backup] dump complete (${statSync(dumpFile).size} bytes)`);

// ---- 2. SHA-256 sidecar ------------------------------------------------------
const sha = createHash("sha256").update(readFileSync(dumpFile)).digest("hex");
writeFileSync(`${dumpFile}.sha256`, `${sha}  ${dumpFile.split("/").pop()}\n`);
console.log(`[backup] sha256: ${sha}`);

// ---- 3. Verify: archive list -------------------------------------------------
const list = execFileSync(pgRestore, ["--list", dumpFile], { encoding: "utf8" });
const objects = list.trim().split("\n").length;
const sections = {};
for (const m of list.matchAll(/^\d+; \d+ \d+ (TABLE|INDEX|CONSTRAINT|SEQUENCE|FUNCTION|VIEW|TRIGGER|FK CONSTRAINT|DATA) /gm)) {
  sections[m[1]] = (sections[m[1]] || 0) + 1;
}
console.log(`[backup] archive list OK: ${objects} entries`, sections);

// ---- 4. Verify: full SQL extraction, zero errors -----------------------------
const extract = spawnSync(pgRestore, ["-f", "-", dumpFile], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const fatal = (extract.stderr || "").split("\n").filter((l) => /error|fatal/i.test(l));
if (extract.status !== 0 || fatal.length > 0) {
  console.error(extract.stderr.slice(0, 4000));
  fail("pg_restore full extraction reported errors.");
}
console.log(`[backup] full extraction OK (${extract.stdout.length} chars of SQL)`);

// ---- 5. Verify: per-table row counts, dump vs live ---------------------------
const copyCounts = {};
for (const m of extract.stdout.matchAll(/COPY public\.([a-z_]+) \([^)]*\) FROM stdin;\n([\s\S]*?)^\\\.$/gm)) {
  copyCounts[m[1]] = m[2] === "" ? 0 : m[2].split("\n").filter((r) => r.length > 0).length;
}
console.log(`[backup] row counts captured for ${Object.keys(copyCounts).length} tables from dump`);

// Live counts via SQL connection (read-only SELECTs only), using psql.
const psql = env.PSQL_BIN || (existsSync(join(DEFAULT_BIN_DIR, "psql")) ? join(DEFAULT_BIN_DIR, "psql") : which("psql"));
const sql = (statement) =>
  execFileSync(psql, [url, "-X", "-A", "-t", "-c", statement], {
    encoding: "utf8",
    env: { ...process.env, PGCONNECT_TIMEOUT: "30" },
  }).trim();

const tables = sql(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`).split("\n").filter(Boolean);
console.log(`[backup] live cross-check against ${tables.length} public tables`);
let mismatches = 0;
for (const t of tables) {
  const live = Number(sql(`SELECT count(*) FROM public."${t}"`));
  const dumped = copyCounts[t];
  if (dumped === undefined) {
    console.log(`[backup]   ${t}: live=${live} NOT IN DUMP`);
    mismatches++;
  } else if (dumped !== live) {
    console.log(`[backup]   ${t}: live=${live} dump=${dumped}  <-- MISMATCH`);
    mismatches++;
  } else {
    console.log(`[backup]   ${t}: ${live} rows OK`);
  }
}
if (mismatches > 0) fail(`${mismatches} table count mismatch(es). Backup is NOT verified.`);

const report = {
  file: dumpFile,
  sizeBytes: statSync(dumpFile).size,
  sha256: sha,
  archiveObjects: objects,
  sections,
  tableRowCounts: copyCounts,
  pgDumpVersion: execFileSync(pgDump, ["--version"], { encoding: "utf8" }).trim(),
  createdAt: new Date().toISOString(),
};
writeFileSync(`${dumpFile}.report.json`, JSON.stringify(report, null, 2));
console.log(`\n[backup] SUCCESS — verified backup written:\n  ${dumpFile}`);
console.log(`[backup] report: ${dumpFile}.report.json`);
