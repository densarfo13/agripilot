#!/usr/bin/env node
/**
 * check-i18n-coverage.mjs
 *
 * CI guard — verifies that high-risk translation domains reach a
 * minimum coverage ratio in the Hindi pack (src/i18n/hi.js). Every
 * other language is carried inside translations.js itself, so the
 * only language that can silently fall through to English is Hindi.
 *
 *   node scripts/ci/check-i18n-coverage.mjs
 *     → 0 when every required domain passes the threshold; 1 otherwise.
 *
 * Thresholds (kept intentionally generous during rollout):
 *   insight.*   ≥ 50%
 *   econ.*      ≥ 50%
 *   rainfall.*  ≥ 50%
 *   seasonal.*  ≥ 50%
 *   topCrops.*  ≥ 50%
 *
 * Bump each threshold as translations land. The goal is "loud when a
 * domain is shipped with zero translation," not "flawless coverage."
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const EN_FILE = path.join(ROOT, 'src/i18n/translations.js');
const HI_FILE = path.join(ROOT, 'src/i18n/hi.js');

// Thresholds are ratcheted up as translations land. Current numbers
// reflect the 2026-04 audit baseline; raise these when you add keys
// to hi.js so the guard enforces the new floor.
const DOMAINS = [
  { name: 'insight.',   threshold: 0.95 },   // fully translated
  { name: 'econ.',      threshold: 0.95 },   // fully translated
  { name: 'rainfall.',  threshold: 0.40 },   // ratchet up as Hindi lands
  { name: 'seasonal.',  threshold: 0.45 },   // ratchet up as Hindi lands
  { name: 'topCrops.',  threshold: 0.95 },   // fully translated
];

function extractKeys(text) {
  // Matches lines like:   'foo.bar.baz': { ... }
  //                or:    'foo.bar.baz': '...'
  const keys = new Set();
  const re = /^\s*'([a-zA-Z][\w.]+)'\s*:/gm;
  let m;
  while ((m = re.exec(text))) keys.add(m[1]);
  return keys;
}

function main() {
  if (!fs.existsSync(EN_FILE) || !fs.existsSync(HI_FILE)) {
    console.error('\u2717 i18n-coverage: could not locate translation files');
    process.exit(1);
  }
  const en = extractKeys(fs.readFileSync(EN_FILE, 'utf8'));
  const hi = extractKeys(fs.readFileSync(HI_FILE, 'utf8'));

  let failed = false;
  for (const d of DOMAINS) {
    let enCount = 0, hiCount = 0;
    for (const k of en) if (k.startsWith(d.name)) enCount += 1;
    for (const k of hi) if (k.startsWith(d.name)) hiCount += 1;
    const ratio = enCount > 0 ? hiCount / enCount : 1;
    const ok = enCount === 0 || ratio >= d.threshold;
    const mark = ok ? '\u2713' : '\u2717';
    const pct = (ratio * 100).toFixed(0);
    console.log(`${mark} ${d.name}*  hi/en = ${hiCount}/${enCount}  (${pct}%, required ${(d.threshold * 100).toFixed(0)}%)`);
    if (!ok) failed = true;
  }
  if (failed) {
    console.error('');
    console.error('Fix: add the missing keys to src/i18n/hi.js for the failing domain(s).');
    console.error('Hindi-speaking farmers currently see English for these screens.');
    process.exit(1);
  }
  console.log('\u2713 i18n-coverage: all target domains pass');
}
main();
