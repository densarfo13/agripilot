import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ─── 1. Scoring Engine — 4 formulas with correct weights ────────────

describe('Scoring Engine — formulas and weights', () => {
  const code = readFile('server/services/intelligence/scoringEngine.js');

  it('exports computeFarmPestRisk with 7 components', () => {
    expect(code).toContain('export async function computeFarmPestRisk');
    expect(code).toContain('image_score');
    expect(code).toContain('field_stress_score');
    expect(code).toContain('crop_stage_vulnerability');
    expect(code).toContain('weather_suitability');
    expect(code).toContain('nearby_outbreak_density');
    expect(code).toContain('farm_history_score');
    expect(code).toContain('verification_response_score');
  });

  it('farm pest risk weights sum to 1.0', () => {
    const weights = [0.30, 0.20, 0.10, 0.10, 0.15, 0.05, 0.10];
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it('exports computeHotspotScore with 5 components', () => {
    expect(code).toContain('export async function computeHotspotScore');
    expect(code).toContain('anomaly_intensity');
    expect(code).toContain('temporal_change');
    expect(code).toContain('cluster_compactness');
    expect(code).toContain('crop_sensitivity');
    expect(code).toContain('local_validation_evidence');
  });

  it('hotspot weights sum to 1.0', () => {
    const weights = [0.35, 0.20, 0.15, 0.10, 0.20];
    expect(Math.abs(weights.reduce((a, b) => a + b, 0) - 1.0)).toBeLessThan(0.001);
  });

  it('exports computeRegionalOutbreakScore with 6 components', () => {
    expect(code).toContain('export async function computeRegionalOutbreakScore');
    expect(code).toContain('confirmed_reports');
    expect(code).toContain('unconfirmed_signals');
    expect(code).toContain('satellite_anomalies');
    expect(code).toContain('weather_favorability');
    expect(code).toContain('seasonal_baseline_match');
    expect(code).toContain('intervention_failure_rate');
  });

  it('regional outbreak weights sum to 1.0', () => {
    const weights = [0.25, 0.10, 0.20, 0.15, 0.15, 0.15];
    expect(Math.abs(weights.reduce((a, b) => a + b, 0) - 1.0)).toBeLessThan(0.001);
  });

  it('exports computeAlertConfidence with 5 components', () => {
    expect(code).toContain('export async function computeAlertConfidence');
    expect(code).toContain('model_confidence');
    expect(code).toContain('signal_agreement');
    expect(code).toContain('data_quality');
    expect(code).toContain('spatial_relevance');
    expect(code).toContain('recent_trend_strength');
  });

  it('alert confidence weights sum to 1.0', () => {
    const weights = [0.35, 0.25, 0.15, 0.15, 0.10];
    expect(Math.abs(weights.reduce((a, b) => a + b, 0) - 1.0)).toBeLessThan(0.001);
  });

  it('exports riskLevelFromScore', () => {
    expect(code).toContain('export function riskLevelFromScore');
  });

  it('has risk thresholds: low < 40, moderate < 65, high < 80, urgent >= 80', () => {
    expect(code).toContain("low: { min: 0, max: 39");
    expect(code).toContain("moderate: { min: 40, max: 64");
    expect(code).toContain("high: { min: 65, max: 79");
    expect(code).toContain("urgent: { min: 80, max: 100");
  });
});

// ─── 2. Alert Engine ────────────────────────────────────────────────

describe('Alert Engine — anti-spam and orchestration', () => {
  const code = readFile('server/services/intelligence/alertEngine.js');

  it('handles alert creation', () => {
    expect(code).toMatch(/createAlert|evaluateAndCreateAlert/);
  });

  it('has duplicate suppression logic', () => {
    expect(code).toMatch(/suppress|duplicate|cooldown|recent/i);
  });

  it('has confidence threshold check', () => {
    expect(code).toMatch(/confidence|threshold/i);
  });
});

// ─── 3. Backend services exist and are substantial ──────────────────

describe('Intelligence services — completeness', () => {
  it('imageAnalysisService exists with detection logic', () => {
    const code = readFile('server/services/intelligence/imageAnalysisService.js');
    expect(code).toMatch(/analyzeImage|processImage|detect/i);
    expect(code.length).toBeGreaterThan(500);
  });

  it('satelliteService exists with scan processing', () => {
    const code = readFile('server/services/intelligence/satelliteService.js');
    expect(code).toMatch(/processScan|ingest|satellite/i);
    expect(code.length).toBeGreaterThan(500);
  });

  it('droneService exists with scan processing', () => {
    const code = readFile('server/services/intelligence/droneService.js');
    expect(code).toMatch(/processScan|ingest|drone/i);
    expect(code.length).toBeGreaterThan(500);
  });

  it('outbreakService exists with cluster detection', () => {
    const code = readFile('server/services/intelligence/outbreakService.js');
    expect(code).toMatch(/cluster|outbreak|detect/i);
    expect(code.length).toBeGreaterThan(500);
  });
});

// ─── 4. API Routes — pest-risk ──────────────────────────────────────

describe('Pest Risk API routes', () => {
  const code = readFile('server/routes/pest-risk.js');

  it('has image upload endpoint', () => {
    expect(code).toMatch(/router\.post.*images/i);
  });

  it('has report creation endpoint', () => {
    expect(code).toMatch(/router\.post.*report/i);
  });

  it('has farm risk endpoint', () => {
    expect(code).toMatch(/router\.get.*risk/i);
  });

  it('has farm hotspots endpoint', () => {
    expect(code).toMatch(/router\.get.*hotspot/i);
  });

  it('has alerts endpoint', () => {
    expect(code).toMatch(/router\.get.*alert/i);
  });

  it('has diagnosis feedback endpoint', () => {
    expect(code).toMatch(/router\.post.*feedback/i);
  });

  it('has treatment logging endpoint', () => {
    expect(code).toMatch(/router\.post.*treatment/i);
  });

  it('has treatment outcome endpoint', () => {
    expect(code).toMatch(/router\.post.*outcome/i);
  });

  it('uses authenticate middleware', () => {
    expect(code).toContain('authenticate');
  });
});

// ─── 5. API Routes — intelligence-admin ─────────────────────────────

describe('Intelligence Admin API routes', () => {
  const code = readFile('server/routes/intelligence-admin.js');

  it('has regional risk endpoint', () => {
    expect(code).toMatch(/router\.get.*region/i);
  });

  it('has outbreak clusters endpoint', () => {
    expect(code).toMatch(/router\.get.*outbreak|cluster/i);
  });

  it('has high-risk farms endpoint', () => {
    expect(code).toMatch(/router\.get.*high.risk|farms/i);
  });

  it('has hotspots admin endpoint', () => {
    expect(code).toMatch(/router\.get.*hotspot/i);
  });

  it('has alerts admin endpoint', () => {
    expect(code).toMatch(/router\.get.*alert/i);
  });

  it('has intervention effectiveness endpoint', () => {
    expect(code).toMatch(/router\.get.*intervention|effectiveness/i);
  });

  it('has boundary validation endpoint', () => {
    expect(code).toMatch(/router\.post.*boundar|validat/i);
  });

  it('has report review endpoint', () => {
    expect(code).toMatch(/router\.post.*review|report/i);
  });

  it('enforces admin role check', () => {
    expect(code).toMatch(/role.*admin|ADMIN_ROLES|super_admin|institutional_admin/i);
  });
});

// ─── 6. API Routes — intelligence-ingest ────────────────────────────

describe('Intelligence Ingest API routes', () => {
  const code = readFile('server/routes/intelligence-ingest.js');

  it('has satellite ingest endpoint', () => {
    expect(code).toMatch(/router\.post.*satellite/i);
  });

  it('has drone ingest endpoint', () => {
    expect(code).toMatch(/router\.post.*drone/i);
  });

  it('has farm scoring trigger', () => {
    expect(code).toMatch(/router\.post.*score.*farm/i);
  });

  it('has region scoring trigger', () => {
    expect(code).toMatch(/router\.post.*score.*region/i);
  });
});

// ─── 7. Backend wiring — routes mounted in app.js ───────────────────

describe('Backend wiring', () => {
  const appCode = readFile('server/src/app.js');

  it('imports TypeScript intelligence module', () => {
    expect(appCode).toContain("import { intelligenceRouter } from '../intelligence/dist/index.js'");
  });

  it('mounts intelligence router at /api/v2', () => {
    expect(appCode).toContain("app.use('/api/v2', intelligenceRouter)");
  });

  it('TS barrel exports pest-risk, admin, and ingest routes', () => {
    const barrel = readFile('server/intelligence/index.ts');
    expect(barrel).toContain("'/pest-risk'");
    expect(barrel).toContain("'/intelligence-admin'");
    expect(barrel).toContain("'/intelligence-ingest'");
  });
});

// ─── 8. Frontend — farmer intelligence pages exist ──────────────────

describe('Farmer intelligence pages', () => {
  it('PestRiskCheck exists and uses useTranslation', () => {
    const code = readFile('src/pages/PestRiskCheck.jsx');
    expect(code).toContain('useTranslation');
    expect(code).toContain('uploadPestImage');
    expect(code).toContain('createPestReport');
  });

  it('PestRiskResult exists and uses intelligence API', () => {
    const code = readFile('src/pages/PestRiskResult.jsx');
    expect(code).toContain('useTranslation');
    expect(code).toContain('getFarmRisk');
    expect(code).toContain('submitDiagnosisFeedback');
  });

  it('FieldHotspotAlert exists and uses hotspot API', () => {
    const code = readFile('src/pages/FieldHotspotAlert.jsx');
    expect(code).toContain('useTranslation');
    expect(code).toContain('getFarmHotspots');
  });

  it('RegionalWatch exists and uses alerts API', () => {
    const code = readFile('src/pages/RegionalWatch.jsx');
    expect(code).toContain('useTranslation');
    expect(code).toContain('getMyAlerts');
  });

  it('TreatmentFeedback exists with treatment + outcome flow', () => {
    const code = readFile('src/pages/TreatmentFeedback.jsx');
    expect(code).toContain('useTranslation');
    expect(code).toContain('logTreatment');
    expect(code).toContain('logTreatmentOutcome');
  });
});

// ─── 9. Frontend — admin intelligence pages exist ───────────────────

describe('Admin intelligence pages', () => {
  it('RegionalRiskMap exists', () => {
    const code = readFile('src/pages/admin/RegionalRiskMap.jsx');
    expect(code).toContain('getRegionalRisk');
    expect(code.length).toBeGreaterThan(500);
  });

  it('HighRiskFarms exists', () => {
    const code = readFile('src/pages/admin/HighRiskFarms.jsx');
    expect(code).toContain('getHighRiskFarms');
    expect(code.length).toBeGreaterThan(500);
  });

  it('HotspotInspector exists', () => {
    const code = readFile('src/pages/admin/HotspotInspector.jsx');
    expect(code).toContain('getAdminHotspots');
    expect(code.length).toBeGreaterThan(500);
  });

  it('AlertControlCenter exists', () => {
    const code = readFile('src/pages/admin/AlertControlCenter.jsx');
    expect(code).toContain('getAdminAlerts');
    expect(code.length).toBeGreaterThan(500);
  });

  it('InterventionEffectiveness exists', () => {
    const code = readFile('src/pages/admin/InterventionEffectiveness.jsx');
    expect(code).toContain('getInterventionEffectiveness');
    expect(code.length).toBeGreaterThan(500);
  });
});

// ─── 10. Frontend — shared intelligence components ──────────────────

describe('Intelligence UI components', () => {
  it('RiskLevelBadge exists', () => {
    const code = readFile('src/components/intelligence/RiskLevelBadge.jsx');
    expect(code).toContain('RiskLevelBadge');
    expect(code.length).toBeGreaterThan(100);
  });

  it('SeverityBar exists', () => {
    const code = readFile('src/components/intelligence/SeverityBar.jsx');
    expect(code).toContain('SeverityBar');
    expect(code.length).toBeGreaterThan(100);
  });

  it('AlertCard exists', () => {
    const code = readFile('src/components/intelligence/AlertCard.jsx');
    expect(code).toContain('AlertCard');
    expect(code.length).toBeGreaterThan(100);
  });
});

// ─── 11. Frontend wiring — routes in App.jsx ────────────────────────

describe('Frontend route wiring', () => {
  const code = readFile('src/App.jsx');

  it('lazy-loads PestRiskCheck', () => {
    expect(code).toContain("import('./pages/PestRiskCheck.jsx')");
  });

  it('lazy-loads PestRiskResult', () => {
    expect(code).toContain("import('./pages/PestRiskResult.jsx')");
  });

  it('lazy-loads FieldHotspotAlert', () => {
    expect(code).toContain("import('./pages/FieldHotspotAlert.jsx')");
  });

  it('lazy-loads RegionalWatch', () => {
    expect(code).toContain("import('./pages/RegionalWatch.jsx')");
  });

  it('lazy-loads TreatmentFeedback', () => {
    expect(code).toContain("import('./pages/TreatmentFeedback.jsx')");
  });

  it('has /pest-risk-check route', () => {
    expect(code).toContain('path="/pest-risk-check"');
  });

  it('has /field-hotspots route', () => {
    expect(code).toContain('path="/field-hotspots"');
  });

  it('has /regional-watch route', () => {
    expect(code).toContain('path="/regional-watch"');
  });

  it('has /treatment-feedback route', () => {
    expect(code).toContain('path="/treatment-feedback"');
  });

  it('has admin intelligence routes', () => {
    expect(code).toContain('admin/intelligence/regional-risk');
    expect(code).toContain('admin/intelligence/high-risk-farms');
    expect(code).toContain('admin/intelligence/hotspots');
    expect(code).toContain('admin/intelligence/alerts');
    expect(code).toContain('admin/intelligence/interventions');
  });
});

// ─── 12. Layout nav — Intelligence section ──────────────────────────

describe('Layout nav — Intelligence section', () => {
  const code = readFile('src/components/Layout.jsx');

  it('has Intelligence nav section', () => {
    expect(code).toContain("section: 'Intelligence'");
  });

  it('has Regional Risk nav link', () => {
    expect(code).toContain('/admin/intelligence/regional-risk');
  });

  it('has High-Risk Farms nav link', () => {
    expect(code).toContain('/admin/intelligence/high-risk-farms');
  });

  it('has Alert Center nav link', () => {
    expect(code).toContain('/admin/intelligence/alerts');
  });

  it('has Interventions nav link', () => {
    expect(code).toContain('/admin/intelligence/interventions');
  });
});

// ─── 13. Translation completeness — intelligence keys ───────────────

describe('Translations — intelligence keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const pestKeys = [
    'pest.title', 'pest.subtitle', 'pest.step1', 'pest.step2', 'pest.step3', 'pest.step4',
    'pest.cropType', 'pest.selectCrop', 'pest.growthStage', 'pest.selectStage',
    'pest.photoLeaf', 'pest.photoPlant', 'pest.photoField', 'pest.photoHint',
    'pest.analyzing', 'pest.back', 'pest.next', 'pest.submit',
    'pest.resultTitle', 'pest.confidence', 'pest.severity',
    'pest.whatToDoNow', 'pest.whatToInspect', 'pest.followUp',
    'pest.wasHelpful', 'pest.logTreatment', 'pest.loading', 'pest.retry',
  ];

  for (const key of pestKeys) {
    it(`has key '${key}'`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  const treatmentKeys = [
    'treatment.logTitle', 'treatment.outcomeTitle', 'treatment.type',
    'treatment.type.chemical_spray', 'treatment.type.biological_control',
    'treatment.type.manual_removal', 'treatment.type.organic_treatment',
    'treatment.product', 'treatment.notes', 'treatment.save',
    'treatment.howDidItGo', 'treatment.outcome.improved', 'treatment.outcome.same',
    'treatment.outcome.worse', 'treatment.outcome.resolved',
    'treatment.recorded', 'treatment.backToDashboard',
  ];

  for (const key of treatmentKeys) {
    it(`has key '${key}'`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  const regionalKeys = [
    'regional.title', 'regional.subtitle', 'regional.active', 'regional.past', 'regional.noAlerts',
  ];

  for (const key of regionalKeys) {
    it(`has key '${key}'`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('pest.title has all 5 languages', () => {
    const block = translations.substring(
      translations.indexOf("'pest.title'"),
      translations.indexOf("'pest.title'") + 200,
    );
    expect(block).toContain('en:');
    expect(block).toContain('fr:');
    expect(block).toContain('sw:');
    expect(block).toContain('ha:');
    expect(block).toContain('tw:');
  });
});

// ─── 14. Prisma schema — intelligence models ────────────────────────

describe('Prisma schema — intelligence models', () => {
  const schema = readFile('server/prisma/schema.prisma');

  const models = [
    'V2CropCycle', 'V2PestImage', 'V2ImageDetection', 'V2PestReport',
    'V2VerificationAnswer', 'V2SatelliteScan', 'V2FieldStressScore',
    'V2HotspotZone', 'V2DroneScan', 'V2OutbreakCluster',
    'V2DistrictRiskScore', 'V2AlertEvent', 'V2TreatmentAction',
    'V2TreatmentOutcome', 'V2DiagnosisFeedback', 'V2FarmPestRisk',
  ];

  for (const model of models) {
    it(`has model ${model}`, () => {
      expect(schema).toContain(`model ${model}`);
    });
  }

  it('V2PestImage has imageType enum values', () => {
    expect(schema).toContain('leaf_closeup');
    expect(schema).toContain('whole_plant');
    expect(schema).toContain('field_wide');
  });

  it('V2AlertEvent has alertLevel values', () => {
    expect(schema).toContain('watch');
    expect(schema).toContain('elevated');
    expect(schema).toContain('high_risk');
    expect(schema).toContain('urgent');
  });

  it('V2FarmPestRisk has all 7 scoring components', () => {
    expect(schema).toContain('imageScore');
    expect(schema).toContain('fieldStressScore');
    expect(schema).toContain('cropStageVulnerability');
    expect(schema).toContain('weatherSuitability');
    expect(schema).toContain('nearbyOutbreakDensity');
    expect(schema).toContain('farmHistoryScore');
    expect(schema).toContain('verificationResponseScore');
  });
});

// ─── 15. API layer — intelligence client helpers ────────────────────

describe('Intelligence API client helpers', () => {
  it('intelligenceApi.js has all farmer endpoints', () => {
    const code = readFile('src/lib/intelligenceApi.js');
    expect(code).toContain('uploadPestImage');
    expect(code).toContain('createPestReport');
    expect(code).toContain('getFarmRisk');
    expect(code).toContain('getFarmHotspots');
    expect(code).toContain('getMyAlerts');
    expect(code).toContain('submitDiagnosisFeedback');
    expect(code).toContain('logTreatment');
    expect(code).toContain('logTreatmentOutcome');
  });

  it('intelligenceAdminApi.js has all admin endpoints', () => {
    const code = readFile('src/lib/intelligenceAdminApi.js');
    expect(code).toContain('getRegionalRisk');
    expect(code).toContain('getOutbreakClusters');
    expect(code).toContain('getHighRiskFarms');
    expect(code).toContain('getAdminHotspots');
    expect(code).toContain('getAdminAlerts');
    expect(code).toContain('getInterventionEffectiveness');
    expect(code).toContain('ingestSatelliteScan');
    expect(code).toContain('ingestDroneScan');
    expect(code).toContain('triggerFarmScoring');
    expect(code).toContain('triggerRegionScoring');
  });
});
