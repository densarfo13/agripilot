/**
 * check-no-undef-render.mjs — permanent guard against undefined-identifier
 * ReferenceErrors reaching production.
 *
 * PRODUCTION ROOT CAUSE (2026-07-04, the REAL one): AddPlantConfirmationCard's
 * low-confidence branch referenced `STYLES` (never declared — the real const is
 * `S`). A minifier cannot rename a free variable, so `STYLES.card` shipped verbatim
 * in ScanPage-*.js. Every low-confidence scan → `isUnconfirmedScan` true → that
 * branch renders → `ReferenceError: STYLES is not defined` → thrown during render →
 * bubbles past the sibling result boundary to the page-level ScanErrorBoundary →
 * "Scan temporarily unavailable". The 410-gate build:safe + the rules-of-hooks guard
 * ALL passed because eslint `no-undef` was disabled. This gate closes that gap.
 *
 * eslint `no-undef` is not globally enabled yet (legacy surface), so this runs it as
 * an override and RATCHETS: the count may only fall. `--update` re-snapshots after a
 * burn-down. Any NEW undefined identifier fails the build.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const BASELINE_FILE = 'scripts/no-undef-baseline.json';
let out = '';
try {
  out = execSync('npx eslint src --rule "{\\"no-undef\\":\\"error\\"}" --format json',
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) { out = err.stdout || ''; }

const hits = [];
try {
  for (const f of JSON.parse(out)) for (const m of f.messages || [])
    if (m.ruleId === 'no-undef') hits.push('src' + String(f.filePath).split('src').pop() + ':' + m.line + ' ' + m.message);
} catch { console.error('[check:no-undef-render] FAIL — could not parse eslint output'); process.exit(1); }

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ noUndef: hits.length }) + '\n');
  console.log('[check:no-undef-render] baseline updated: no-undef=' + hits.length);
  process.exit(0);
}

let baseline = null;
try { baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).noUndef; } catch { baseline = null; }
if (baseline == null) { console.error('[check:no-undef-render] FAIL — missing ' + BASELINE_FILE + ' (run --update)'); process.exit(1); }

if (hits.length > baseline) {
  console.error('[check:no-undef-render] FAIL — undefined identifiers rose ' + baseline + ' → ' + hits.length + ' (ratchet: can only fall). New/all offenders:');
  hits.slice(0, 30).forEach((h) => console.error('  - ' + h));
  console.error('  A free variable throws ReferenceError at render — see AddPlantConfirmationCard/STYLES (the 2026-07-04 scan crash).');
  process.exit(1);
}

console.log('[check:no-undef-render] PASS — no-undef ' + hits.length + '/' + baseline + ' (ratchet); no NEW undefined-identifier ReferenceErrors.');
