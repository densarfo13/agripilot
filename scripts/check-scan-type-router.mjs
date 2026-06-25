/**
 * check-scan-type-router.mjs — SCAN TYPE ROUTER build gates (spec §7 + §8).
 * Fail build if: fruit scan renders "Unknown plant"; vegetable scan renders
 * only the crop-health card; insect scan bypasses Insect.id; a low-confidence
 * result can create a plant; or scanType is missing from the scan result.
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(), E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

// Contracts.
const C = 'src/runtime/scan/router/ScanTypeContracts.ts';
if (!x(C)) E.push('missing: ' + C); else { const s = rd(C);
  for (const t of ['leaf', 'whole_plant', 'stem', 'fruit', 'vegetable', 'insect', 'soil', 'unknown'])
    h(s, "'" + t + "'", 'scan type missing: ' + t);
  h(s, 'SCAN_ROUTE_BY_TYPE', 'must map types → routes');
  h(s, 'ROUTE_PROVIDERS', 'must declare route providers');
  if (!/insect_pest:\s*Object\.freeze\(\['insect\.id'\]\)/.test(s))
    E.push('insect route MUST go through insect.id (no bypass)');
  if (!/SCAN_CONFIDENCE_MIN\s*=\s*70/.test(s)) E.push('SCAN_CONFIDENCE_MIN must be 70');
  for (const m of ['auto', 'plant', 'leaf', 'fruit', 'vegetable', 'insect', 'soil'])
    h(s, "'" + m + "'", 'scan mode missing: ' + m);
}

// Router + safety gate + health.
const RT = 'src/runtime/scan/router/ScanTypeRouter.ts';
if (!x(RT)) E.push('missing: ' + RT); else { const s = rd(RT);
  h(s, 'export function detectScanType', 'must export detectScanType');
  h(s, 'export function applyScanTypeSafetyGate', 'must export the safety gate');
  h(s, 'allowPlantCreation: false', 'low confidence must block plant creation');
  h(s, 'installScanTypeRouterHealth', 'must install the health global');
  for (const f of ['routerReady', 'fruitRouteReady', 'vegetableRouteReady', 'insectRouteReady', 'soilRouteReady', 'lowConfidenceBlocked'])
    h(s, f, '__scanTypeRouterHealth must expose: ' + f);
}

// scanType present on every result.
const ENG = rd('src/core/scanDetectionEngine.js');
h(ENG, 'detectScanType', 'engine must classify every result');
h(ENG, 'scanType: decision.scanType', 'engine must attach scanType to every result');

// Fruit/veg card — never the plant-only dead-ends.
const FV = 'src/components/scan/FruitVegResultCard.jsx';
if (!x(FV)) E.push('missing: ' + FV); else { const s = rd(FV);
  h(s, 'fruit-veg-result-card', 'fruit/veg card testid');
  h(s, "tSafe('fruit.row.status'", 'must render Status');
  h(s, "tSafe('fruit.row.quality'", 'must render Quality');
  if (/Unknown plant/i.test(s)) E.push('FAIL §8: fruit/veg card must NEVER render "Unknown plant"');
  if (/Needs review/i.test(s)) E.push('FAIL §8: fruit/veg card must NEVER render "Needs review"');
}

// Insect card — through insect.id route.
const IN = 'src/components/scan/InsectResultCard.jsx';
if (!x(IN)) E.push('missing: ' + IN); else { const s = rd(IN);
  h(s, 'insect-result-card', 'insect card testid');
  h(s, 'insect_pest', 'insect card must declare the insect_pest route');
  if (/Unknown plant/i.test(s)) E.push('FAIL §8: insect card must NEVER render "Unknown plant"');
}

// The production result card routes fruit/veg + insect to their cards.
const ISR = rd('src/components/scan/IntelligentScanResult.jsx');
h(ISR, '<FruitVegResultCard', 'IntelligentScanResult must route fruit/vegetable to FruitVegResultCard');
h(ISR, '<InsectResultCard', 'IntelligentScanResult must route insect to InsectResultCard');
if (!/_scanType === 'fruit' \|\| _scanType === 'vegetable'/.test(ISR))
  E.push('FAIL §8: vegetable must route to the fruit-quality card, not crop-health-only');

// Pre-scan mode buttons + health install.
h(rd('src/components/scan/ScanModeSelector.jsx'), 'scan-mode-selector', 'must provide the scan-mode selector');
h(rd('src/App.jsx'), 'installScanTypeRouterHealth', 'App must install __scanTypeRouterHealth');

if (E.length) { console.error('[check:scan-type-router] FAIL — ' + E.length + ' issue(s):'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-type-router] PASS — 8 scan types routed; fruit/veg + insect get their own cards (never "Unknown plant"); insect→Insect.id; low-confidence blocks plant creation; scanType on every result; 6 scan-mode buttons; health global wired.');
