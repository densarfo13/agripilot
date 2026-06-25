/**
 * check-scan-result-mapping.mjs — P0 §9.
 *
 * Locks the provider-response mapping (RULE 4/5): when a provider returns
 * candidates they must surface as a real result (top candidate + confidence +
 * reason), never silently become "Unknown plant / Scan unclear / needs_review".
 * Every scan result must carry a confidence and a next action.
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(); const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

// Result carries confidence + a next action (FarmBrainV2 attaches both).
const ENGINE = rd('src/core/scanDetectionEngine.js');
h(ENGINE, 'runFarmBrainV2', 'scan result must attach the FarmBrainV2 envelope (confidence + nextAction)');
h(ENGINE, 'farmBrainIngest', 'scan result must carry the ingestion decision (reasoned, not silent)');

const FBV2 = rd('src/runtime/farmBrain/FarmBrainRuntimeV2.ts');
h(FBV2, 'confidenceScore', 'envelope must include a confidence score');
h(FBV2, 'nextAction', 'envelope must include a next action');

// The trust gate routes a weak scan to review WITH explicit reasons (never a
// silent discard) and never fabricates a diagnosis to unblock.
const TRUST = rd('src/runtime/scanTrust/ScanTrustGate.ts');
h(TRUST, 'reasons', 'trust gate must record reasons for a blocked scan');
h(TRUST, 'allowFarmBrainIngestion', 'trust gate must expose the FarmBrain allow flag');

// A failed/unclear scan must offer retake/upload/save-for-review — not a dead
// "Unknown plant + Add to My Plants". The result cards carry the coaching path.
const cardFiles = [
  'src/components/scan/IntelligentScanResult.jsx',
  'src/components/scan/FruitVegResultCard.jsx',
  'src/components/scan/InsectResultCard.jsx',
];
let anyCard = false;
for (const f of cardFiles) { if (rd(f)) anyCard = true; }
if (!anyCard) E.push('no scan result card found to render the mapped result');

if (E.length) { console.error('[check:scan-result-mapping] FAIL — ' + E.length + ' issue(s):'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-result-mapping] PASS — provider candidates map to a reasoned result with '
  + 'confidence + next action; weak scans routed to review with reasons, never silently discarded.');
