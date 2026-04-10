import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ─── 1. Activation Reliability ──────────────────────────────

describe('Activation Reliability', () => {
  const wizard = () => readFile('src/components/OnboardingWizard.jsx');
  const pending = () => readFile('src/pages/PendingRegistrationsPage.jsx');
  const progress = () => readFile('src/pages/FarmerProgressTab.jsx');

  it('OnboardingWizard has submitSuccess state', () => {
    const src = wizard();
    expect(src).toContain('setSubmitSuccess');
    expect(src).toContain('submitSuccess');
  });

  it('OnboardingWizard tracks onboarding_completed event', () => {
    const src = wizard();
    expect(src).toContain("trackPilotEvent('onboarding_completed'");
  });

  it('OnboardingWizard has draft restoration banner with Dismiss', () => {
    const src = wizard();
    expect(src).toContain("saveStatus === 'restored'");
    expect(src).toContain("t('wizard.draftRestored')");
    expect(src).toContain("t('wizard.dismiss')");
  });

  it('OnboardingWizard shows retry on network error', () => {
    const src = wizard();
    expect(src).toContain('setNetworkError');
    expect(src).toContain("networkError ? t('common.retry')");
  });

  it('PendingRegistrationsPage uses /farmers/ endpoints (not /users/)', () => {
    const src = pending();
    expect(src).toContain('/farmers/pending-registrations');
    expect(src).toContain('/farmers/self-registered');
    // Approval and rejection also use /farmers/ path
    expect(src).toContain('/farmers/${farmer.id}/approve-registration');
  });

  it('FarmerProgressTab shows first-update-submitted feedback', () => {
    const src = progress();
    expect(src).toContain("trackPilotEvent('first_update_submitted'");
    expect(src).toContain("t('progress.firstActivityRecorded')");
  });
});

// ─── 2. First Action Success ────────────────────────────────

describe('First Action Success', () => {
  const progress = () => readFile('src/pages/FarmerProgressTab.jsx');

  it('FarmerProgressTab has formatApiError for specific error messages', () => {
    const src = progress();
    expect(src).toContain('formatApiError');
    // Imported at the top
    expect(src).toContain("import api, { formatApiError }");
  });

  it('FarmerProgressTab shows duplicate warning with date context', () => {
    const src = progress();
    expect(src).toContain('dupWarning');
    expect(src).toContain("t('progress.duplicateWarning')");
  });

  it('FarmerProgressTab has submission status indicator (Submitted badge)', () => {
    const src = progress();
    // The green "Submitted" badge on entries
    expect(src).toContain("t('progress.submitted')");
  });

  it('FarmerProgressTab success message duration is 5 seconds', () => {
    const src = progress();
    // showSuccess clears after 5000 ms
    expect(src).toContain("setTimeout(() => setSuccessMsg(''), 5000)");
  });

  it('FarmerProgressTab preserves form data on error (useDraft)', () => {
    const src = progress();
    expect(src).toContain("import { useDraft }");
    // Draft key includes farmerId + season
    expect(src).toContain('progress-form:${farmerId}:${activeSeason');
    // On error, form data preserved via localized key
    expect(src).toContain("t('progress.saveActivityError')");
  });
});

// ─── 3. Invite Trust ────────────────────────────────────────

describe('Invite Trust', () => {
  const inviteRoutes = () => readFile('server/src/modules/invites/routes.js');
  const farmerRoutes = () => readFile('server/src/modules/farmers/routes.js');
  const acceptPage = () => readFile('src/pages/AcceptInvitePage.jsx');
  const farmerService = () => readFile('server/src/modules/farmers/service.js');

  it('Invite routes have staffNotification on acceptance (invite_accepted)', () => {
    const src = inviteRoutes();
    expect(src).toContain('staffNotification.create');
    expect(src).toContain("type: 'invite_accepted'");
  });

  it('Farmers routes have inviteResendMeta tracking', () => {
    const src = farmerRoutes();
    expect(src).toContain('inviteResendMeta');
    expect(src).toContain('totalCount');
  });

  it('Farmers routes have resend rate protection (429)', () => {
    const src = farmerRoutes();
    expect(src).toContain('resendInviteLimiter');
    expect(src).toContain('429');
    expect(src).toContain('Invite resend limit reached');
  });

  it('AcceptInvitePage has clear expired invite CTA mentioning organization admin', () => {
    const src = acceptPage();
    expect(src).toContain("t('invite.expired')");
    expect(src).toContain("t('invite.expiredContact')");
    expect(src).toContain("t('invite.whatToDo')");
  });

  it('Farmers service supports assignedOfficerId in updateFarmer', () => {
    const src = farmerService();
    expect(src).toContain('export async function updateFarmer');
    expect(src).toContain('assignedOfficerId');
  });
});

// ─── 4. Data Quality ────────────────────────────────────────

describe('Data Quality', () => {
  const farmerService = () => readFile('server/src/modules/farmers/service.js');
  const farmProfileService = () => readFile('server/src/modules/farmProfiles/service.js');

  it('Farmers service has VALID_GENDERS validation', () => {
    const src = farmerService();
    expect(src).toContain('VALID_GENDERS');
    expect(src).toContain("'male'");
    expect(src).toContain("'female'");
    expect(src).toContain("'other'");
    expect(src).toContain("'prefer_not_to_say'");
  });

  it('Farmers service normalizes gender to lowercase', () => {
    const src = farmerService();
    expect(src).toContain('.toLowerCase().trim()');
    expect(src).toContain('VALID_GENDERS.includes(data.gender)');
  });

  it('Farmers service validates coordinate ranges (-90..90, -180..180)', () => {
    const src = farmerService();
    expect(src).toContain('lat < -90 || lat > 90');
    expect(src).toContain('lng < -180 || lng > 180');
  });

  it('Farmers service requires both lat/lon together', () => {
    const src = farmerService();
    expect(src).toContain('Both latitude and longitude must be provided together');
  });

  it('Farmers service uses normalizeCrop', () => {
    const src = farmerService();
    expect(src).toContain("import { normalizeCrop }");
    expect(src).toContain('normalizeCrop(data.primaryCrop)');
  });

  it('FarmProfiles service has normalizeCrop function', () => {
    const src = farmProfileService();
    expect(src).toContain('export function normalizeCrop');
  });

  it('Farmers service computes farmSizeAcres from hectares (fromHectares)', () => {
    const src = farmerService();
    expect(src).toContain('fromHectares');
    expect(src).toContain("fromHectares(ls.landSizeHectares, 'ACRE')");
  });

  it('Farmers service checkDuplicateFarmer accepts email parameter', () => {
    const src = farmerService();
    expect(src).toContain('export async function checkDuplicateFarmer');
    // The function signature destructures email
    expect(src).toContain('phone, fullName, region, organizationId, email');
  });
});

// ─── 5. Officer Queue ───────────────────────────────────────

describe('Officer Queue', () => {
  const queue = () => readFile('src/pages/VerificationQueuePage.jsx');

  it('VerificationQueuePage has urgencyFilter state', () => {
    const src = queue();
    expect(src).toContain('urgencyFilter');
    expect(src).toContain("setUrgencyFilter");
    expect(src).toContain("useState('all')");
  });

  it('VerificationQueuePage has filteredApps logic', () => {
    const src = queue();
    expect(src).toContain('filteredApps');
    expect(src).toContain("urgencyFilter === 'all'");
    expect(src).toContain("urgencyFilter === 'urgent'");
  });

  it('VerificationQueuePage has quick approve for high-score applications', () => {
    const src = queue();
    expect(src).toContain('quickApprove');
    expect(src).toContain('score >= 70');
  });
});

// ─── 6. Reporting Consistency ───────────────────────────────

describe('Reporting Consistency', () => {
  const pilotMetrics = () => readFile('server/src/modules/pilotMetrics/service.js');
  const reports = () => readFile('server/src/modules/reports/service.js');
  const dashboard = () => readFile('src/pages/DashboardPage.jsx');

  it('PilotMetrics service computes womenFarmers count', () => {
    const src = pilotMetrics();
    expect(src).toContain('womenFarmers');
  });

  it('PilotMetrics service computes youthFarmers count', () => {
    const src = pilotMetrics();
    expect(src).toContain('youthFarmers');
  });

  it('Reports service uses $queryRaw (not $queryRawUnsafe)', () => {
    const src = reports();
    expect(src).toContain('$queryRaw');
    expect(src).not.toContain('$queryRawUnsafe');
  });

  it('DashboardPage shows women/youth metrics', () => {
    const src = dashboard();
    expect(src).toContain('womenFarmers');
    expect(src).toContain('youthFarmers');
    expect(src).toContain('Women');
    expect(src).toContain('Youth');
  });
});

// ─── 7. Empty States ────────────────────────────────────────

describe('Empty States', () => {
  const pending = () => readFile('src/pages/PendingRegistrationsPage.jsx');
  const adminUsers = () => readFile('src/pages/AdminUsersPage.jsx');

  it('PendingRegistrationsPage imports EmptyState component', () => {
    const src = pending();
    expect(src).toContain("import EmptyState from '../components/EmptyState.jsx'");
    expect(src).toContain('<EmptyState');
  });

  it('AdminUsersPage has Clear filters action on EmptyState', () => {
    const src = adminUsers();
    expect(src).toContain("import EmptyState from '../components/EmptyState.jsx'");
    expect(src).toContain("'Clear filters'");
    expect(src).toContain('<EmptyState');
  });
});

// ─── 8. No Regression ───────────────────────────────────────

describe('No Regression', () => {
  const schema = () => readFile('server/prisma/schema.prisma');
  const farmerRoutes = () => readFile('server/src/modules/farmers/routes.js');

  it('Schema still has inviteResendMeta field on Farmer', () => {
    const s = schema();
    expect(s).toContain('inviteResendMeta');
    expect(s).toContain('invite_resend_meta');
  });

  it('Farmer registration routes still exist at /farmers/ paths', () => {
    const src = farmerRoutes();
    expect(src).toContain('/pending-registrations');
    expect(src).toContain('/approve-registration');
    expect(src).toContain("Router()");
  });
});

// ─── 9. Remaining Limitations — Final Pass ─────────────────

describe('CSV Export', () => {
  const reportService = () => readFile('server/src/modules/reports/service.js');
  const reportRoutes = () => readFile('server/src/modules/reports/routes.js');
  const dashboard = () => readFile('src/pages/DashboardPage.jsx');

  it('Reports service has getPilotReportCSV function', () => {
    const src = reportService();
    expect(src).toContain('export async function getPilotReportCSV');
    expect(src).toContain('escCSV');
    expect(src).toContain("header.join(',')");
  });

  it('Reports routes expose /pilot-report with CSV format and proper org scope', () => {
    const src = reportRoutes();
    expect(src).toContain('/pilot-report');
    expect(src).toContain("format === 'csv'");
    expect(src).toContain('text/csv');
    expect(src).toContain('Content-Disposition');
    expect(src).toContain('orgWhereFarmer');
  });

  it('DashboardPage has Export CSV button (no longer hidden TODO)', () => {
    const src = dashboard();
    expect(src).toContain('Export CSV');
    expect(src).toContain("'/reports/pilot-report?format=csv'");
    expect(src).not.toContain('TODO: CSV export endpoint');
  });
});

describe('Sync Now Button', () => {
  const syncStatus = () => readFile('src/components/SyncStatus.jsx');

  it('SyncStatus imports syncAll and api', () => {
    const src = syncStatus();
    expect(src).toContain("syncAll");
    expect(src).toContain("import api from '../api/client.js'");
  });

  it('SyncStatus has Sync Now button when online with pending', () => {
    const src = syncStatus();
    expect(src).toContain("t('sync.syncNow')");
    expect(src).toContain('syncNowBtn');
    expect(src).toContain('syncAll(api)');
  });

  it('SyncStatus pendingBanner has pointerEvents auto for clickability', () => {
    const src = syncStatus();
    expect(src).toContain("pointerEvents: 'auto'");
  });
});

describe('Invite Cancellation', () => {
  const farmerRoutes = () => readFile('server/src/modules/farmers/routes.js');

  it('Farmers routes have cancel-invite endpoint', () => {
    const src = farmerRoutes();
    expect(src).toContain('/cancel-invite');
    expect(src).toContain('invite_cancelled');
    expect(src).toContain("inviteDeliveryStatus: 'cancelled'");
  });

  it('Cancel-invite validates farmer has no login account', () => {
    const src = farmerRoutes();
    expect(src).toContain('Cannot cancel invite — farmer already has a login account');
  });

  it('Cancel-invite validates active invite exists', () => {
    const src = farmerRoutes();
    expect(src).toContain('No active invite to cancel');
  });

  it('FarmerDetailPage has Cancel Invite UI with confirmation', () => {
    const src = readFile('src/pages/FarmerDetailPage.jsx');
    expect(src).toContain('handleCancelInvite');
    expect(src).toContain('showCancelInviteConfirm');
    expect(src).toContain('cancel-invite');
    expect(src).toContain('Revoke link?');
  });
});

describe('Batch Resend Invites', () => {
  const farmerRoutes = () => readFile('server/src/modules/farmers/routes.js');
  const farmersPage = () => readFile('src/pages/FarmersPage.jsx');

  it('Farmers routes have batch-resend-invites endpoint', () => {
    const src = farmerRoutes();
    expect(src).toContain('/batch-resend-invites');
    expect(src).toContain('batch_invite_resend');
    expect(src).toContain('Maximum 50 farmers per batch');
  });

  it('Batch resend checks rate limits per farmer', () => {
    const src = farmerRoutes();
    expect(src).toContain('rate_limited');
  });

  it('FarmersPage has batch resend UI for pending invites', () => {
    const src = farmersPage();
    expect(src).toContain('batchResending');
    expect(src).toContain('Resend All Invites');
    expect(src).toContain("'/farmers/batch-resend-invites'");
  });
});

describe('Profile Photo in Onboarding', () => {
  const dashboard = () => readFile('src/pages/FarmerDashboardPage.jsx');
  const wizard = () => readFile('src/components/OnboardingWizard.jsx');

  it('FarmerDashboardPage uploads photo after onboarding', () => {
    const src = dashboard();
    expect(src).toContain("formData.append('photo', photoFile)");
    expect(src).toContain("/farmers/me/profile-photo");
    expect(src).toContain("photo_uploaded");
  });

  it('OnboardingWizard passes photoFile through onComplete', () => {
    const src = wizard();
    expect(src).toContain('photoFile: photoFile || null');
    expect(src).toContain('handlePhotoSelect');
  });
});

describe('Demographics in Portfolio', () => {
  const portfolioService = () => readFile('server/src/modules/portfolio/service.js');
  const portfolioPage = () => readFile('src/pages/PortfolioPage.jsx');
  const reportService = () => readFile('server/src/modules/reports/service.js');

  it('Portfolio service returns demographics', () => {
    const src = portfolioService();
    expect(src).toContain('womenFarmers');
    expect(src).toContain('youthFarmers');
    expect(src).toContain('womenPercent');
    expect(src).toContain('youthPercent');
  });

  it('PortfolioPage displays demographics section', () => {
    const src = portfolioPage();
    expect(src).toContain('Demographics');
    expect(src).toContain('data.demographics');
    expect(src).toContain('womenPercent');
    expect(src).toContain('Youth (<35)');
  });

  it('Reports service getPortfolioReport includes demographics', () => {
    const src = reportService();
    expect(src).toContain('demographics');
    expect(src).toContain('genderBreakdown');
  });
});

describe('farmSizeAcres Legacy Field', () => {
  const schema = () => readFile('server/prisma/schema.prisma');
  const farmerService = () => readFile('server/src/modules/farmers/service.js');

  it('Schema marks farmSizeAcres as LEGACY with documentation', () => {
    const src = schema();
    expect(src).toContain('LEGACY: auto-computed from landSizeHectares');
  });

  it('Farmer service always computes farmSizeAcres from hectares', () => {
    const src = farmerService();
    expect(src).toContain('fromHectares(ls.landSizeHectares');
    // Verify both create and update paths
    const matches = src.match(/fromHectares/g);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── 10. Reinforcement Rule Audit Fixes ─────────────────

describe('Rule 1: Activation Reliability', () => {
  it('OnboardingWizard success state has Continue button (not stuck)', () => {
    const src = readFile('src/components/OnboardingWizard.jsx');
    expect(src).toContain("t('wizard.continueToDashboard')");
    expect(src).toContain('window.location.reload()');
    // Must not show checkmark forever without action
    expect(src).toContain("submitSuccess && (");
  });
});

describe('Rule 3: Invite Trust - Honest & Recoverable', () => {
  it('AcceptInvitePage handles network errors distinctly from invalid', () => {
    const src = readFile('src/pages/AcceptInvitePage.jsx');
    expect(src).toContain("'network_error'");
    expect(src).toContain("t('invite.connectionProblem')");
    expect(src).toContain("t('common.retry')");
    expect(src).not.toContain("// network errors show as invalid"); // old pattern removed
  });

  it('Invite status endpoint returns resend count for proactive display', () => {
    const src = readFile('server/src/modules/farmers/routes.js');
    expect(src).toContain('resendCount24h');
    expect(src).toContain('resendLimit');
    expect(src).toContain('inviteResendMeta: true');
  });
});

describe('Rule 4: Lightweight Data Quality Safeguards', () => {
  it('farmProfiles createFarmProfile validates coordinate ranges', () => {
    const src = readFile('server/src/modules/farmProfiles/service.js');
    expect(src).toContain('Latitude must be between -90 and 90');
    expect(src).toContain('Longitude must be between -180 and 180');
    expect(src).toContain('Both latitude and longitude are required');
  });

  it('farmProfiles updateFarmProfile validates coordinate pairs', () => {
    const src = readFile('server/src/modules/farmProfiles/service.js');
    expect(src).toContain('Both latitude and longitude are required when updating');
  });
});

describe('Rule 5: Internal Data Consistency', () => {
  const registration = () => readFile('server/src/modules/auth/farmer-registration.js');
  const appService = () => readFile('server/src/modules/applications/service.js');
  const seasonService = () => readFile('server/src/modules/seasons/service.js');

  it('farmerSelfRegister normalizes crop codes', () => {
    const src = registration();
    expect(src).toContain("import { normalizeCrop }");
    expect(src).toContain('normalizedPrimaryCrop');
    expect(src).toContain("normalizeCrop(cropTrimmed)");
  });

  it('inviteFarmer computes all land size fields', () => {
    const src = registration();
    // Must have landSizeValue, landSizeUnit, landSizeHectares — not just farmSizeAcres
    expect(src).toContain('landSizeValue: ls.landSizeValue');
    expect(src).toContain('landSizeUnit: ls.landSizeUnit');
    expect(src).toContain('landSizeHectares: ls.landSizeHectares');
  });

  it('inviteFarmer normalizes crop codes', () => {
    const src = registration();
    expect(src).toContain('normalizedCrop');
    expect(src).toContain("primaryCrop: normalizedCrop");
  });

  it('createApplication normalizes crop codes', () => {
    const src = appService();
    expect(src).toContain("normalizeCrop(data.cropType)");
  });

  it('updateApplication normalizes crop codes', () => {
    const src = appService();
    expect(src).toContain("normalizeCrop(data.cropType)");
  });

  it('createSeason normalizes crop codes', () => {
    const src = seasonService();
    expect(src).toContain("import { normalizeCrop }");
    expect(src).toContain("normalizeCrop(data.cropType)");
  });
});
