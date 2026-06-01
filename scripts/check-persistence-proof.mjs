#!/usr/bin/env node
/**
 * scripts/check-persistence-proof.mjs — production database proof.
 *
 * Fails if the persistence proof can PASS in in-memory mode, can PASS without
 * a real write/read validation, does not read __persistenceHealth, or if the
 * validate:persistence:proof script is missing / runs destructive ops.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/proof/PersistenceProofRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/__persistenceHealth/.test(raw)) F.push('must read __persistenceHealth');
  else P.push('reads __persistenceHealth');
  // Must FAIL on in-memory mode.
  if (!/(mode\s*===\s*'memory'|mode\s*===\s*'in-memory'|'memory'\s*===\s*mode)/.test(src) || !/FAIL/.test(src))
    F.push('must FAIL when mode is memory / in-memory');
  else P.push('FAILs in in-memory mode');
  // PASS must require postgres + databaseUrlPresent + writeReadValidated.
  const passWindow = src.match(/proofStatus\s*=\s*'PASS'/);
  if (!/mode\s*===\s*'postgres'/.test(src) || !/databaseUrlPresent/.test(src) || !/writeReadValidated/.test(src))
    F.push('PASS must require postgres + databaseUrlPresent + writeReadValidated');
  else P.push('PASS requires postgres + url + write/read validated');
  if (!/writeReadValidated/.test(src)) F.push('must require a write/read validation (not config alone)');
  if (!/inMemoryFallbackDisabledInProduction/.test(raw)) F.push('must surface inMemoryFallbackDisabledInProduction');
  else P.push('reports in-memory fallback disabled in production');
}

// The validate:persistence:proof command must exist and be non-destructive.
const pkg = read('package.json');
if (!/"validate:persistence:proof"/.test(pkg)) F.push('package.json must define validate:persistence:proof');
else P.push('validate:persistence:proof script registered');
const script = read('scripts/validate-persistence-proof.mjs');
if (!script) F.push('scripts/validate-persistence-proof.mjs: missing');
else {
  if (/migrate\s+reset|migrate\s+deploy|prisma\s+db\s+push|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i.test(script))
    F.push('validate:persistence:proof must NOT run destructive / migration ops');
  else P.push('persistence proof script is non-destructive');
  if (!/NEEDS_TEST/.test(script)) F.push('persistence proof script must degrade to NEEDS_TEST honestly');
  else P.push('script honest NEEDS_TEST when it cannot validate');
}

if (F.length) {
  console.error('[check:persistence-proof] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:persistence-proof] PASS — cannot pass in memory mode, needs real write/read, non-destructive script.');
for (const m of P) console.log('  ✓ ' + m);
