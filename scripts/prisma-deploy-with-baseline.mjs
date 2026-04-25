#!/usr/bin/env node
/**
 * prisma-deploy-with-baseline.mjs
 *
 * Wraps `prisma migrate deploy` with ONE-TIME P3005 recovery.
 *
 * The previous Farroway deploy command was `prisma db push
 * --accept-data-loss --skip-generate`, which creates tables but
 * never records migration history in `_prisma_migrations`. After
 * Fix 1 of the production-stability sprint switched the start
 * command to `prisma migrate deploy`, the existing production DB
 * crashed with:
 *
 *   Error: P3005
 *   The database schema is not empty.
 *
 * Prisma refuses to run because it can't tell which of the 16
 * checked-in migrations have already been applied to the live
 * tables — running them blindly would either no-op or corrupt
 * existing rows.
 *
 * This script handles the recovery once and then behaves like a
 * normal `migrate deploy` on every subsequent deploy:
 *
 *   1. Run `prisma migrate deploy`.
 *   2. If it succeeds → done.
 *   3. If it fails AND the failure was P3005 → list every
 *      migration directory on disk, run
 *      `prisma migrate resolve --applied <name>` for each one to
 *      mark them as already-applied (the safe way to baseline an
 *      existing schema), then retry `migrate deploy`.
 *   4. Exit non-zero on any other failure.
 *
 * Safe to run on every boot. Once `_prisma_migrations` is
 * populated, step 1 succeeds and step 3 never fires.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SERVER_DIR = path.resolve(ROOT, 'server');
const MIGRATIONS_DIR = path.resolve(SERVER_DIR, 'prisma/migrations');

const SHELL = process.platform === 'win32';

function runDeploy() {
  console.log('[prisma] migrate deploy...');
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: SERVER_DIR,
    encoding: 'utf8',
    shell: SHELL,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return {
    code: result.status == null ? 1 : result.status,
    output: `${result.stdout || ''}\n${result.stderr || ''}`,
  };
}

function isP3005(output) {
  return /\bP3005\b/.test(output)
      || /database schema is not empty/i.test(output);
}

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function resolveOne(name) {
  const r = spawnSync('npx',
    ['prisma', 'migrate', 'resolve', '--applied', name],
    { cwd: SERVER_DIR, stdio: 'inherit', shell: SHELL },
  );
  return r.status === 0;
}

function baseline() {
  const migrations = listMigrations();
  if (migrations.length === 0) {
    console.error('[prisma] no migrations on disk to baseline. Aborting.');
    return false;
  }
  console.log(`[prisma] P3005 detected — baselining ${migrations.length} migration(s) as applied:`);
  for (const m of migrations) {
    console.log(`  → ${m}`);
    if (!resolveOne(m)) {
      console.error(`[prisma] resolve --applied ${m} failed. Aborting.`);
      return false;
    }
  }
  console.log('[prisma] baseline complete.');
  return true;
}

function main() {
  const first = runDeploy();
  if (first.code === 0) return 0;

  if (!isP3005(first.output)) {
    console.error('[prisma] migrate deploy failed (not P3005). Exiting.');
    return first.code || 1;
  }

  console.log('[prisma] entering one-time baseline recovery.');
  if (!baseline()) return 1;

  const second = runDeploy();
  if (second.code !== 0) {
    console.error('[prisma] migrate deploy still failing after baseline. Manual intervention required.');
  }
  return second.code || 0;
}

process.exit(main());
