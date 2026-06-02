/**
 * check-scan-v3.mjs — locks the Scan Intelligence V3 sprint
 * contract. Distinct from the prior V2 gate.
 *
 * Fails build when:
 *   1. insectProvider missing the new pest categories
 *      (spider_mite, caterpillar) OR missing the new envelope
 *      fields (lifecycle, treatment, organicTreatment, chemicalTreatment).
 *   2. soilProvider missing the new fields (moisture,
 *      fertilityScore, soilRisk, soilRecommendation, organicCarbon).
 *   3. fieldHealthProvider missing the V3 aliases (vigor, trend,
 *      stressLevel).
 *   4. growthStageEngine missing OR doesn't export deriveGrowthStage
 *      OR doesn't return all 7 stages.
 *   5. regionalIntelligenceProvider missing OR doesn't export
 *      getRegionalIntelligence OR missing the 5 spec fields.
 *   6. marketEngine missing OR doesn't export getMarketIntelligence
 *      OR missing the 5 spec fields.
 *   7. followUpEngine missing OR doesn't export buildFollowUpPlan
 *      AND recordFollowUpOutcome AND offsets 3,7,14.
 *   8. /api/scan/analyze does NOT lazy-import all 4 new modules
 *      AND surface growthStage / regional / market / followUpPlan.
 *   9. /api/scan/follow-up POST endpoint missing.
 *  10. ScanCommandCard missing OR not rendering all 7 sections.
 *  11. ScanRecoveryEnvelope NOT bumped to v4 + NOT carrying
 *      growthStage / regional / market.
 *  12. ScanPage NOT mounting <ScanCommandCard /> in the result phase.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

function _exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; }
}
function _read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; }
}
function _has(haystack, needle, label) {
  if (!haystack.includes(needle)) errors.push(label);
}

// ─── 1. Insect provider extensions ────────────────────────────
const INSECT = 'server/src/ml/providers/insectProvider.js';
if (!_exists(INSECT)) {
  errors.push('missing: ' + INSECT);
} else {
  const src = _read(INSECT);
  const NEW_CATEGORIES = ['spider_mite', 'caterpillar'];
  for (const c of NEW_CATEGORIES) {
    if (!src.includes("'" + c + "'")) {
      errors.push('insectProvider missing new V3 pest category: ' + c);
    }
  }
  const NEW_FIELDS = ['lifecycle:', 'organicTreatment:', 'chemicalTreatment:', 'treatment:'];
  for (const f of NEW_FIELDS) {
    if (!src.includes(f)) {
      errors.push('insectProvider missing V3 envelope field: ' + f);
    }
  }
}

// ─── 2. Soil provider extensions ──────────────────────────────
const SOIL = 'server/src/ml/providers/soilProvider.js';
if (!_exists(SOIL)) {
  errors.push('missing: ' + SOIL);
} else {
  const src = _read(SOIL);
  const NEW_SOIL = ['moisture', 'fertilityScore', 'soilRisk', 'soilRecommendation', 'organicCarbon'];
  for (const f of NEW_SOIL) {
    if (!src.includes(f)) {
      errors.push('soilProvider missing V3 field: ' + f);
    }
  }
}

// ─── 3. Field-health aliases ──────────────────────────────────
const FIELD = 'server/src/ml/providers/fieldHealthProvider.js';
if (!_exists(FIELD)) {
  errors.push('missing: ' + FIELD);
} else {
  const src = _read(FIELD);
  const ALIASES = ['vigor:', 'trend:', 'stressLevel:'];
  for (const a of ALIASES) {
    if (!src.includes(a)) {
      errors.push('fieldHealthProvider missing V3 alias: ' + a);
    }
  }
}

// ─── 4. Growth stage engine ───────────────────────────────────
const GROWTH = 'server/src/ml/growthStageEngine.js';
if (!_exists(GROWTH)) {
  errors.push('missing: ' + GROWTH);
} else {
  const src = _read(GROWTH);
  _has(src, 'export function deriveGrowthStage',
    'growthStageEngine must export deriveGrowthStage');
  const STAGES = ['seeded', 'germination', 'early_growth', 'vegetative',
    'flowering', 'fruiting', 'harvest_ready'];
  for (const s of STAGES) {
    if (!src.includes("'" + s + "'")) {
      errors.push('growthStageEngine missing stage: ' + s);
    }
  }
  _has(src, 'nextMilestone',
    'growthStageEngine must compute nextMilestone');
}

// ─── 5. Regional intelligence ─────────────────────────────────
const REGIONAL = 'server/src/ml/providers/regionalIntelligenceProvider.js';
if (!_exists(REGIONAL)) {
  errors.push('missing: ' + REGIONAL);
} else {
  const src = _read(REGIONAL);
  _has(src, 'export async function getRegionalIntelligence',
    'regionalIntelligenceProvider must export getRegionalIntelligence');
  const FIELDS = ['diseasePressure', 'pestPressure', 'rainfallTrend',
    'plantingWindow', 'harvestWindow'];
  for (const f of FIELDS) {
    if (!src.includes(f)) {
      errors.push('regionalIntelligenceProvider missing field: ' + f);
    }
  }
}

// ─── 6. Market engine ─────────────────────────────────────────
const MARKET = 'server/src/ml/marketEngine.js';
if (!_exists(MARKET)) {
  errors.push('missing: ' + MARKET);
} else {
  const src = _read(MARKET);
  _has(src, 'export async function getMarketIntelligence',
    'marketEngine must export getMarketIntelligence');
  const FIELDS = ['currentPrice', 'priceTrend', 'nearbyBuyers',
    'recommendedSellWindow', 'demandScore'];
  for (const f of FIELDS) {
    if (!src.includes(f)) {
      errors.push('marketEngine missing field: ' + f);
    }
  }
  _has(src, 'neverFabricatesPrices: true',
    'marketEngine must declare neverFabricatesPrices: true');
}

// ─── 7. Follow-up engine ──────────────────────────────────────
const FOLLOWUP = 'server/src/ml/followUpEngine.js';
if (!_exists(FOLLOWUP)) {
  errors.push('missing: ' + FOLLOWUP);
} else {
  const src = _read(FOLLOWUP);
  _has(src, 'export function buildFollowUpPlan',
    'followUpEngine must export buildFollowUpPlan');
  _has(src, 'export async function recordFollowUpOutcome',
    'followUpEngine must export recordFollowUpOutcome');
  _has(src, 'export async function readFollowUpHistory',
    'followUpEngine must export readFollowUpHistory');
  if (!/FOLLOWUP_OFFSETS_DAYS\s*=\s*Object\.freeze\(\[\s*3\s*,\s*7\s*,\s*14\s*\]\)/.test(src)) {
    errors.push('followUpEngine must declare FOLLOWUP_OFFSETS_DAYS = [3, 7, 14]');
  }
  const STATUSES = ['pending', 'improved', 'same', 'worse'];
  for (const s of STATUSES) {
    if (!src.includes("'" + s + "'")) {
      errors.push('followUpEngine missing status value: ' + s);
    }
  }
}

// ─── 8. /api/scan/analyze wires all V3 modules ────────────────
const APP = 'server/src/app.js';
if (!_exists(APP)) {
  errors.push('missing: ' + APP);
} else {
  const src = _read(APP);
  _has(src, "import('./ml/growthStageEngine.js')",
    'app.js must lazy-import growthStageEngine');
  _has(src, "import('./ml/providers/regionalIntelligenceProvider.js')",
    'app.js must lazy-import regionalIntelligenceProvider');
  _has(src, "import('./ml/marketEngine.js')",
    'app.js must lazy-import marketEngine');
  _has(src, "import('./ml/followUpEngine.js')",
    'app.js must lazy-import followUpEngine');
  _has(src, 'deriveGrowthStage(',
    'app.js must call deriveGrowthStage');
  _has(src, 'getRegionalIntelligence(',
    'app.js must call getRegionalIntelligence');
  _has(src, 'getMarketIntelligence(',
    'app.js must call getMarketIntelligence');
  _has(src, 'buildFollowUpPlan(',
    'app.js must call buildFollowUpPlan');
  // Response surface fields
  _has(src, 'growthStage,',
    'app.js response must include growthStage at top level');
  _has(src, 'regional,',
    'app.js response must include regional at top level');
  _has(src, 'market,',
    'app.js response must include market at top level');
  _has(src, 'followUpPlan,',
    'app.js response must include followUpPlan at top level');
  // 9. Follow-up endpoint
  _has(src, "app.post('/api/scan/follow-up'",
    'app.js must expose POST /api/scan/follow-up');
  _has(src, "app.get('/api/scan/follow-up/history'",
    'app.js must expose GET /api/scan/follow-up/history');
}

// ─── 10. ScanCommandCard 7-section render ─────────────────────
const COMMAND = 'src/components/scan/ScanCommandCard.jsx';
if (!_exists(COMMAND)) {
  errors.push('missing: ' + COMMAND);
} else {
  const src = _read(COMMAND);
  _has(src, 'data-testid="scan-command-card"',
    'ScanCommandCard must expose data-testid="scan-command-card"');
  _has(src, 'data-consumes="scanRecovery"',
    'ScanCommandCard must declare data-consumes="scanRecovery"');
  const SECTIONS = ['scan-command-plant', 'scan-command-disease',
    'scan-command-pest', 'scan-command-soil',
    'scan-command-market', 'scan-command-region',
    'scan-command-satellite'];
  for (const s of SECTIONS) {
    if (!src.includes(s)) {
      errors.push('ScanCommandCard missing section data-testid: ' + s);
    }
  }
}

// ─── 11. Envelope bumped to v4 + carries V3 fields ────────────
const ENVELOPE = 'server/src/ml/scanRecoveryEnvelope.js';
if (!_exists(ENVELOPE)) {
  errors.push('missing: ' + ENVELOPE);
} else {
  const src = _read(ENVELOPE);
  _has(src, 'scan-recovery-envelope-v4',
    'scanRecoveryEnvelope runtimeVersion must bump to v4');
  _has(src, 'growthStage,',
    'scanRecoveryEnvelope must carry growthStage field');
  _has(src, 'regional,',
    'scanRecoveryEnvelope must carry regional field');
  _has(src, 'market,',
    'scanRecoveryEnvelope must carry market field');
}

// ─── 12. ScanPage mounts ScanCommandCard ──────────────────────
const SCAN_PAGE = 'src/pages/ScanPage.jsx';
if (!_exists(SCAN_PAGE)) {
  errors.push('missing: ' + SCAN_PAGE);
} else {
  const src = _read(SCAN_PAGE);
  _has(src, 'ScanCommandCard',
    'ScanPage.jsx must import ScanCommandCard');
  _has(src, '<ScanCommandCard',
    'ScanPage.jsx must render <ScanCommandCard');
}

if (errors.length) {
  console.error('[check:scan-v3] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:scan-v3] PASS — Pest V3 + Growth + Soil V3 + Satellite aliases + Regional + Market + Follow-up + Command Center wired.');
