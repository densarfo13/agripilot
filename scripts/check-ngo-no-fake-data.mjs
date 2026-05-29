#!/usr/bin/env node
/**
 * scripts/check-ngo-no-fake-data.mjs — Lock NGO surfaces to
 * real aggregates only. Reports must surface "Not enough data
 * yet" when samples are absent; never fabricated counts.
 *
 * Hard blockers in src/pages/organization/* + src/pages/enterprise/*
 * + any src/components/ngo/* surfaces (comment-stripped):
 *
 *   A. fake/mock/hardcoded NGO traction counts
 *   B. literal "X farmers reached" with hardcoded integer
 *   C. carbon-credit / carbon-offset routes or imports
 *   D. investor-dashboard route or component imports
 *
 * Strict-rule audit
 *   • Read-only. Never mutates.
 *   • Strips comments before pattern-matching.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function readOrEmpty(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const NGO_DIRS = [
  path.join(ROOT, 'src/pages/organization'),
  path.join(ROOT, 'src/pages/enterprise'),
  path.join(ROOT, 'src/components/ngo'),
  path.join(ROOT, 'src/components/organization'),
];

const FORBIDDEN_NGO = [
  { name: 'fakeFarmersReached',  re: /["'](?:[0-9]{3,})\s*farmers?\s*(?:reached|enrolled)["']/i },
  { name: 'fakeInterventions',   re: /\bfake[\s_-]?interventions?\b/i },
  { name: 'mockNgoMetrics',      re: /\bmock[\s_-]?ngo[\s_-]?metrics?\b/i },
  { name: 'placeholderTraction', re: /placeholder[\s_-]?traction/i },
  { name: 'carbonCredit',        re: /\bcarbon[\s_-]?credit/i },
  { name: 'carbonOffset',        re: /\bcarbon[\s_-]?offset/i },
  { name: 'investorDashboard',   re: /\binvestor[\s_-]?dashboard\b/i },
  { name: 'satelliteDashboard',  re: /\bsatellite[\s_-]?dashboard\b/i },
];

const violators = [];
let scanned = 0;
for (const dir of NGO_DIRS) {
  for (const f of walk(dir)) {
    scanned++;
    const rawSrc = readOrEmpty(f);
    const src = stripComments(rawSrc);
    for (const { name, re } of FORBIDDEN_NGO) {
      if (re.test(src)) {
        violators.push({ rel: path.relative(ROOT, f), name, re: re.toString() });
      }
    }
  }
}

if (violators.length > 0) {
  for (const v of violators) {
    fail(`ngo-no-fake-data: ${v.rel} contains forbidden ${v.name} ${v.re}`);
  }
} else {
  pass(`ngo-no-fake-data: ${scanned} NGO/enterprise file(s) scanned, no fake data tokens`);
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:ngo-no-fake-data] FAIL — fake NGO data detected.');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:ngo-no-fake-data] PASS — NGO + enterprise surfaces use real aggregates only.');
