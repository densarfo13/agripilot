#!/usr/bin/env node
/**
 * check-prisma-safety.mjs
 *
 * CI guard — fails if any script or docs instruction contains the
 * Prisma `--accept-data-loss` flag on a deploy / production path.
 *
 * Why: `prisma db push --accept-data-loss` silently drops tables +
 * columns when the schema diverges. That's fine for local dev on a
 * throwaway DB, catastrophic for Railway/production. Use
 * `prisma migrate deploy` on anything that touches real farmer data.
 *
 *   node scripts/ci/check-prisma-safety.mjs
 *     → exits 0 when safe, 1 with a loud error otherwise.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

// Files we scan. Kept tight so this script stays fast and
// deterministic — we don't grep node_modules or build output.
const TARGETS = [
  'package.json',
  'server/package.json',
  'deploy.sh',
  'Dockerfile',
  'docker-compose.yml',
  'railway.toml',
  'render.yaml',
  '.github/workflows',
];

// Explicit allow-list — files that are ONLY about local dev and
// explicitly document the data-loss risk. Nothing is allow-listed by
// default; add with a code comment justifying the exception.
const ALLOWLIST = new Set([
  // e.g. 'scripts/dev-reset.sh',
]);

const FORBIDDEN = /--accept-data-loss/;

function scanFile(absPath, rel) {
  if (ALLOWLIST.has(rel)) return null;
  try {
    const text = fs.readFileSync(absPath, 'utf8');
    if (!FORBIDDEN.test(text)) return null;
    const line = text.split('\n').findIndex((l) => FORBIDDEN.test(l)) + 1;
    return { file: rel, line, match: '--accept-data-loss' };
  } catch { return null; }
}

function walk(absDir, rel, acc) {
  let entries;
  try { entries = fs.readdirSync(absDir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const next = path.join(absDir, e.name);
    const nextRel = path.join(rel, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      walk(next, nextRel, acc);
    } else {
      const hit = scanFile(next, nextRel);
      if (hit) acc.push(hit);
    }
  }
}

const hits = [];
for (const t of TARGETS) {
  const abs = path.join(ROOT, t);
  if (!fs.existsSync(abs)) continue;
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) walk(abs, t, hits);
  else {
    const hit = scanFile(abs, t);
    if (hit) hits.push(hit);
  }
}

if (hits.length === 0) {
  console.log('\u2713 prisma-safety: no --accept-data-loss usage on deploy paths');
  process.exit(0);
}

console.error('\u2717 prisma-safety: FORBIDDEN flag found — will destroy production data');
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  \u2192  ${h.match}`);
}
console.error('');
console.error('Fix: replace `prisma db push --accept-data-loss` with `prisma migrate deploy`.');
console.error('Add a one-time migration under server/prisma/migrations, commit, redeploy.');
process.exit(1);
