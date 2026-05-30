#!/usr/bin/env node
/**
 * scripts/check-no-legacy-dashboard.mjs — Wave-23.
 *
 * Fails if grower-facing fallback / recovery files contain
 * the legacy "Dashboard" / "Analytics" / "Reports" / "Metrics"
 * tokens. These belong only in internal / enterprise / admin
 * surfaces — never the consumer recovery UI.
 *
 * Scope
 * ─────
 *   • SCANNED:   src/pages/SafeHomeRecovery.jsx (and any other
 *                grower-facing fallback file matched by the
 *                GROWER_FACING_FILES glob below).
 *   • SCANNED:   src/components/system/HomeErrorBoundary.jsx
 *   • ALLOWED:   src/pages/internal, src/pages/admin,
 *                src/pages/enterprise, scripts,
 *                src/runtime, docs, __tests__ trees.
 *
 * Forbidden tokens (case-sensitive, whole-word, anywhere in
 * the file's JSX text, attribute strings, or to= URL):
 *   Dashboard / Analytics / Reports / Metrics
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// Files in scope. New grower-facing fallback / recovery components
// added in future waves should be added here.
const GROWER_FACING_FILES = [
  'src/pages/SafeHomeRecovery.jsx',
  'src/components/system/HomeErrorBoundary.jsx',
];

const FORBIDDEN = ['Dashboard', 'Analytics', 'Reports', 'Metrics'];

const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return null; }
}

// Some legacy SafeHomeFallback.jsx might still be present as a
// dangling file; flag that too.
const LEGACY_FILE = path.join(ROOT, 'src/pages/SafeHomeFallback.jsx');
if (fs.existsSync(LEGACY_FILE)) {
  fail('legacy: src/pages/SafeHomeFallback.jsx must be removed (renamed to SafeHomeRecovery.jsx in wave-23)');
} else {
  pass('legacy: SafeHomeFallback.jsx removed');
}

for (const rel of GROWER_FACING_FILES) {
  const full = path.join(ROOT, rel);
  const src = read(full);
  if (src == null) {
    fail(`scope: ${rel} not present`);
    continue;
  }
  // Strip comments before scanning — comments may legitimately
  // explain the wave-23 contract by NAMING the forbidden tokens.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/(^|\s)\/\/.*$/gm, '');    // line comments

  const hits = [];
  for (const token of FORBIDDEN) {
    const re = new RegExp(`\\b${token}\\b`);
    if (re.test(stripped)) hits.push(token);
  }
  if (hits.length > 0) {
    fail(`forbidden: ${rel} contains [${hits.join(', ')}] — grower-facing fallback must not use these terms`);
  } else {
    pass(`clean: ${rel}`);
  }
}

if (FAILED.length > 0) {
  console.error('[check:no-legacy-dashboard] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:no-legacy-dashboard] PASS — grower-facing fallback free of legacy dashboard wording.');
for (const p of PASSED) console.log('  ✓ ' + p);
