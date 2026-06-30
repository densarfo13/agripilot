/**
 * designTokens.test.ts — locks the Farroway Design System token contract.
 * Self-running: `tsx designTokens.test.ts`. Pure (tokens only; no React).
 */
import { COLORS, SPACING, TYPE, SHADOWS, RADIUS, MOTION, BREAKPOINTS, ELEVATION, GRID }
  from '../tokens/index.js';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }
const isObj = (v: any) => v != null && typeof v === 'object';

// ── All canonical categories present ─────────────────────────────
ok(isObj(COLORS), 'COLORS present');
ok(isObj(SPACING), 'SPACING present');
ok(isObj(TYPE), 'TYPE present');
ok(isObj(SHADOWS), 'SHADOWS present');
ok(isObj(RADIUS), 'RADIUS present');
ok(isObj(MOTION), 'MOTION present');
ok(isObj(BREAKPOINTS), 'BREAKPOINTS present');
ok(isObj(ELEVATION), 'ELEVATION present');
ok(isObj(GRID), 'GRID present');

// ── Tokens are frozen (shared shape can't be mutated) ────────────
ok(Object.isFrozen(SPACING), 'SPACING frozen');
ok(Object.isFrozen(BREAKPOINTS), 'BREAKPOINTS frozen');
ok(Object.isFrozen(ELEVATION), 'ELEVATION frozen');

// ── Breakpoints are mobile-first + strictly ascending ────────────
ok(BREAKPOINTS.phone === 0, 'breakpoints start mobile-first at 0');
ok(BREAKPOINTS.phoneLg < BREAKPOINTS.tablet && BREAKPOINTS.tablet < BREAKPOINTS.desktop,
  'breakpoints strictly ascending (phoneLg < tablet < desktop)');

// ── Elevation is a strictly ordered ladder ───────────────────────
const ladder = [ELEVATION.base, ELEVATION.raised, ELEVATION.sticky, ELEVATION.bottomNav,
  ELEVATION.header, ELEVATION.overlay, ELEVATION.sheet, ELEVATION.modal, ELEVATION.toast];
for (let i = 1; i < ladder.length; i++) ok(ladder[i] > ladder[i - 1], `elevation rung ${i} above previous`);
ok(ELEVATION.toast === Math.max(...ladder), 'toast is the top of the stacking ladder');

// ── Grid is the phone-first content column ───────────────────────
ok(typeof GRID.maxWidth === 'string' && GRID.gutter > 0 && GRID.columnGap > 0, 'GRID well-formed');

console.log('[designTokens] PASS — ' + passed + ' assertions. Canonical token system complete '
  + '(colors/spacing/type/shadows/radius/motion/breakpoints/elevation/grid); frozen; mobile-first ascending.');
