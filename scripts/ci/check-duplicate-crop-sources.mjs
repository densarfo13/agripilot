#!/usr/bin/env node
/**
 * check-duplicate-crop-sources.mjs
 *
 * CI guard — warns (non-failing) when legacy crop lists grow instead
 * of shrinking, signalling that the migration to cropRegistry is
 * regressing. Three historical crop tables coexist:
 *
 *   src/utils/crops.js                  — legacy CROPS array
 *   src/config/crops.js                 — legacy COMMON_CROPS / labels
 *   src/config/crops/cropRegistry.js    — canonical (target source of truth)
 *
 * Target state: only the canonical registry carries crop entries;
 * the legacy files are either deleted or marked deprecated. Until
 * then we track entry counts so we notice if someone adds a new row
 * to the wrong file.
 *
 *   node scripts/ci/check-duplicate-crop-sources.mjs
 *     → 0 always in warn-mode; 1 when BASELINE counts grow.
 *     → Pass --strict to fail when legacy files still exist at all.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const STRICT = process.argv.includes('--strict');

// Baseline entry counts captured at audit time (2026-04-22).
// Numbers are measured by matching the entry-delimiting regex below.
// If a count EXCEEDS the baseline, the guard fails — someone grew a
// legacy list instead of migrating. Counts may DROP (migration); we
// update the baseline here when they do.
const BASELINE = {
  'src/utils/crops.js':        { pattern: /^\s*\{\s*code:\s*'[A-Z_]+',/m, max: 98,
                                   target: 'deprecate' },
  'src/config/crops.js':       { pattern: /^\s*['"][a-z_-]+['"]\s*:\s*\{/m, max: 60,
                                   target: 'deprecate' },
  'src/config/crops/cropRegistry.js': { pattern: /^/, max: Infinity,
                                          target: 'canonical' },
};

function countMatches(text, pattern) {
  if (!pattern || pattern.source === '^') return null;
  let n = 0;
  const re = new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g');
  while (re.exec(text)) n += 1;
  return n;
}

const results = [];
let fail = false;

for (const [rel, cfg] of Object.entries(BASELINE)) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    results.push({ file: rel, status: 'gone', target: cfg.target, count: 0 });
    continue;
  }
  if (cfg.target === 'deprecate' && STRICT) {
    results.push({ file: rel, status: 'deprecated_still_present',
                    target: cfg.target, count: 0 });
    fail = true;
    continue;
  }
  const text = fs.readFileSync(abs, 'utf8');
  const count = countMatches(text, cfg.pattern);
  const over = count != null && count > cfg.max;
  results.push({ file: rel, status: over ? 'grew' : 'ok',
                  target: cfg.target, count, max: cfg.max });
  if (over) fail = true;
}

for (const r of results) {
  const icon = r.status === 'ok' ? '\u2713'
             : r.status === 'gone' ? '\u2713'
             : '\u2717';
  const countStr = r.count != null ? ` (${r.count} entries, baseline ${r.max})` : '';
  console.log(`${icon} ${r.file.padEnd(42)} [${r.target}] ${r.status}${countStr}`);
}

if (fail) {
  console.error('');
  console.error('duplicate-crop-sources: legacy crop table grew instead of shrinking.');
  console.error('Fix: add new crop rows to src/config/crops/cropRegistry.js (canonical).');
  process.exit(1);
}

console.log('\u2713 duplicate-crop-sources: baseline respected');
