#!/usr/bin/env node
/**
 * check-network-intelligence.mjs — Phase 12 gate.
 *
 *   node scripts/check-network-intelligence.mjs
 *
 * Verifies the Phase 12 intelligence-network runtime is complete:
 *   1. 5 sub-engine files present (anonymizer + digitalTwin +
 *      trendDetector + peerBenchmark + recommendationComposer).
 *   2. Composite + hook + DigitalTwinTimeline UI present.
 *   3. All required exports declared.
 *   4. anonymizer's PII drop-list includes the high-risk fields.
 *   5. App.jsx installs the global.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:network-intelligence]';

function _read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}
function fail(m, d) {
  console.error(HEADER, 'FAIL —', m);
  if (d) console.error('  ' + d);
  process.exit(1);
}

const FILES = {
  anonymizer:    'src/runtime/intelligenceNetwork/anonymizer.js',
  digitalTwin:   'src/runtime/intelligenceNetwork/digitalTwin.js',
  trends:        'src/runtime/intelligenceNetwork/trendDetector.js',
  peer:          'src/runtime/intelligenceNetwork/peerBenchmark.js',
  composer:      'src/runtime/intelligenceNetwork/recommendationComposer.js',
  composite:     'src/runtime/intelligenceNetwork/index.js',
  hook:          'src/hooks/useNetworkIntelligence.js',
  twinCard:      'src/components/network/DigitalTwinTimeline.jsx',
  app:           'src/App.jsx',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'anonymizer',  sym: 'anonymizeScanRecord' },
  { src: 'anonymizer',  sym: 'anonymizeTaskRecord' },
  { src: 'anonymizer',  sym: 'anonymizeOutcomeRecord' },
  { src: 'anonymizer',  sym: 'anonymizeRecord' },
  { src: 'anonymizer',  sym: 'auditAnonymity' },
  { src: 'digitalTwin', sym: 'buildDigitalTwin' },
  { src: 'trends',      sym: 'detectTrends' },
  { src: 'peer',        sym: 'computePeerBenchmark' },
  { src: 'composer',    sym: 'composeNetworkRecommendations' },
  { src: 'composite',   sym: 'networkIntelligence' },
  { src: 'composite',   sym: 'installNetworkIntelligenceGlobal' },
  { src: 'composite',   sym: 'NETWORK_INTELLIGENCE_VERSION' },
  { src: 'hook',        sym: 'useNetworkIntelligence' },
];
for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

// PII drop-list — must include at minimum these high-risk fields.
const REQUIRED_PII = [
  'farmerId', 'farmerName', 'email', 'phone', 'deviceId',
  'lat', 'lng', 'latitude', 'longitude',
  'imageBase64', 'imageUrl', 'thumbnail',
  'ipAddress',
];
for (const f of REQUIRED_PII) {
  if (!new RegExp("'" + f + "'").test(sources.anonymizer)) {
    fail('anonymizer.js PII drop-list missing field: ' + f);
  }
}

// UI testids
const TWIN_IDS = ['digital-twin-card'];
for (const id of TWIN_IDS) {
  if (!sources.twinCard.includes(id)) {
    fail('DigitalTwinTimeline missing testid: ' + id);
  }
}

if (!/installNetworkIntelligenceGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installNetworkIntelligenceGlobal() during boot');
}

console.log(HEADER, 'PASS — Phase 12 network intelligence runtime complete.');
console.log('  5 engines + composite + hook + UI card + install wired.');
console.log('  PII drop-list covers ' + REQUIRED_PII.length + ' high-risk fields.');
process.exit(0);
