#!/usr/bin/env node
/**
 * scripts/check-mobile-safe-area.mjs — §8 mobile safe-area cleanup.
 *
 * Fails if the safe-area runtime is missing the literal-true §8 flags or
 * the header probe contract it composes over isn't intact.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const probes = read('src/runtime/dailyAssistant/DailyAssistantProbes.ts');
if (!probes) F.push('DailyAssistantProbes.ts: missing');
else {
  for (const fl of ['noDetachedTopStrip: true', 'safeAreaOnly: true',
    'pageActionsIntegrated: true', 'noReservedEmptyHeader: true']) {
    if (!probes.includes(fl)) F.push(`mobileSafeAreaHealth envelope must declare ${fl}`);
  }
  if (!F.some((m) => /mobileSafeAreaHealth envelope/.test(m))) P.push('all 4 §8 flags literal-true');
  if (!/__headerHealth/.test(probes))
    F.push('safe-area runtime must compose __headerHealth by name');
  else P.push('composes __headerHealth by name');
  if (!/__mobileSafeAreaHealth/.test(probes))
    F.push('must pin window.__mobileSafeAreaHealth');
  else P.push('__mobileSafeAreaHealth pinned');
}

// Underlying header contract — these flags must remain literal-true.
const hdr = read('src/runtime/header/HeaderHealthRuntime.ts');
if (hdr) {
  for (const fl of ['emptyTopSpaceRemoved: true', 'globalMobileHeaderCollapsed: true',
    'pageActionsInPageHeader: true']) {
    if (!hdr.includes(fl)) F.push(`HeaderHealth envelope must declare ${fl}`);
  }
  if (!F.some((m) => /HeaderHealth envelope/.test(m))) P.push('underlying HeaderHealth flags intact');
}

if (F.length) {
  console.error('[check:mobile-safe-area] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:mobile-safe-area] PASS — safe-area-only top spacing; no detached strip; PageActions integrated.');
for (const m of P) console.log('  ✓ ' + m);
