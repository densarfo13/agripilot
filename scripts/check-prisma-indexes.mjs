#!/usr/bin/env node
/**
 * scripts/check-prisma-indexes.mjs — perf gate (doc + staged-migration
 * based; never runs a migration).
 * Fails if the index plan + staged SQL go missing, or if the staged
 * SQL contains anything destructive.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const doc = read('docs/PERFORMANCE_DB_INDEXES.md');
if (!doc) F.push('docs/PERFORMANCE_DB_INDEXES.md must exist');
else {
  for (const tok of ['tokenHash', 'organizationId', 'createdAt', 'status']) {
    if (!new RegExp(tok).test(doc)) F.push(`index doc must cover "${tok}"`);
  }
  if (!F.some((m) => m.startsWith('index doc'))) P.push('index plan documents the key access patterns');
}

const sql = read('server/prisma/_pending-migrations/perf_indexes.sql');
if (!sql) F.push('server/prisma/_pending-migrations/perf_indexes.sql must exist (staged)');
else {
  if (!/CREATE INDEX IF NOT EXISTS/i.test(sql))
    F.push('staged migration must use CREATE INDEX IF NOT EXISTS (idempotent, non-destructive)');
  else P.push('staged migration is additive CREATE INDEX IF NOT EXISTS');
  // No destructive statements.
  if (/\bDROP\s+(TABLE|COLUMN|INDEX)\b|\bTRUNCATE\b|\bALTER\s+TABLE[\s\S]*\bDROP\b/i.test(sql))
    F.push('staged migration must NOT contain destructive statements');
  else P.push('no destructive statements in staged migration');
  // Invite index uses the token HASH, never the raw token.
  if (/idx_invite_token(?!_hash)/.test(sql) || (/Invite/.test(sql) && !/tokenHash/.test(sql)))
    F.push('invite index must be on tokenHash (never the raw token)');
  else P.push('invite index uses tokenHash (no raw token)');
}

if (F.length) { console.error('[check:prisma-indexes] FAIL'); F.forEach((m)=>console.error('  ✗ '+m)); process.exit(1); }
console.log('[check:prisma-indexes] PASS — index plan documented, staged migration additive + safe.');
P.forEach((m)=>console.log('  ✓ '+m));
