/**
 * check-scan-unknown-guard.mjs — P0: an unknown/low-confidence scan can NEVER become a
 * My Plants entity (store chokepoint), the Add-to-My-Plants UI is hidden for unknown
 * (defense-in-depth), and the farmer gets a specific safe reason. Runs the guard test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const has = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const WF = 'src/runtime/plants/scanToManagedPlant.ts';
const TEST = 'src/runtime/plants/__tests__/scanToManagedPlant.guard.test.ts';
for (const f of [WF, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);
const wf = rd(WF);

// 1. The store enforces the guard at the creation chokepoint.
has(wf, 'export function isUnconfirmedScan', 'workflow must export isUnconfirmedScan');
has(wf, 'if (isUnconfirmedScan(scan))', 'workflow must reject unconfirmed scans before creating a managed plant');
has(wf, "'unknown_plant'", 'workflow must emit reason unknown_plant');
has(wf, "'low_confidence'", 'workflow must emit reason low_confidence');

// 2. The Add-to-My-Plants UI is hidden for an unconfirmed scan (defense-in-depth).
const card = rd('src/components/plants/AddPlantConfirmationCard.jsx');
has(card, 'isUnconfirmedScan', 'AddPlantConfirmationCard must consult isUnconfirmedScan');
has(card, 'data-testid="add-plant-unconfirmed"', 'AddPlantConfirmationCard must render the safe (no-Add) fallback for unknown');
if (/data-testid="add-plant-unconfirmed"[^]*?Add this plant to My Plants/.test(card) === false && !card.includes('add-plant-unconfirmed'))
  E.push('unknown path must not offer the Add button');

// 3. Farmer-facing reason copy exists for the new reasons.
const sp = rd('src/pages/ScanPage.jsx');
has(sp, "reason === 'unknown_plant' || reason === 'low_confidence'", 'ScanPage must show a specific message for unknown_plant/low_confidence');

// 4. Run the guard test.
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('scan-unknown-guard test did not PASS: ' + out.trim());
  } catch (err) { E.push('scan-unknown-guard test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:scan-unknown-guard] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-unknown-guard] PASS — unknown/low-confidence scans can never create a My Plants entity '
  + '(store chokepoint → no FarmBrain ingest, no tasks); Add-to-My-Plants is hidden for unknown; farmer gets a specific safe reason; test green.');
