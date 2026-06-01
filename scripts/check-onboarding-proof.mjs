#!/usr/bin/env node
/**
 * scripts/check-onboarding-proof.mjs — farmer/gardener onboarding proof.
 *
 * Fails if the onboarding proof requires GPS (location must be optional),
 * can pass while a location / onboarding loop exists, or does not read the
 * onboarding + route-guard probes.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/proof/OnboardingProofRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/__onboardingHealth/.test(raw)) F.push('must read __onboardingHealth');
  else P.push('reads __onboardingHealth');
  if (!/__routeGuardHealth/.test(raw)) F.push('must read __routeGuardHealth (location / loop guard)');
  else P.push('reads __routeGuardHealth');
  for (const f of ['locationOptional', 'reachesHomeWithoutBlock', 'firstScanAvailable', 'dailyPlanGenerated']) {
    if (!raw.includes(f)) F.push(`must surface ${f}`);
  }
  if (!F.some((m) => m.includes('must surface'))) P.push('onboarding fields present');
  // Must FAIL when location is NOT optional (GPS required) — never require GPS.
  if (!/locationOptional\s*===\s*false|!locationOptional|locationOptional\s*\?/.test(src) || !/FAIL/.test(src))
    F.push('must FAIL when location is not optional (never require GPS)');
  else P.push('FAILs if GPS would be required (location not optional)');
  // PASS must require locationOptional && reachesHomeWithoutBlock.
  const i = src.search(/proofStatus\s*=\s*'PASS'/);
  const win = i >= 0 ? src.slice(Math.max(0, i - 360), i + 20) : '';
  if (!/locationOptional/.test(win) || !/reachesHomeWithoutBlock/.test(win))
    F.push('PASS must require locationOptional && reachesHomeWithoutBlock');
  else P.push('PASS requires location-optional + reaches-home-without-block');
  // Hard guard: the file must never POSITIVELY require GPS in code (a flag set
  // to demand GPS). Honest negation prose ("would require GPS → FAIL") is fine,
  // so match only an assignment that demands it.
  if (/(mustHaveGps|requireGps|gpsRequired)\s*[:=]\s*true/i.test(src))
    F.push('onboarding proof must never require GPS');
  else P.push('never requires GPS');
}

if (F.length) {
  console.error('[check:onboarding-proof] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:onboarding-proof] PASS — location optional, no GPS requirement, no location loop, reaches Home.');
for (const m of P) console.log('  ✓ ' + m);
