import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// PART 1 — Schema: UUID Primary Keys on All Models
// ═══════════════════════════════════════════════════════════

describe('All models use UUID primary keys', () => {
  const schema = readFile('server/prisma/schema.prisma');

  const models = [
    'Organization', 'User', 'Farmer', 'Application', 'FarmLocation',
    'FarmBoundary', 'BoundaryPoint', 'EvidenceFile', 'VerificationResult',
    'FraudResult', 'DecisionResult', 'BenchmarkResult', 'IntelligenceResult',
    'ReviewAssignment', 'ReviewNote', 'AuditLog', 'FieldVisit',
    'PortfolioSnapshot', 'FarmActivity', 'Reminder', 'FarmerNotification',
    'ProduceStorageStatus', 'FarmSeason', 'SeasonProgressEntry',
    'StageConfirmation', 'HarvestReport', 'ProgressScore',
    'CredibilityAssessment', 'OfficerValidation', 'BuyerInterest',
    'ApprovalRequest', 'PilotChecklistItem', 'UserFeedback',
    'PilotDailySnapshot', 'AutoNotification', 'FarmProfile',
    'RecommendationRecord', 'WeatherSnapshot', 'FarmFinanceScore',
    'Referral', 'RecommendationFeedback', 'AnalyticsEvent',
    'Issue', 'IssueComment', 'IssueAttachment', 'StaffNotification',
    'PasswordResetToken', 'FederatedIdentity',
  ];

  for (const model of models) {
    it(`${model} has UUID @id @default(uuid())`, () => {
      const re = new RegExp(`model ${model} \\{[^}]*?id\\s+String\\s+@id\\s+@default\\(uuid\\(\\)\\)`);
      expect(schema).toMatch(re);
    });
  }

  // SystemSetting uses a String key @id (not UUID) — this is intentional
  it('SystemSetting uses String key @id (intentional)', () => {
    expect(schema).toContain('model SystemSetting');
    expect(schema).toMatch(/model SystemSetting \{[^}]*?key\s+String\s+@id/);
  });
});

// ═══════════════════════════════════════════════════════════
// PART 2 — Schema: Single-Field Unique Constraints
// ═══════════════════════════════════════════════════════════

describe('Single-field @unique constraints', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('User.email is unique', () => {
    expect(schema).toMatch(/email\s+String\s+@unique/);
  });

  it('User.referralCode is unique', () => {
    expect(schema).toMatch(/referralCode\s+String\?\s+@unique/);
  });

  it('Farmer.userId is unique (1-to-1 with User)', () => {
    expect(schema).toMatch(/userId\s+String\?\s+@unique/);
  });

  it('Farmer.inviteToken is unique', () => {
    expect(schema).toMatch(/inviteToken\s+String\?\s+@unique/);
  });

  it('Referral.code is unique', () => {
    const refBlock = schema.slice(schema.indexOf('model Referral {'));
    expect(refBlock).toMatch(/code\s+String\s+@unique/);
  });

  it('PasswordResetToken.tokenHash is unique', () => {
    expect(schema).toMatch(/tokenHash\s+String\s+@unique/);
  });

  it('HarvestReport.seasonId is unique (1-to-1)', () => {
    const block = schema.slice(schema.indexOf('model HarvestReport {'));
    expect(block).toMatch(/seasonId\s+String\s+@unique/);
  });

  it('ProgressScore.seasonId is unique (1-to-1)', () => {
    const block = schema.slice(schema.indexOf('model ProgressScore {'));
    expect(block).toMatch(/seasonId\s+String\s+@unique/);
  });

  it('CredibilityAssessment.seasonId is unique (1-to-1)', () => {
    const block = schema.slice(schema.indexOf('model CredibilityAssessment {'));
    expect(block).toMatch(/seasonId\s+String\s+@unique/);
  });
});

// ═══════════════════════════════════════════════════════════
// PART 3 — Schema: Compound Unique Constraints
// ═══════════════════════════════════════════════════════════

describe('Compound @@unique constraints', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('Farmer phone + org is unique', () => {
    expect(schema).toContain('uq_farmers_phone_org');
  });

  it('Farmer nationalId + org is unique', () => {
    expect(schema).toContain('uq_farmers_nationalid_org');
  });

  it('FederatedIdentity provider + account is unique', () => {
    expect(schema).toContain('uq_fed_provider_account');
  });

  it('ReviewAssignment application + reviewer is unique', () => {
    expect(schema).toContain('uq_review_assign_app_reviewer');
  });

  it('OfficerValidation season + officer + type is unique', () => {
    expect(schema).toContain('uq_officer_validation_season_officer_type');
  });

  it('Referral referrer + referee pair is unique', () => {
    expect(schema).toContain('uq_referral_pair');
  });

  it('RecommendationFeedback recommendation + user is unique', () => {
    expect(schema).toContain('uq_rec_feedback_rec_user');
  });

  it('PilotChecklistItem itemKey + org is unique', () => {
    expect(schema).toContain('item_org_unique');
  });

  it('PilotDailySnapshot org + date is unique', () => {
    expect(schema).toContain('snapshot_org_date_unique');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 4 — Application-Level Duplicate Checks
// ═══════════════════════════════════════════════════════════

describe('Application-level duplicate checks before DB insert', () => {
  it('assignReviewer checks for existing assignment before creation', () => {
    const code = readFile('server/src/modules/applications/service.js');
    expect(code).toContain('reviewAssignment.findFirst');
    expect(code).toContain('This reviewer is already assigned');
    expect(code).toContain('409');
  });

  it('createOfficerValidation checks for existing validation before creation', () => {
    const code = readFile('server/src/modules/seasons/officerValidation.js');
    expect(code).toContain('officerValidation.findFirst');
    expect(code).toContain('already submitted this validation type');
    expect(code).toContain('409');
  });

  it('recommendation feedback route checks for existing feedback before creation', () => {
    const code = readFile('server/src/modules/farmProfiles/routes.js');
    expect(code).toContain('recommendationFeedback.findFirst');
    expect(code).toContain('already submitted feedback');
    expect(code).toContain('409');
  });

  it('referral service checks for existing referral before creation', () => {
    const code = readFile('server/src/modules/referral/service.js');
    expect(code).toContain('409');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 5 — Global Error Handler: P2002 Friendly Messages
// ═══════════════════════════════════════════════════════════

describe('Error handler returns friendly 409 for unique violations', () => {
  const code = readFile('server/src/middleware/errorHandler.js');

  it('handles P2002 error code', () => {
    expect(code).toContain("err.code === 'P2002'");
  });

  it('returns 409 status for unique violations', () => {
    expect(code).toContain('res.status(409)');
  });

  it('has phone-specific message', () => {
    expect(code).toContain('phone number already exists');
  });

  it('has national ID-specific message', () => {
    expect(code).toContain('national ID already exists');
  });

  it('has referral code-specific message', () => {
    expect(code).toContain('referral code is already in use');
  });

  it('has reviewer assignment-specific message', () => {
    expect(code).toContain('reviewer is already assigned');
  });

  it('has officer validation-specific message', () => {
    expect(code).toContain('already submitted this validation type');
  });

  it('has recommendation feedback-specific message', () => {
    expect(code).toContain('already submitted feedback');
  });

  it('has generic fallback message', () => {
    expect(code).toContain('A record with that value already exists');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 6 — Client-Side ID Generation Safety
// ═══════════════════════════════════════════════════════════

describe('Client-side ID generation uses shared generateId utility', () => {
  it('shared generateId utility exists with crypto.randomUUID', () => {
    const code = readFile('src/utils/generateId.js');
    expect(code).toContain('crypto.randomUUID');
    expect(code).toContain('export function generateUUID');
    expect(code).toContain('export function generateOfflineId');
    expect(code).toContain('export function isOfflineId');
  });

  it('API client imports and uses shared generateUUID', () => {
    const code = readFile('src/api/client.js');
    expect(code).toContain("import { generateUUID } from '../utils/generateId.js'");
    expect(code).toContain('generateUUID()');
    expect(code).toContain('X-Idempotency-Key');
  });

  it('farmStore imports shared generateUUID and generateOfflineId', () => {
    const code = readFile('src/store/farmStore.js');
    expect(code).toContain("import { generateUUID, generateOfflineId } from '../utils/generateId.js'");
    expect(code).toContain("'X-Idempotency-Key'");
  });

  it('offline placeholder IDs use generateOfflineId not Date.now()', () => {
    const code = readFile('src/store/farmStore.js');
    expect(code).toContain("generateOfflineId('rec')");
    // Should NOT use Date.now() alone for placeholder IDs (collision risk)
    expect(code).not.toContain("id: `offline-${Date.now()}`");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 7 — Offline Queue ID Safety
// ═══════════════════════════════════════════════════════════

describe('Offline queue mutation IDs', () => {
  const code = readFile('src/utils/offlineQueue.js');

  it('uses IndexedDB autoIncrement for mutation IDs', () => {
    expect(code).toContain('autoIncrement: true');
  });

  it('10s dedup window prevents duplicate enqueue', () => {
    expect(code).toContain('10000');
  });

  it('409 Conflict treated as already-processed (idempotent replay)', () => {
    expect(code).toContain('409');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 8 — Migration File Exists
// ═══════════════════════════════════════════════════════════

describe('Migration for unique ID enforcement', () => {
  const sql = readFile('server/prisma/migrations/20260410_unique_id_enforcement/migration.sql');

  it('adds nationalId+org unique constraint', () => {
    expect(sql).toContain('uq_farmers_nationalid_org');
    expect(sql).toContain('"national_id", "organization_id"');
  });

  it('adds referral code unique constraint', () => {
    expect(sql).toContain('uq_referral_code');
  });

  it('adds referral pair unique constraint', () => {
    expect(sql).toContain('uq_referral_pair');
    expect(sql).toContain('"referrer_id", "referee_id"');
  });

  it('adds review assignment unique constraint', () => {
    expect(sql).toContain('uq_review_assign_app_reviewer');
    expect(sql).toContain('"application_id", "reviewer_id"');
  });

  it('adds officer validation unique constraint', () => {
    expect(sql).toContain('uq_officer_validation_season_officer_type');
    expect(sql).toContain('"season_id", "officer_id", "validation_type"');
  });

  it('adds recommendation feedback unique constraint', () => {
    expect(sql).toContain('uq_rec_feedback_rec_user');
    expect(sql).toContain('"recommendation_id", "user_id"');
  });

  it('uses IF NOT EXISTS for safe re-run', () => {
    expect(sql).toContain('IF NOT EXISTS');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 9 — No Regression: Existing Unique Constraints Intact
// ═══════════════════════════════════════════════════════════

describe('Existing unique constraints not removed', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('User email still unique', () => {
    expect(schema).toMatch(/email\s+String\s+@unique/);
  });

  it('Farmer phone+org compound unique still present', () => {
    expect(schema).toContain('uq_farmers_phone_org');
  });

  it('Farmer userId still unique (1-to-1)', () => {
    expect(schema).toMatch(/userId\s+String\?\s+@unique\s+@map/);
  });

  it('FederatedIdentity provider+account still unique', () => {
    expect(schema).toContain('uq_fed_provider_account');
  });

  it('1-to-1 relations still use @unique on FK', () => {
    // VerificationResult, FraudResult, DecisionResult, BenchmarkResult, IntelligenceResult
    expect(schema).toMatch(/model VerificationResult \{[^}]*?applicationId\s+String\s+@unique/);
    expect(schema).toMatch(/model FraudResult \{[^}]*?applicationId\s+String\s+@unique/);
    expect(schema).toMatch(/model DecisionResult \{[^}]*?applicationId\s+String\s+@unique/);
  });
});

// ═══════════════════════════════════════════════════════════
// PART 10 — Formal @relation on Previously Plain-String FK Fields
// ═══════════════════════════════════════════════════════════

describe('FK fields have proper @relation to User', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('Farmer.assignedOfficerId has @relation to User', () => {
    expect(schema).toContain('"FarmerAssignedOfficer"');
    expect(schema).toContain('assignedOfficer');
  });

  it('Farmer.approvedById has @relation to User', () => {
    expect(schema).toContain('"FarmerApprovedBy"');
    expect(schema).toContain('approvedBy');
  });

  it('OfficerValidation.officerId has @relation to User', () => {
    expect(schema).toContain('"ValidationOfficer"');
    const block = schema.slice(schema.indexOf('model OfficerValidation'));
    expect(block).toContain('officer');
    expect(block).toContain('@relation("ValidationOfficer"');
  });

  it('AutoNotification.userId has @relation to User', () => {
    expect(schema).toContain('"AutoNotifTargetUser"');
    const block = schema.slice(schema.indexOf('model AutoNotification'));
    expect(block).toContain('targetUser');
    expect(block).toContain('@relation("AutoNotifTargetUser"');
  });

  it('User model has reverse relation arrays for all FK relations', () => {
    const userBlock = schema.slice(schema.indexOf('model User {'), schema.indexOf('@@map("users")'));
    expect(userBlock).toContain('farmersAssigned');
    expect(userBlock).toContain('farmersApproved');
    expect(userBlock).toContain('officerValidations');
    expect(userBlock).toContain('autoNotifications');
  });

  it('Audit trail fields (closedBy, reopenedBy) are documented as userId strings', () => {
    expect(schema).toContain('closedBy');
    expect(schema).toContain('audit trail');
    expect(schema).toContain('reopenedBy');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 11 — Display ID Utility
// ═══════════════════════════════════════════════════════════

describe('Human-readable display ID utility', () => {
  const code = readFile('server/src/utils/displayId.js');

  it('exports toDisplayId function', () => {
    expect(code).toContain('export function toDisplayId');
  });

  it('exports parseDisplayId function', () => {
    expect(code).toContain('export function parseDisplayId');
  });

  it('has prefixes for all core entity types', () => {
    expect(code).toContain("user:");
    expect(code).toContain("farmer:");
    expect(code).toContain("farmProfile:");
    expect(code).toContain("season:");
    expect(code).toContain("progressEntry:");
    expect(code).toContain("evidenceFile:");
    expect(code).toContain("validation:");
    expect(code).toContain("organization:");
    expect(code).toContain("assignment:");
    expect(code).toContain("application:");
    expect(code).toContain("referral:");
  });

  it('generates 3-letter prefix + 6-char hex format', () => {
    expect(code).toContain('.slice(0, 3)');
    expect(code).toContain('.slice(4, 10)');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 12 — FarmerName Denormalization Sync
// ═══════════════════════════════════════════════════════════

describe('FarmProfile.farmerName stays in sync with Farmer.fullName', () => {
  it('updateFarmer syncs farmerName to FarmProfile when fullName changes', () => {
    const code = readFile('server/src/modules/farmers/service.js');
    expect(code).toContain('farmProfile.updateMany');
    expect(code).toContain('farmerName: data.fullName');
  });

  it('farm profile route auto-injects farmerName from Farmer if not provided', () => {
    const code = readFile('server/src/modules/farmProfiles/routes.js');
    expect(code).toContain('body.farmerName = farmer?.fullName');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 13 — Migration Includes FK Constraints
// ═══════════════════════════════════════════════════════════

describe('Migration includes FK constraints for newly-related fields', () => {
  const sql = readFile('server/prisma/migrations/20260410_unique_id_enforcement/migration.sql');

  it('adds FK for Farmer.assignedOfficerId', () => {
    expect(sql).toContain('fk_farmers_assigned_officer');
    expect(sql).toContain('"assigned_officer_id"');
    expect(sql).toContain('"users"("id")');
  });

  it('adds FK for Farmer.approvedById', () => {
    expect(sql).toContain('fk_farmers_approved_by');
    expect(sql).toContain('"approved_by_id"');
  });

  it('adds FK for OfficerValidation.officerId', () => {
    expect(sql).toContain('fk_officer_validation_officer');
    expect(sql).toContain('"officer_id"');
  });

  it('adds FK for AutoNotification.userId', () => {
    expect(sql).toContain('fk_autonotif_target_user');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 14 — Reporting Aggregates by IDs Not Names
// ═══════════════════════════════════════════════════════════

describe('Reports aggregate by IDs and enums, never by names', () => {
  it('portfolio summary groups by status/enum not by farmer name', () => {
    const code = readFile('server/src/modules/portfolio/service.js');
    // groupBy uses status, cropType, region — all enums/controlled fields
    expect(code).toContain("groupBy");
    expect(code).toContain("by: ['status']");
    expect(code).not.toMatch(/groupBy\([^)]*fullName/);
    expect(code).not.toMatch(/groupBy\([^)]*farmerName/);
  });

  it('pilot metrics counts by IDs not names', () => {
    const code = readFile('server/src/modules/pilotMetrics/service.js');
    expect(code).toContain('.count(');
    expect(code).not.toMatch(/groupBy\([^)]*fullName/);
  });

  it('analytics groups by event type not user name', () => {
    const code = readFile('server/src/modules/analytics/service.js');
    expect(code).toContain("by: ['event']");
    expect(code).not.toMatch(/groupBy\([^)]*fullName/);
  });
});

// ═══════════════════════════════════════════════════════════
// PART 15 — Frontend Uses IDs Not Names for Entity Identity
// ═══════════════════════════════════════════════════════════

describe('Frontend identifies entities by ID not name', () => {
  it('React routes use :id and :farmerId params', () => {
    const app = readFile('src/App.jsx');
    expect(app).toContain(':id');
    expect(app).toContain(':farmerId');
  });

  it('farmStore operations use farmId parameter', () => {
    const code = readFile('src/store/farmStore.js');
    expect(code).toContain('fetchProfile: async (farmId)');
    expect(code).toContain('updateProfile: async (farmId');
    expect(code).toContain('fetchRecommendations: async (farmId)');
  });

  it('API client attaches orgId for org-scoped requests', () => {
    const code = readFile('src/api/client.js');
    expect(code).toContain('selectedOrgId');
    expect(code).toContain('config.params.orgId');
  });
});
