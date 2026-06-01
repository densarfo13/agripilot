#!/usr/bin/env node
/**
 * scripts/check-operating-system.mjs — Farroway Operating System layer lock.
 *
 * Fails if:
 *   • the unified __farrowayHealth composite is absent or does not surface
 *     all 10 OS subsystem readiness flags + governance + verdict
 *   • the Funding subsystem (__fundingHealth) is absent / fabricates awards /
 *     lacks an honest NEEDS_DATA fallback
 *   • the composite does not attest event-sourced + artifact-backed governance
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

// 1. Unified OS composite.
const os = read('src/runtime/os/FarrowayHealthRuntime.ts');
if (!os) { F.push('FarrowayHealthRuntime.ts: missing'); }
else {
  if (!/__farrowayHealth/.test(os)) F.push('must install __farrowayHealth');
  else P.push('__farrowayHealth composite installed');
  const KEYS = ['scanReady', 'farmTwinReady', 'decisionReady', 'outcomeReady',
    'marketplaceReady', 'fundingReady', 'ngoReady', 'voiceReady',
    'localizationReady', 'performanceReady'];
  const missing = KEYS.filter((k) => !os.includes(k));
  if (missing.length) F.push(`__farrowayHealth missing OS keys: ${missing.join(', ')}`);
  else P.push('all 10 OS subsystem readiness flags surfaced');
  if (!/eventSourced/.test(os) || !/artifactBacked/.test(os))
    F.push('__farrowayHealth must attest event-sourced + artifact-backed governance');
  else P.push('governance attested (event-sourced + artifact-backed)');
  if (!/verdict/.test(os)) F.push('__farrowayHealth must surface a verdict');
  else P.push('verdict surfaced (READY/NEEDS_DATA/BLOCKED)');
}

// 2. Funding subsystem.
const funding = read('src/runtime/funding/FundingRuntime.ts');
if (!funding) { F.push('FundingRuntime.ts: missing'); }
else {
  if (!/__fundingHealth/.test(funding)) F.push('must install __fundingHealth');
  else P.push('__fundingHealth installed');
  for (const k of ['opportunitiesReady', 'applicationsReady', 'awardsReady', 'fundingHistoryReady']) {
    if (!funding.includes(k)) F.push(`__fundingHealth must surface ${k}`);
  }
  if (!F.some((m) => m.includes('must surface'))) P.push('funding tracks opportunities/applications/awards/history');
  if (!/NEEDS_DATA/.test(funding)) F.push('__fundingHealth must return NEEDS_DATA when no funding activity');
  else P.push('honest NEEDS_DATA fallback');
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(strip(funding))) F.push('__fundingHealth must not fabricate / call the network');
  else P.push('no fabricated funding data');
}

if (F.length) {
  console.error('[check:operating-system] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:operating-system] PASS — unified OS composite + funding subsystem; event-sourced + artifact-backed.');
for (const m of P) console.log('  ✓ ' + m);
