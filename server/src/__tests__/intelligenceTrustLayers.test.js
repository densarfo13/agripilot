import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ─── 1. Image Quality Enforcement ───────────────────────────

describe('Feature 1: Image Quality Enforcement', () => {
  const code = readFile('server/intelligence/services/image-quality.service.ts');

  it('exports assessImageQuality function', () => {
    expect(code).toContain('export function assessImageQuality');
  });

  it('exports checkImageCompleteness function', () => {
    expect(code).toContain('export async function checkImageCompleteness');
  });

  it('exports REQUIRED_IMAGE_TYPES with 3 types', () => {
    expect(code).toContain('REQUIRED_IMAGE_TYPES');
    expect(code).toContain('leaf_closeup');
    expect(code).toContain('whole_plant');
    expect(code).toContain('field_wide');
  });

  it('has quality thresholds for blur, brightness, resolution', () => {
    expect(code).toContain('MIN_BLUR_SCORE');
    expect(code).toContain('MIN_BRIGHTNESS');
    expect(code).toContain('MAX_BRIGHTNESS');
  });

  it('returns qualityPassed, qualityScore, rejectionReason', () => {
    expect(code).toContain('qualityPassed');
    expect(code).toContain('qualityScore');
    expect(code).toContain('rejectionReason');
  });

  it('exports getRejectionMessage helper', () => {
    expect(code).toContain('export function getRejectionMessage');
  });

  it('pest-risk route uses assessImageQuality on image upload', () => {
    const routes = readFile('server/intelligence/routes/pest-risk.routes.ts');
    expect(routes).toContain('assessImageQuality');
    expect(routes).toContain('qualityPassed');
  });

  it('pest-risk route gates report creation on checkImageCompleteness', () => {
    const routes = readFile('server/intelligence/routes/pest-risk.routes.ts');
    expect(routes).toContain('checkImageCompleteness');
    expect(routes).toContain('Image requirements not met');
  });
});

// ─── 2. Confidence + Uncertainty Handling ────────────────────

describe('Feature 2: Confidence + Uncertainty Handling', () => {
  const code = readFile('server/intelligence/services/confidence.service.ts');

  it('exports computeDiagnosisConfidence function', () => {
    expect(code).toContain('export async function computeDiagnosisConfidence');
  });

  it('returns confidenceScore, isUncertain, likelyIssue, alternativeIssue', () => {
    expect(code).toContain('confidenceScore');
    expect(code).toContain('isUncertain');
    expect(code).toContain('likelyIssue');
    expect(code).toContain('alternativeIssue');
  });

  it('uses computeAlertConfidence formula for scoring', () => {
    expect(code).toContain('computeAlertConfidence');
  });

  it('pest report response includes confidence and uncertainty fields', () => {
    const routes = readFile('server/intelligence/routes/pest-risk.routes.ts');
    expect(routes).toContain('confidenceScore: diagnosis.confidenceScore');
    expect(routes).toContain('isUncertain: diagnosis.isUncertain');
    expect(routes).toContain('likelyIssue: diagnosis.likelyIssue');
    expect(routes).toContain('alternativeIssue: diagnosis.alternativeIssue');
  });

  it('schema has confidence and uncertainty columns on V2PestReport', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('confidenceScore');
    expect(schema).toContain('isUncertain');
    expect(schema).toContain('likelyIssue');
    expect(schema).toContain('alternativeIssue');
  });
});

// ─── 3. Action Recommendation Engine ─────────────────────────

describe('Feature 3: Action Recommendation Engine', () => {
  const code = readFile('server/intelligence/services/action-engine.service.ts');

  it('exports generateActionGuidance function', () => {
    expect(code).toContain('export function generateActionGuidance');
  });

  it('exports generateAlertActionSummary function', () => {
    expect(code).toContain('export function generateAlertActionSummary');
  });

  it('returns structured guidance with where_to_check, what_to_check, when_to_act', () => {
    expect(code).toContain('where_to_check');
    expect(code).toContain('what_to_check');
    expect(code).toContain('when_to_act');
    expect(code).toContain('when_to_recheck');
    expect(code).toContain('escalation_condition');
  });

  it('has templates for different issue types', () => {
    expect(code).toContain('pest');
    expect(code).toContain('disease');
    expect(code).toContain('nutrient_deficiency');
    expect(code).toContain('uncertain');
  });

  it('pest-risk route generates action guidance on report', () => {
    const routes = readFile('server/intelligence/routes/pest-risk.routes.ts');
    expect(routes).toContain('generateActionGuidance');
    expect(routes).toContain('actionGuidance');
  });
});

// ─── 4. Alert Suppression & Cooldown ─────────────────────────

describe('Feature 4: Alert Suppression & Cooldown', () => {
  const alertCode = readFile('server/intelligence/services/alert.service.ts');

  it('evaluateAndCreateAlert exists', () => {
    expect(alertCode).toContain('evaluateAndCreateAlert');
  });

  it('has anti-spam/cooldown logic', () => {
    // Should check for recent alerts before creating
    expect(alertCode).toContain('duplicate');
  });

  it('supports suppress endpoint in admin routes', () => {
    const adminRoutes = readFile('server/intelligence/routes/admin.routes.ts');
    expect(adminRoutes).toContain('suppress');
  });
});

// ─── 5. Farm Boundary Validation ─────────────────────────────

describe('Feature 5: Farm Boundary Validation', () => {
  const code = readFile('server/intelligence/services/boundary-validation.service.ts');

  it('exports validateBoundary function', () => {
    expect(code).toContain('export async function validateBoundary');
  });

  it('exports farmHasValidBoundary function', () => {
    expect(code).toContain('export async function farmHasValidBoundary');
  });

  it('checks point count, area, accuracy, duplicates', () => {
    expect(code).toContain('point');
    expect(code).toContain('area');
    expect(code).toContain('accuracy');
  });

  it('computes boundary confidence score', () => {
    expect(code).toContain('boundaryConfidence');
  });

  it('satellite service gates on valid boundary', () => {
    const satCode = readFile('server/intelligence/services/satellite.service.ts');
    expect(satCode).toContain('farmHasValidBoundary');
  });

  it('schema has boundary validation fields', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('boundaryConfidence');
    expect(schema).toContain('validationStatus');
    expect(schema).toContain('validationReason');
  });
});

// ─── 6. Post-Diagnosis Feedback Loop ─────────────────────────

describe('Feature 6: Post-Diagnosis Feedback Loop', () => {
  const routes = readFile('server/intelligence/routes/pest-risk.routes.ts');

  it('has feedback endpoint for pest reports', () => {
    expect(routes).toContain('/reports/:id/feedback');
    expect(routes).toContain('submitFeedbackSchema');
  });

  it('stores user feedback, helpful score, confirmed issue', () => {
    expect(routes).toContain('userFeedback');
    expect(routes).toContain('helpfulScore');
    expect(routes).toContain('confirmedIssue');
  });

  it('has false-positive queue in admin routes', () => {
    const adminRoutes = readFile('server/intelligence/routes/admin.routes.ts');
    expect(adminRoutes).toContain('false-positive');
  });
});

// ─── 7. Onboarding Tracking ─────────────────────────────────

describe('Feature 7: Onboarding Tracking', () => {
  it('onboarding service file exists', () => {
    expect(fileExists('server/src/modules/onboarding/service.js')).toBe(true);
  });

  it('onboarding routes file exists', () => {
    expect(fileExists('server/src/modules/onboarding/routes.js')).toBe(true);
  });

  it('schema has OnboardingStatus enum', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('OnboardingStatus');
  });

  it('schema has OnboardingEvent model', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('OnboardingEvent');
  });
});

// ─── 8. Admin Operational Queues ─────────────────────────────

describe('Feature 8: Admin Operational Queues', () => {
  const adminRoutes = readFile('server/intelligence/routes/admin.routes.ts');

  it('has false-positive queue endpoint', () => {
    expect(adminRoutes).toContain('false-positive');
  });

  it('has boundary-review queue endpoint', () => {
    expect(adminRoutes).toContain('boundary-review');
  });

  it('has alert-review queue endpoint', () => {
    expect(adminRoutes).toContain('alert-review');
  });

  it('has queue summary endpoint', () => {
    expect(adminRoutes).toContain('queues/summary');
  });

  it('has auto-validate boundary endpoint', () => {
    expect(adminRoutes).toContain('auto-validate');
  });

  it('frontend has OperationalQueues page', () => {
    expect(fileExists('src/pages/admin/OperationalQueues.jsx')).toBe(true);
  });

  it('App.jsx has route to operational queues', () => {
    const app = readFile('src/App.jsx');
    expect(app).toContain('OperationalQueues');
    expect(app).toContain('admin/intelligence/queues');
  });

  it('admin API has queue endpoint functions', () => {
    const api = readFile('src/lib/intelligenceAdminApi.js');
    expect(api).toContain('getQueueSummary');
    expect(api).toContain('getFalsePositiveQueue');
    expect(api).toContain('getBoundaryReviewQueue');
    expect(api).toContain('getAlertReviewQueue');
  });
});

// ─── 9. Regional Intelligence Confidence ─────────────────────

describe('Feature 9: Regional Intelligence Confidence Thresholding', () => {
  const outbreakCode = readFile('server/intelligence/services/outbreak.service.ts');

  it('computes signalCount in district risk', () => {
    expect(outbreakCode).toContain('signalCount');
  });

  it('computes dataQualityScore in district risk', () => {
    expect(outbreakCode).toContain('dataQualityScore');
  });

  it('classifies confidence level (confirmed/probable/low_confidence)', () => {
    expect(outbreakCode).toContain('confirmed');
    expect(outbreakCode).toContain('probable');
    expect(outbreakCode).toContain('low_confidence');
  });

  it('schema has confidence fields on V2DistrictRiskScore', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('signalCount');
    expect(schema).toContain('confidenceLevel');
    expect(schema).toContain('dataQualityScore');
  });

  it('admin route returns confidence level in regional risk', () => {
    const adminRoutes = readFile('server/intelligence/routes/admin.routes.ts');
    expect(adminRoutes).toContain('confidenceLevel');
  });

  it('frontend RegionalRiskMap shows confidence labels', () => {
    const page = readFile('src/pages/admin/RegionalRiskMap.jsx');
    expect(page).toContain('confidenceLevelDisplay');
    expect(page).toContain('Confirmed');
    expect(page).toContain('Probable');
    expect(page).toContain('Low Confidence');
  });
});

// ─── 10. Predictive Alert Refinement ─────────────────────────

describe('Feature 10: Predictive Alert Refinement', () => {
  const ingestRoutes = readFile('server/intelligence/routes/ingest.routes.ts');

  it('alert evaluation checks multi-signal agreement', () => {
    expect(ingestRoutes).toContain('signalCount');
    expect(ingestRoutes).toContain('signal_agreement');
  });

  it('alert evaluation checks satellite stress', () => {
    expect(ingestRoutes).toContain('recentStress');
    expect(ingestRoutes).toContain('v2FieldStressScore');
  });

  it('alert evaluation checks recent reports', () => {
    expect(ingestRoutes).toContain('recentReports');
    expect(ingestRoutes).toContain('v2PestReport');
  });

  it('alert evaluation checks regional risk', () => {
    expect(ingestRoutes).toContain('regionalRisk');
    expect(ingestRoutes).toContain('v2DistrictRiskScore');
  });

  it('uses computeAlertConfidence with real signal data', () => {
    expect(ingestRoutes).toContain('computeAlertConfidence');
    expect(ingestRoutes).toContain('model_confidence');
    expect(ingestRoutes).toContain('spatial_relevance');
    expect(ingestRoutes).toContain('recent_trend_strength');
  });
});

// ─── Cross-cutting: Barrel exports ───────────────────────────

describe('Cross-cutting: Intelligence barrel exports', () => {
  const barrel = readFile('server/intelligence/index.ts');

  it('exports image quality service', () => {
    expect(barrel).toContain('assessImageQuality');
    expect(barrel).toContain('checkImageCompleteness');
    expect(barrel).toContain('REQUIRED_IMAGE_TYPES');
    expect(barrel).toContain('getRejectionMessage');
  });

  it('exports confidence service', () => {
    expect(barrel).toContain('computeDiagnosisConfidence');
  });

  it('exports action engine service', () => {
    expect(barrel).toContain('generateActionGuidance');
    expect(barrel).toContain('generateAlertActionSummary');
  });

  it('exports boundary validation service', () => {
    expect(barrel).toContain('validateBoundary');
    expect(barrel).toContain('farmHasValidBoundary');
  });
});

// ─── Cross-cutting: Frontend farmer flow ─────────────────────

describe('Cross-cutting: Frontend farmer flow integration', () => {
  it('PestRiskCheck shows image quality feedback', () => {
    const code = readFile('src/pages/PestRiskCheck.jsx');
    expect(code).toContain('imageQuality');
    expect(code).toContain('qualityPassed');
    expect(code).toContain('rejectionReason');
    expect(code).toContain('retryGuidance');
    expect(code).toContain('qualityWarning');
  });

  it('PestRiskCheck uploads images individually for quality check', () => {
    const code = readFile('src/pages/PestRiskCheck.jsx');
    expect(code).toContain('uploadPestImage');
    expect(code).toContain('qualityBadge');
  });

  it('PestRiskResult shows uncertainty banner and action guidance', () => {
    const code = readFile('src/pages/PestRiskResult.jsx');
    expect(code).toContain('isUncertain');
    expect(code).toContain('alternativeIssue');
    expect(code).toContain('where_to_check');
    expect(code).toContain('what_to_check');
    expect(code).toContain('when_to_act');
  });

  it('LandBoundaryCapture shows boundary quality warnings', () => {
    const code = readFile('src/components/LandBoundaryCapture.jsx');
    expect(code).toContain('boundaryWarnings');
    expect(code).toContain('warningBox');
    expect(code).toContain('validationStatus');
  });
});

// ─── Cross-cutting: Migration exists ─────────────────────────

describe('Cross-cutting: Migration', () => {
  it('intelligence trust layers migration exists', () => {
    expect(fileExists('server/prisma/migrations/20260412_intelligence_trust_layers/migration.sql')).toBe(true);
  });

  it('migration adds image quality columns', () => {
    const sql = readFile('server/prisma/migrations/20260412_intelligence_trust_layers/migration.sql');
    expect(sql).toContain('blur_score');
    expect(sql).toContain('brightness_score');
    expect(sql).toContain('quality_passed');
  });

  it('migration adds boundary validation columns', () => {
    const sql = readFile('server/prisma/migrations/20260412_intelligence_trust_layers/migration.sql');
    expect(sql).toContain('boundary_confidence');
    expect(sql).toContain('validation_status');
  });

  it('migration adds regional confidence columns', () => {
    const sql = readFile('server/prisma/migrations/20260412_intelligence_trust_layers/migration.sql');
    expect(sql).toContain('signal_count');
    expect(sql).toContain('confidence_level');
    expect(sql).toContain('data_quality_score');
  });
});
