/**
 * check-no-scan-unclear.mjs — Phase 12: a no-result scan must NEVER collapse into a
 * generic "Scan unclear". Bans the hardcoded phrase from farmer-facing scan UI (after
 * stripping comments), verifies the honest reason engine is wired, and runs its test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const has = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ENG = 'src/runtime/scan/failure/scanUnclearReason.ts';
const TEST = 'src/runtime/scan/failure/__tests__/scanUnclearReason.test.ts';
for (const f of [ENG, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);
const eng = rd(ENG);

has(eng, 'export function scanUnclearReason', 'must export scanUnclearReason');
has(eng, 'headlineKey', 'reason must carry translation keys (language-neutral)');
has(eng, 'nextAction', 'reason must carry a next action');

// Ban the RENDERED, Title-cased phrase "Scan unclear" in farmer-facing strings —
// NOT the lowercase 'scan unclear' that detection sets use to RECOGNISE an unknown
// plant name (a legitimate normalized comparison, never shown to a farmer).
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const RENDERED_BAN = /['"`][^'"`]*Scan unclear[^'"`]*['"`]/; // case-sensitive: UI text is Title-cased
if (RENDERED_BAN.test(stripComments(eng))) E.push('engine must not emit the phrase "Scan unclear"');

// Wired into the command card.
const card = rd('src/components/scan/ScanCommandCard.jsx');
has(card, 'scanUnclearReason', 'ScanCommandCard must consume scanUnclearReason');
has(card, 'scan-command-next-action', 'ScanCommandCard must render the next action when no plant is identified');

// BAN the rendered phrase from farmer-facing scan UI (comments stripped).
function scanDir(rel) {
  const dir = path.join(R, rel);
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /\.(jsx?|tsx?)$/.test(f) && !/\.test\./.test(f)); } catch { return; }
  for (const f of files) {
    const full = rel + '/' + f;
    if (RENDERED_BAN.test(stripComments(rd(full)))) {
      E.push(`generic "Scan unclear" rendered in ${full} — use scanUnclearReason() for a specific honest reason`);
    }
  }
}
scanDir('src/components/scan');
// ScanPage is the other farmer-facing scan surface.
if (RENDERED_BAN.test(stripComments(rd('src/pages/ScanPage.jsx'))))
  E.push('generic "Scan unclear" rendered in src/pages/ScanPage.jsx');

// Run the engine test.
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('scan-unclear-reason test did not PASS: ' + out.trim());
  } catch (err) { E.push('scan-unclear-reason test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:no-scan-unclear] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:no-scan-unclear] PASS — no generic "Scan unclear" in farmer-facing scan UI; '
  + 'a no-result scan gets a specific honest reason + next action (composed from real signals); test green.');
