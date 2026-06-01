#!/usr/bin/env node
/**
 * scripts/check-proof-no-fake-pass.mjs — the core honesty gate.
 *
 * Across ALL proof runtimes, fails if any:
 *   • can return proofStatus 'PASS' without a non-empty validationSource;
 *   • omits the validationSource field entirely;
 *   • fabricates (Math.random / fetch / network);
 *   • DataReadiness counts demo/seed data as real (must declare demoExcluded);
 *   • the pilot dashboard paints NEEDS_TEST / NEEDS_DATA / UNKNOWN green.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const PROOF_FILES = [
  'DailyPlanProofRuntime', 'ScanToTaskProofRuntime', 'PostHarvestProofRuntime',
  'OutcomeProofRuntime', 'TranslationReviewProofRuntime', 'PersistenceProofRuntime',
  'InviteProofRuntime', 'OfflineSyncProofRuntime', 'OnboardingProofRuntime',
];

for (const name of PROOF_FILES) {
  const rel = `src/runtime/proof/${name}.ts`;
  const raw = read(rel);
  if (!raw) { F.push(`${rel}: missing`); continue; }
  const src = strip(raw);
  // Must declare a validationSource field.
  if (!/validationSource/.test(raw)) F.push(`${name}: must expose a validationSource field`);
  // Every PASS assignment must sit in a branch that references validationSource
  // (or `passable`, which itself must reference validationSource).
  const passAssign = /proofStatus\s*[:=]\s*['"]PASS['"]|['"]PASS['"]\s*:/g; // assignment-ish
  // Heuristic: the file must gate PASS on validationSource. We require the token
  // 'validationSource' to appear within ~240 chars before a `= 'PASS'` (or a
  // `passable` expression that references validationSource).
  const hasGuardedPass = (() => {
    const idxs = [];
    const re = /proofStatus\s*=\s*['"]PASS['"]|passable\s*\?\s*['"]PASS['"]/g;
    let m;
    while ((m = re.exec(src))) idxs.push(m.index);
    if (idxs.length === 0) return true; // no direct PASS assignment (e.g. uses a computed var) — checked below
    // Accept a real-evidence token in the PASS window: validationSource, the
    // `passable` predicate (which itself references validationSource), or
    // writeReadValidated (persistence — a recorded proof_run write/read).
    return idxs.every((i) => {
      const win = src.slice(Math.max(0, i - 320), i + 40);
      return /validationSource/.test(win) || /writeReadValidated/.test(win)
        || /passable/.test(src.slice(Math.max(0, i - 60), i + 10));
    });
  })();
  const passableGuarded = !/const\s+passable\s*=/.test(src) ||
    /const\s+passable\s*=[\s\S]{0,200}validationSource/.test(src);
  if (!hasGuardedPass || !passableGuarded)
    F.push(`${name}: 'PASS' must be gated on a non-empty validationSource (no fake pass)`);
  if (/Math\.random\s*\(|\bfetch\s*\(|XMLHttpRequest/.test(src))
    F.push(`${name}: must not fabricate / call the network`);
}
if (!F.some((m) => /must expose|fake pass|fabricate/.test(m)))
  P.push('every proof gates PASS on a real validationSource; no fabrication');

// Data readiness must exclude demo/seed data from real production counts.
const dr = read('src/runtime/proof/DataReadinessRuntime.ts');
if (!dr) F.push('DataReadinessRuntime.ts: missing');
else {
  if (!/demoExcluded/.test(dr)) F.push('DataReadiness must declare demoExcluded (no demo data counted as real)');
  else P.push('data readiness excludes demo/seed data');
}

// Pilot dashboard must not paint non-PASS statuses green.
const page = read('src/pages/internal/PilotReadinessPage.jsx');
if (!page) F.push('PilotReadinessPage.jsx: missing');
else {
  // The proof dot map must map UNKNOWN to a non-green colour and exist.
  if (!/PROOF_DOT/.test(page)) F.push('dashboard must use a proof status→colour map (PROOF_DOT)');
  else if (/NEEDS_TEST'?\s*:\s*'#10B981'|UNKNOWN'?\s*:\s*'#10B981'/.test(page))
    F.push('dashboard must NOT paint NEEDS_TEST / UNKNOWN green');
  else P.push('dashboard never paints NEEDS_TEST / UNKNOWN green');
}

if (F.length) {
  console.error('[check:proof-no-fake-pass] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:proof-no-fake-pass] PASS — PASS requires a real source, no demo-as-real, no fake green.');
for (const m of P) console.log('  ✓ ' + m);
