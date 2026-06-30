/**
 * check-design-system-v1.mjs — locks the Farroway Design System v1 foundation.
 *
 * Scope (ratchet): this gate guards the design-system SOURCE OF TRUTH — the token
 * index + the canonical component barrel + the new primitives. It deliberately does
 * NOT retroactively fail the 24 legacy screens (those migrate screen-by-screen);
 * the per-screen migration tightens coverage as each screen adopts the system.
 *
 * Asserts: all canonical token categories are exported from one index; the new
 * token files exist; the component barrel exposes the canonical names; the new
 * primitives READ from tokens (not hand-rolled constants); and the token test passes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const exists = (r) => fs.existsSync(path.join(R, r));

// 1. Token index exports every canonical category from ONE place.
const idx = rd('src/design/tokens/index.js');
for (const cat of ['COLORS', 'SPACING', 'TYPE', 'SHADOWS', 'RADIUS', 'MOTION', 'BREAKPOINTS', 'ELEVATION', 'GRID'])
  if (!new RegExp('\\b' + cat + '\\b').test(idx)) E.push('token index must export ' + cat);

// 2. New token files exist.
for (const f of ['src/design/tokens/breakpoints.js', 'src/design/tokens/elevation.js'])
  if (!exists(f)) E.push('missing token file: ' + f);

// 3. Canonical component barrel exposes the canonical names.
const bar = rd('src/design/components/index.js');
if (!bar) E.push('missing src/design/components/index.js barrel');
for (const c of ['CTAButton', 'ProgressRing', 'Badge', 'HeroCard', 'SectionCard', 'EmptyState', 'KPIChip', 'SkeletonLoader'])
  if (!new RegExp('\\b' + c + '\\b').test(bar)) E.push('component barrel must export ' + c);

// 4. New primitives READ from tokens (single source of truth — not hand-rolled scales).
for (const f of ['src/design/components/CTAButton.jsx', 'src/design/components/ProgressRing.jsx', 'src/design/components/Badge.jsx']) {
  const src = rd(f);
  if (!src) { E.push('missing primitive: ' + f); continue; }
  if (!/from '\.\.\/tokens\//.test(src)) E.push(f + ' must import from ../tokens (token-driven, not hardcoded)');
}

// 5. CTAButton enforces the accessibility floor (48px target).
if (!/48/.test(rd('src/design/components/CTAButton.jsx'))) E.push('CTAButton must enforce a 48px min touch target');

// 6. Doc present.
if (!exists('DESIGN_SYSTEM_V1.md')) E.push('DESIGN_SYSTEM_V1.md missing');

// 7. Token contract test passes.
if (E.length === 0) {
  try {
    const out = execSync('npx tsx src/design/__tests__/designTokens.test.ts', { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('design-token test did not PASS: ' + out.trim());
  } catch (err) { E.push('design-token test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}

if (E.length) { console.error('[check:design-system-v1] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:design-system-v1] PASS — one token index (9 categories, frozen), canonical component barrel '
  + '(CTAButton/ProgressRing/Badge + premium aliases), primitives token-driven + 48px-accessible, token test green.');
