#!/usr/bin/env node
/**
 * scripts/check-premium-mobile-ui.mjs — premium mobile UI architecture gate.
 *
 * Fails if:
 *   - the MobileShellHealth runtime / global is missing
 *   - any of the 6 reusable visual components is missing
 *   - the §1 acceptance flags aren't surfaced on the envelope
 *   - the runtime doesn't compose __headerHealth + __voiceFloatingButtonHealth
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const exists = (f) => { try { return fs.statSync(path.join(ROOT, f)).isFile(); } catch { return false; } };

const rt = read('src/runtime/mobileShell/MobileShellHealthRuntime.ts');
if (!rt) F.push('MobileShellHealthRuntime.ts: missing');
else {
  if (!/installMobileShellHealthGlobal/.test(rt))
    F.push('runtime must export installMobileShellHealthGlobal');
  else P.push('install fn exported');
  if (!/__mobileShellHealth/.test(rt))
    F.push('runtime must pin window.__mobileShellHealth');
  else P.push('__mobileShellHealth global pinned');
  for (const flag of ['noEmptyTopStrip', 'pageActionsInHeader',
    'oneBellPerPage', 'oneMenuPerPage', 'onlineLiveRemoved', 'bottomNavStable']) {
    if (!new RegExp('\\b' + flag + '\\b').test(rt))
      F.push(`envelope must declare ${flag}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m)))
    P.push('all 6 §1 envelope flags present');
  // Composition: must read __headerHealth + __voiceFloatingButtonHealth by name.
  if (!/__headerHealth/.test(rt) || !/__voiceFloatingButtonHealth/.test(rt))
    F.push('runtime must compose __headerHealth + __voiceFloatingButtonHealth by name');
  else P.push('composes header + voice-FAB probes by name');
}

// 6 reusable visual components — all must exist on disk.
const COMPONENTS = [
  'src/components/ui/PremiumHeroCard.jsx',
  'src/components/ui/PremiumActionCard.jsx',
  'src/components/ui/MetricMiniCard.jsx',
  'src/components/ui/TimelineItem.jsx',
  'src/components/ui/StageProgress.jsx',
  'src/components/ui/RecommendationCard.jsx',
];
const missing = COMPONENTS.filter((c) => !exists(c));
if (missing.length) F.push('visual components missing: ' + missing.join(', '));
else P.push('all 6 premium visual components present');

// Boot install wired in App.jsx.
const app = read('src/App.jsx');
if (!app) F.push('src/App.jsx: missing');
else if (!/installMobileShellHealthGlobal/.test(app))
  F.push('App.jsx must wire installMobileShellHealthGlobal in boot');
else P.push('App.jsx wires installMobileShellHealthGlobal');

if (F.length) {
  console.error('[check:premium-mobile-ui] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:premium-mobile-ui] PASS — mobile shell composite + 6 visual components + boot install.');
for (const m of P) console.log('  ✓ ' + m);
