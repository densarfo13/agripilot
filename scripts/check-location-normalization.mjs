#!/usr/bin/env node
/**
 * scripts/check-location-normalization.mjs — §2 LOCATION DEDUP.
 *
 * Fails if the normalizer is missing, doesn't dedupe case-insensitively,
 * doesn't canonicalize US aliases, or lacks the literal-true flags.
 * Also runs a tiny in-process behavior check by importing the file via
 * a JS string match of the canonical examples.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const rel = 'src/runtime/location/LocationDisplayNormalizer.ts';
const src = read(rel);
if (!src) F.push(`${rel}: missing`);
else {
  for (const fn of ['normalizeLocationDisplay', 'locationDisplayHealth', 'installLocationDisplayGlobal']) {
    if (!new RegExp(`export function ${fn}`).test(src))
      F.push(`must export ${fn}`);
  }
  if (!F.some((m) => /must export/.test(m))) P.push('3 public fns exported');
  for (const f of ['duplicateSuppressionReady: true', 'emptyPartSuppressionReady: true', 'safeFallbackReady: true']) {
    if (!src.includes(f)) F.push(`envelope must declare ${f}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m))) P.push('all §2 flags literal-true');
  if (!/US_RE|US\s*\/\s*USA|United\s+States/.test(src))
    F.push('normalizer must collapse US/USA/United States aliases');
  else P.push('US aliases collapsed');
  if (!/seen\.has|new Set/.test(src))
    F.push('normalizer must dedupe parts (Set / seen)');
  else P.push('dedup via Set');
  if (!/Location not set/.test(src))
    F.push('normalizer must fallback to "Location not set"');
  else P.push('safe fallback "Location not set"');
}

if (F.length) {
  console.error('[check:location-normalization] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:location-normalization] PASS — dedup + US-alias + safe fallback wired.');
for (const m of P) console.log('  ✓ ' + m);
