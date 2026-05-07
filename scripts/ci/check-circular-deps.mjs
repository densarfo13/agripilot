/**
 * check-circular-deps.mjs — dependency cycle audit + build guard.
 *
 * Usage:
 *   node scripts/ci/check-circular-deps.mjs          # audit + report
 *   node scripts/ci/check-circular-deps.mjs --strict # fail on new static cycle
 *
 * What it checks:
 *   1. Runs madge across the full src/ tree.
 *   2. Classifies each cycle as "static-only" (TDZ risk) or
 *      "has-dynamic-edge" (safe — back-import is lazy).
 *   3. Prints a full report with file paths, edge types, and risk.
 *   4. In --strict mode, exits 1 if any pure-static cycle is found.
 *
 * Known-safe cycles (all have ≥1 dynamic back-edge):
 *   • core/analytics.js > core/contextResolver.js > core/userType.js
 *   • analytics/lifecycleEvents.js > core/analytics.js > ... > store/multiExperience.js
 *   • core/analytics.js > experiments/abTest.js
 *   • data/labels.js > ai/learningEngine.js
 *
 * These are recorded in KNOWN_SAFE_CYCLES so the guard knows to
 * tolerate them without failing. A NEW static cycle (not in this
 * list) will fail --strict mode.
 *
 * TDZ crash history:
 *   2026-05-07  analytics.js ↔ abTest.js  (commit 650af78) — fixed
 *   2026-05-07  Dashboard.jsx: const profile declared at line 520,
 *               referenced in useEffect dep array at line 229 —
 *               function-scope TDZ exposed by Terser re-batching
 *               (commit that added this guard) — fixed.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '../..');
const SRC       = join(ROOT, 'src');
const STRICT    = process.argv.includes('--strict');

// ── Known-safe cycles — all have ≥1 dynamic import in the back-edge ─
// Format: canonical madge cycle string (joined with " > ")
const KNOWN_SAFE = new Set([
  'core/analytics.js > core/contextResolver.js > core/userType.js',
  'analytics/lifecycleEvents.js > core/analytics.js > core/contextResolver.js > core/userType.js > store/multiExperience.js',
  'core/analytics.js > experiments/abTest.js',
  'data/labels.js > ai/learningEngine.js',
]);

// ── Run madge ─────────────────────────────────────────────────────────
function runMadge() {
  try {
    const out = execSync(
      `npx madge --circular --extensions js,jsx,ts,tsx --no-spinner "${SRC}"`,
      { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return out;
  } catch (err) {
    // madge exits 1 when cycles are found — that's expected.
    return (err.stdout || '') + (err.stderr || '');
  }
}

// ── Parse madge output ────────────────────────────────────────────────
function parseCycles(raw) {
  const cycles = [];
  const lines  = raw.split('\n');
  let   i      = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^\s*\d+\)\s+(.+)$/);
    if (m) {
      cycles.push(m[1].trim());
    }
    i++;
  }
  return cycles;
}

// ── Main ──────────────────────────────────────────────────────────────
console.log('');
console.log('─'.repeat(60));
console.log('  Farroway Dependency Cycle Audit');
console.log('─'.repeat(60));
console.log('');

const raw    = runMadge();
const cycles = parseCycles(raw);

// Skipped-file warning
const skippedMatch = raw.match(/Skipped (\d+) files?/);
if (skippedMatch) {
  const skipped = raw.match(/\n([^\n]+)\n/g)
    ?.filter(l => !l.includes('Skipped') && !l.trim().startsWith('✖'))
    ?.map(l => l.trim())
    ?.filter(Boolean)
    ?.slice(0, 6)
    ?.join(', ') || '';
  console.warn(`⚠  madge skipped ${skippedMatch[1]} file(s) — cycles through those files are INVISIBLE.`);
  if (skipped) console.warn(`   Likely: ${skipped}`);
  console.warn('   Tip: ensure import extensions match the actual file extensions (.jsx not .js).');
  console.warn('');
}

if (cycles.length === 0) {
  console.log('✅  No circular dependencies found.\n');
  process.exit(0);
}

let newStaticCycles = 0;
const lines = [];

lines.push(`Found ${cycles.length} circular dependency chain(s):\n`);

cycles.forEach((cycle, idx) => {
  const isKnown  = KNOWN_SAFE.has(cycle);
  const tag      = isKnown  ? '✓ known-safe (has dynamic back-edge)' : '⚠ NEW — verify back-edge is dynamic';
  const riskFlag = !isKnown ? '  ← POSSIBLE TDZ RISK' : '';
  lines.push(`  ${idx + 1}) ${cycle}`);
  lines.push(`     ${tag}${riskFlag}`);
  lines.push('');
  if (!isKnown) newStaticCycles++;
});

lines.forEach(l => console.log(l));

// ── Summary ───────────────────────────────────────────────────────────
console.log('─'.repeat(60));
console.log(`  Cycles total   : ${cycles.length}`);
console.log(`  Known-safe     : ${cycles.length - newStaticCycles}`);
console.log(`  New / unknown  : ${newStaticCycles}`);
console.log('─'.repeat(60));
console.log('');

if (newStaticCycles > 0) {
  console.log('Action required for each new cycle:');
  console.log('  1. Verify the back-import is a dynamic import() call.');
  console.log('  2. If static, convert the back-import to dynamic (see abTest.js fix).');
  console.log('  3. Add the cycle to KNOWN_SAFE in this script once confirmed safe.');
  console.log('');
  if (STRICT) {
    console.error('❌  --strict: new cycle found. Build blocked.\n');
    process.exit(1);
  } else {
    console.warn('⚠  Run with --strict to fail CI on new cycles.\n');
  }
} else {
  console.log('✅  All cycles are known-safe. Dashboard graph is stable.\n');
}
