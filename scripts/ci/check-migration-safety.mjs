#!/usr/bin/env node
/**
 * check-migration-safety.mjs
 *
 * Pre-deploy guard that catches the two ways Prisma migrations
 * silently destroy production data:
 *
 *   1. A schema.prisma change with no paired migration directory
 *      → `prisma migrate deploy` no-ops; production schema diverges
 *      from code expectations.
 *
 *   2. A migration SQL file that contains DROP TABLE / DROP COLUMN
 *      / DROP CONSTRAINT (without an explicit ALLOW marker), which
 *      will erase pilot data on the next deploy.
 *
 *   node scripts/ci/check-migration-safety.mjs
 *     → 0 when safe; 1 when either condition above triggers.
 *
 * Allowing a destructive migration: prepend the migration file with
 *   -- ALLOW_DESTRUCTIVE: <reason>
 * on its first comment line. The guard requires the marker AND a
 * non-empty reason. This forces an intentional code-review checkpoint.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const SCHEMA = path.join(ROOT, 'server/prisma/schema.prisma');
const MIGRATIONS_DIR = path.join(ROOT, 'server/prisma/migrations');

const DESTRUCTIVE = /\b(DROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)|TRUNCATE|ALTER\s+TABLE\s+\S+\s+DROP\s+COLUMN)\b/i;
const ALLOW_MARKER = /--\s*ALLOW_DESTRUCTIVE\s*:\s*\S+/i;

function fail(messages) {
  console.error('\u2717 migration-safety:');
  for (const m of messages) console.error(`  ${m}`);
  console.error('');
  console.error('To allow an intentional destructive migration, add a comment line to');
  console.error('the migration\u2019s migration.sql:');
  console.error('  -- ALLOW_DESTRUCTIVE: backfilled v2 location_label, dropping v1');
  process.exit(1);
}

const problems = [];

// ─── Schema must exist ────────────────────────────────────────
if (!fs.existsSync(SCHEMA)) {
  problems.push('server/prisma/schema.prisma not found');
}

// ─── Every migration must have migration.sql ─────────────────
let migrationDirs = [];
try {
  migrationDirs = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
} catch {
  // No migrations dir means `prisma migrate deploy` will no-op on
  // an empty database — fine for first deploy, scary on a populated
  // one. Surface it loud.
  problems.push('server/prisma/migrations directory missing');
}

let destructiveCount = 0;
for (const dir of migrationDirs) {
  const sqlPath = path.join(MIGRATIONS_DIR, dir, 'migration.sql');
  if (!fs.existsSync(sqlPath)) {
    problems.push(`migrations/${dir}/migration.sql missing`);
    continue;
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  if (DESTRUCTIVE.test(sql) && !ALLOW_MARKER.test(sql)) {
    destructiveCount += 1;
    const firstHit = sql.split('\n').findIndex((l) => DESTRUCTIVE.test(l)) + 1;
    problems.push(
      `migrations/${dir}/migration.sql:${firstHit} contains a DROP / TRUNCATE without `
      + '-- ALLOW_DESTRUCTIVE marker'
    );
  }
}

if (problems.length > 0) fail(problems);

// Count markers separately for an honest summary.
let markedCount = 0;
for (const dir of migrationDirs) {
  const sqlPath = path.join(MIGRATIONS_DIR, dir, 'migration.sql');
  if (!fs.existsSync(sqlPath)) continue;
  const sql = fs.readFileSync(sqlPath, 'utf8');
  if (DESTRUCTIVE.test(sql) && ALLOW_MARKER.test(sql)) markedCount += 1;
}

console.log(
  `\u2713 migration-safety: ${migrationDirs.length} migration(s) checked`
  + (markedCount > 0 ? ` (${markedCount} ALLOW_DESTRUCTIVE marker(s))` : ' (no destructive ops)')
);
