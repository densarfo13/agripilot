#!/usr/bin/env node
/**
 * scripts/check-final-pilot-proof.mjs — the composite proof scorecard.
 *
 * Fails if the composite does not read all 10 proof probes, compute the
 * GO / GO_WITH_LIMITATIONS / BLOCKED verdict honestly (BLOCKED on a core
 * FAIL; GO only when the core proofs PASS), expose the score, or install the
 * __finalPilotProofHealth + __recordProofRun globals. __recordProofRun must
 * REQUIRE a source (no anonymous pass).
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const rel = 'src/runtime/proof/FinalPilotProofRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const PROBES = ['__dailyPlanProofHealth', '__scanToTaskProofHealth', '__postHarvestProofHealth',
    '__outcomeProofHealth', '__dataReadinessHealth', '__translationReviewHealth',
    '__persistenceProofHealth', '__inviteProofHealth', '__offlineSyncProofHealth', '__onboardingProofHealth'];
  const missing = PROBES.filter((p) => !raw.includes(p));
  if (missing.length) F.push(`composite must read all 10 proof probes (missing: ${missing.join(', ')})`);
  else P.push('reads all 10 proof probes');
  for (const v of ['GO', 'GO_WITH_LIMITATIONS', 'BLOCKED']) {
    if (!raw.includes(v)) F.push(`verdict must model ${v}`);
  }
  if (!F.some((m) => m.includes('verdict must model'))) P.push('GO / GO_WITH_LIMITATIONS / BLOCKED modeled');
  // BLOCKED must be driven by a core FAIL (blockers), GO by core PASS.
  if (!/blockers/.test(raw) || !/FAIL/.test(raw)) F.push('BLOCKED must be driven by a core proof FAIL (blockers)');
  else P.push('BLOCKED driven by core FAIL');
  if (!/corePass/.test(raw) && !/=== 'PASS'[\s\S]{0,200}=== 'PASS'/.test(raw))
    F.push('GO must require the core proofs to PASS');
  else P.push('GO requires core proofs PASS');
  if (!/score/.test(raw)) F.push('must expose a score');
  else P.push('score exposed');
  if (!/__finalPilotProofHealth/.test(raw) || !/__recordProofRun/.test(raw))
    F.push('must install __finalPilotProofHealth + __recordProofRun');
  else P.push('installs __finalPilotProofHealth + __recordProofRun');
  // __recordProofRun must require a source (no anonymous fake pass).
  if (!/source\s*\|\|\s*typeof source|!source|source &&/.test(raw))
    F.push('__recordProofRun must REQUIRE a source argument (no anonymous pass)');
  else P.push('recordProofRun requires a source');
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(raw.replace(/\/\*[\s\S]*?\*\//g, ''))) F.push('must not fabricate / call the network');
  else P.push('no fabrication');
}

if (F.length) {
  console.error('[check:final-pilot-proof] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:final-pilot-proof] PASS — reads 10 probes, honest verdict, score, record-with-source.');
for (const m of P) console.log('  ✓ ' + m);
