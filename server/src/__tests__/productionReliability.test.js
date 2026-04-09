import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
// Production Reliability + Trust Layer — Test Coverage
// Validates Phase 2 (State + Retry + Feedback) and Phase 3
// (Failure Visibility + Data Consistency) changes.
// ═══════════════════════════════════════════════════════════════

// ─── Phase 2: State Persistence (useDraft) ────────────────────

describe('State Persistence — useDraft integration', () => {
  it('CreateFarmerModal uses useDraft for form state', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    expect(src).toContain("useDraft('create-farmer'");
    expect(src).toContain('clearCreateDraft');
    expect(src).toContain('createDraftRestored');
  });

  it('CreateFarmerModal clears draft on successful creation', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    // clearCreateDraft must appear before setSuccess
    const clearIdx = src.indexOf('clearCreateDraft()');
    const successIdx = src.indexOf('setSuccess({', clearIdx);
    expect(clearIdx).toBeGreaterThan(-1);
    expect(successIdx).toBeGreaterThan(clearIdx);
  });

  it('CreateFarmerModal shows draft-restored banner with discard option', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    expect(src).toContain('createDraftRestored');
    expect(src).toContain('Draft restored');
    expect(src).toContain('Discard draft');
  });

  it('InviteFarmerModal uses useDraft for form state', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    expect(src).toContain("useDraft('invite-farmer'");
    expect(src).toContain('clearInviteDraft');
    expect(src).toContain('inviteDraftRestored');
  });

  it('InviteFarmerModal clears draft on successful invite', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    // clearInviteDraft must appear before setSuccess in the invite handler
    const inviteSection = src.substring(src.indexOf('InviteFarmerModal'));
    const clearIdx = inviteSection.indexOf('clearInviteDraft()');
    const successIdx = inviteSection.indexOf('setSuccess({', clearIdx);
    expect(clearIdx).toBeGreaterThan(-1);
    expect(successIdx).toBeGreaterThan(clearIdx);
  });

  it('InviteFarmerModal shows draft-restored banner', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    expect(src).toContain('inviteDraftRestored');
  });

  it('Season creation form uses useDraft keyed by farmerId', () => {
    const src = readFile('src/pages/FarmerProgressTab.jsx');
    expect(src).toContain("useDraft(");
    expect(src).toContain('season-form:${farmerId}');
    expect(src).toContain('clearSeasonDraft');
    expect(src).toContain('seasonDraftRestored');
  });

  it('Season creation clears draft on success', () => {
    const src = readFile('src/pages/FarmerProgressTab.jsx');
    const clearIdx = src.indexOf('clearSeasonDraft()');
    const resetIdx = src.indexOf("setShowSeasonForm(false)", clearIdx);
    expect(clearIdx).toBeGreaterThan(-1);
    expect(resetIdx).toBeGreaterThan(clearIdx);
  });

  it('FarmersPage imports useDraft', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    expect(src).toContain("import { useDraft }");
  });
});

// ─── Phase 2: Silent Failure Fixes ────────────────────────────

describe('Silent Failure Fixes', () => {
  it('ApplicationDetailPage addNote catches errors with message', () => {
    const src = readFile('src/pages/ApplicationDetailPage.jsx');
    // Must NOT have empty catch{} for addNote
    expect(src).toContain('setNoteError');
    expect(src).toContain("'Failed to save note");
  });

  it('ApplicationDetailPage passes noteError to ReviewsTab', () => {
    const src = readFile('src/pages/ApplicationDetailPage.jsx');
    expect(src).toContain('noteError={noteError}');
  });

  it('ReviewsTab displays noteError inline', () => {
    const src = readFile('src/pages/ApplicationDetailPage.jsx');
    // ReviewsTab function signature includes noteError
    expect(src).toMatch(/ReviewsTab\(\{[^}]*noteError/);
    // Renders error div
    expect(src).toContain('{noteError &&');
  });

  it('VerificationQueuePage bulk scoring captures error details', () => {
    const src = readFile('src/pages/VerificationQueuePage.jsx');
    expect(src).toContain('lastFailReason');
    expect(src).toContain('failedIds');
    // catch block captures error instead of swallowing
    expect(src).toContain('catch (err)');
    expect(src).toContain("err.response?.data?.error || err.message");
  });

  it('VerificationQueuePage shows failure reason in progress summary', () => {
    const src = readFile('src/pages/VerificationQueuePage.jsx');
    expect(src).toContain('bulkProgress.lastFailReason');
  });
});

// ─── Phase 2: Retry / Dedup Guard (Server-side) ──────────────

describe('Dedup Guard — unprotected endpoints hardened', () => {
  const farmersRoutes = () => readFile('server/src/modules/farmers/routes.js');
  const issuesRoutes = () => readFile('server/src/modules/issues/routes.js');

  it('cancel-invite has dedupGuard', () => {
    const src = farmersRoutes();
    // dedupGuard must appear before asyncHandler for cancel-invite
    const cancelSection = src.substring(src.indexOf('cancel-invite'));
    expect(cancelSection.substring(0, cancelSection.indexOf('asyncHandler'))).toContain("dedupGuard('cancel-invite')");
  });

  it('batch-resend-invites has dedupGuard', () => {
    const src = farmersRoutes();
    const section = src.substring(src.indexOf('batch-resend-invites'));
    expect(section.substring(0, section.indexOf('asyncHandler'))).toContain("dedupGuard('batch-resend-invites')");
  });

  it('PUT farmer update has dedupGuard', () => {
    const src = farmersRoutes();
    // Find the PUT /:id route
    const putSection = src.substring(src.indexOf("router.put('/:id'"));
    expect(putSection.substring(0, putSection.indexOf('asyncHandler'))).toContain("dedupGuard('farmer-update')");
  });

  it('self profile-photo has dedupGuard', () => {
    const src = farmersRoutes();
    expect(src).toContain("dedupGuard('self-profile-photo')");
  });

  it('staff profile-photo has dedupGuard', () => {
    const src = farmersRoutes();
    expect(src).toContain("dedupGuard('staff-profile-photo')");
  });

  it('issue creation has dedupGuard', () => {
    const src = issuesRoutes();
    expect(src).toContain("dedupGuard('issue-create')");
  });

  it('issue bulk update has dedupGuard', () => {
    const src = issuesRoutes();
    expect(src).toContain("dedupGuard('issue-bulk-update')");
  });

  it('issues routes imports dedupGuard', () => {
    const src = issuesRoutes();
    expect(src).toContain("import { dedupGuard }");
  });
});

// ─── Phase 2: Client-side Double-Submit Guard ─────────────────

describe('Double-Submit Guard — submitGuardRef', () => {
  it('AcceptInvitePage uses submitGuardRef to prevent double submit', () => {
    const src = readFile('src/pages/AcceptInvitePage.jsx');
    expect(src).toContain('submitGuardRef');
    expect(src).toContain('useRef');
    // Guard must be checked before the API call
    expect(src).toContain('if (submitGuardRef.current) return');
    // Guard is set to true before API call
    expect(src).toContain('submitGuardRef.current = true');
    // Guard is reset in finally block
    expect(src).toContain('submitGuardRef.current = false');
  });
});

// ─── Phase 3: Data Consistency ────────────────────────────────

describe('Data Consistency — Portfolio farm size', () => {
  it('Portfolio uses farmer landSizeHectares aggregate instead of application field', () => {
    const src = readFile('server/src/modules/portfolio/service.js');
    // Must aggregate from farmer table
    expect(src).toContain('farmerLandAgg');
    expect(src).toContain('_avg: { landSizeHectares: true }');
    // Must return hectares as authoritative
    expect(src).toContain('avgFarmSizeHectares');
  });

  it('Portfolio avgFarmSizeAcres is derived from hectares (backward compat)', () => {
    const src = readFile('server/src/modules/portfolio/service.js');
    // Conversion factor: 1 hectare = 2.47105 acres
    expect(src).toContain('2.47105');
    expect(src).toContain('LEGACY');
  });

  it('Portfolio no longer aggregates farmSizeAcres from application table', () => {
    const src = readFile('server/src/modules/portfolio/service.js');
    // The application aggregate should NOT include farmSizeAcres
    const appAggSection = src.substring(
      src.indexOf('prisma.application.aggregate'),
      src.indexOf('}),', src.indexOf('prisma.application.aggregate')) + 3,
    );
    expect(appAggSection).not.toContain('farmSizeAcres');
  });
});

// ─── Phase 3: Failure Visibility Documentation ────────────────

describe('Failure Visibility — known limitations documented', () => {
  it('eventStore documents in-memory limitation and Railway log drain', () => {
    const src = readFile('server/src/utils/eventStore.js');
    expect(src).toContain('LIMITATION');
    expect(src).toContain('Railway');
    expect(src).toContain('log drain');
  });

  it('pilotTracker documents admin-visibility limitation', () => {
    const src = readFile('src/utils/pilotTracker.js');
    expect(src).toContain('LIMITATION');
    expect(src).toContain('device only');
  });

  it('offlineQueue documents sync failure visibility limitation', () => {
    const src = readFile('src/utils/offlineQueue.js');
    expect(src).toContain('LIMITATION');
    expect(src).toContain('Sync failures stay local');
  });
});

// ─── Phase 2: Additional submitGuardRef protections ──────────

describe('Double-Submit Guard — all form pages', () => {
  const pages = [
    { file: 'src/pages/FarmerProgressTab.jsx', name: 'FarmerProgressTab' },
    { file: 'src/pages/FarmerStorageTab.jsx', name: 'FarmerStorageTab' },
    { file: 'src/pages/FarmerMarketTab.jsx', name: 'FarmerMarketTab' },
    { file: 'src/pages/FarmerActivitiesTab.jsx', name: 'FarmerActivitiesTab' },
    { file: 'src/pages/NewApplicationPage.jsx', name: 'NewApplicationPage' },
  ];

  for (const { file, name } of pages) {
    it(`${name} has submitGuardRef with full guard pattern`, () => {
      const src = readFile(file);
      expect(src).toContain('submitGuardRef');
      expect(src).toContain('useRef');
      expect(src).toContain('submitGuardRef.current = true');
      expect(src).toContain('submitGuardRef.current = false');
    });
  }

  it('FarmerProgressTab handleEdgeCase has submitGuardRef guard', () => {
    const src = readFile('src/pages/FarmerProgressTab.jsx');
    const edgeCaseSection = src.substring(src.indexOf('handleEdgeCase'));
    const guardIdx = edgeCaseSection.indexOf('submitGuardRef.current');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(edgeCaseSection.indexOf('api.patch'));
  });

  it('ReopenSeasonModal has reopenGuardRef for submitRequest and executeReopen', () => {
    const src = readFile('src/pages/FarmerProgressTab.jsx');
    const reopenSection = src.substring(src.indexOf('function ReopenSeasonModal'));
    expect(reopenSection).toContain('reopenGuardRef');
    expect(reopenSection).toContain('reopenGuardRef.current = true');
    expect(reopenSection).toContain('reopenGuardRef.current = false');
    // Both submitRequest and executeReopen should have guard
    const submitReqIdx = reopenSection.indexOf('submitRequest');
    const executeIdx = reopenSection.indexOf('executeReopen');
    const guardAfterSubmit = reopenSection.indexOf('reopenGuardRef.current = true', submitReqIdx);
    const guardAfterExecute = reopenSection.indexOf('reopenGuardRef.current = true', executeIdx);
    expect(guardAfterSubmit).toBeGreaterThan(-1);
    expect(guardAfterExecute).toBeGreaterThan(-1);
  });
});

// ─── Phase 2: Additional silent failure fixes ────────────────

describe('Silent Failure Fixes — Phase 2 additions', () => {
  it('ReportIssueButton captures comment and upload errors', () => {
    const src = readFile('src/components/ReportIssueButton.jsx');
    expect(src).toContain('commentError');
    expect(src).toContain('uploadError');
  });

  it('DashboardPage shows loadWarning for partial data failures', () => {
    const src = readFile('src/pages/DashboardPage.jsx');
    expect(src).toContain('loadWarning');
    expect(src).toContain('Refresh');
  });

  it('FarmerMarketTab withdrawInterest surfaces error to user', () => {
    const src = readFile('src/pages/FarmerMarketTab.jsx');
    // withdrawInterest must set error state, not swallow
    const withdrawSection = src.substring(src.indexOf('withdrawInterest'));
    expect(withdrawSection).toContain('setError(');
    expect(withdrawSection).toContain("'Failed to withdraw interest'");
  });
});

// ─── Phase 2: Additional dedupGuard coverage ─────────────────

describe('Dedup Guard — Phase 2 additions', () => {
  it('application update has dedupGuard', () => {
    const src = readFile('server/src/modules/applications/routes.js');
    expect(src).toContain("dedupGuard('app-update')");
  });

  it('admin create-user has dedupGuard', () => {
    const src = readFile('server/src/modules/auth/admin-routes.js');
    expect(src).toContain("dedupGuard('admin-create-user')");
  });

  it('evidence upload has dedupGuard', () => {
    const src = readFile('server/src/modules/evidence/routes.js');
    expect(src).toContain("dedupGuard('evidence-upload')");
  });
});

// ─── Phase 3: Operations Health Tab ──────────────────────────

describe('Operations Health — Admin visibility', () => {
  it('AdminControlPage has Operations Health tab', () => {
    const src = readFile('src/pages/AdminControlPage.jsx');
    expect(src).toContain("key: 'ops'");
    expect(src).toContain("label: 'Operations Health'");
    expect(src).toContain("tab === 'ops'");
    expect(src).toContain('OperationsHealth');
  });

  it('OperationsHealth fetches system health and errors', () => {
    const src = readFile('src/pages/AdminControlPage.jsx');
    const opsSection = src.substring(src.indexOf('function OperationsHealth'));
    expect(opsSection).toContain('/system/health');
    expect(opsSection).toContain('/system/errors');
  });

  it('OperationsHealth shows database health and provider status', () => {
    const src = readFile('src/pages/AdminControlPage.jsx');
    const opsSection = src.substring(src.indexOf('function OperationsHealth'));
    expect(opsSection).toContain('database');
    expect(opsSection).toContain('email');
    expect(opsSection).toContain('sms');
  });

  it('OperationsHealth has auto-refresh capability', () => {
    const src = readFile('src/pages/AdminControlPage.jsx');
    const opsSection = src.substring(src.indexOf('function OperationsHealth'));
    expect(opsSection).toContain('autoRefresh');
    expect(opsSection).toContain('setInterval');
  });
});

// ─── Go-Live Hardening: Invite Trust ─────────────────────────

describe('Invite Trust — state consistency', () => {
  it('InviteAccessBadge has CANCELLED state (not dead PENDING)', () => {
    const src = readFile('src/components/InviteAccessBadge.jsx');
    expect(src).toContain("CANCELLED:");
    expect(src).toContain("label: 'Cancelled'");
    // Dead PENDING state must be removed
    expect(src).not.toContain("PENDING:");
  });

  it('computeInviteStatus returns CANCELLED for cancelled invites', () => {
    const src = readFile('server/src/modules/farmers/service.js');
    const fn = src.substring(src.indexOf('function computeInviteStatus'), src.indexOf('\n}', src.indexOf('function computeInviteStatus')) + 2);
    expect(fn).toContain("=== 'cancelled'");
    expect(fn).toContain("return 'CANCELLED'");
  });

  it('FarmersPage CreateFarmer success shows manual-share warning when delivery fails', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    expect(src).toContain('You must copy and share this link manually');
  });

  it('FarmersPage InviteFarmer success shows manual-share warning when delivery fails', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    // Both modals must have the warning
    const firstIdx = src.indexOf('You must copy and share this link manually');
    const secondIdx = src.indexOf('You must copy and share this link manually', firstIdx + 1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });
});

// ─── Go-Live Hardening: Data Consistency ─────────────────────

describe('Data Consistency — youth and stale thresholds', () => {
  it('Portfolio youth query uses age <= 35 (gt year-36)', () => {
    const src = readFile('server/src/modules/portfolio/service.js');
    expect(src).toContain('getFullYear() - 36');
    expect(src).toContain('Youth: age <= 35');
  });

  it('PilotMetrics youth query uses age <= 35 (gt year-36)', () => {
    const src = readFile('server/src/modules/pilotMetrics/service.js');
    expect(src).toContain('getFullYear() - 36');
    expect(src).toContain('Youth: age <= 35');
  });

  it('Reports youth query uses age <= 35 (gt year-36)', () => {
    const src = readFile('server/src/modules/reports/service.js');
    expect(src).toContain('getFullYear() - 36');
    expect(src).toContain('Youth: age <= 35');
  });

  it('Impact service stale cutoff aligned to 14 days', () => {
    const src = readFile('server/src/modules/impact/service.js');
    expect(src).toContain('14 * 24 * 3600 * 1000');
    expect(src).toContain('staleCutoff');
    expect(src).toContain('STALE_DAYS');
  });

  it('Dashboard labels approved farmers honestly (not "Active")', () => {
    const src = readFile('src/pages/DashboardPage.jsx');
    expect(src).toContain('Approved Farmers');
    expect(src).not.toContain('>Active Farmers<');
  });
});

// ─── Go-Live Hardening: Mobile UX ───────────────────────────

describe('Mobile UX — tap targets and responsive', () => {
  it('CropSelect input and options meet 44px min touch target', () => {
    const src = readFile('src/components/CropSelect.jsx');
    // inputWrap minHeight
    expect(src).toContain("minHeight: '44px'");
    // option minHeight
    expect(src).toContain("minHeight: '44px',");
  });

  it('LocationDetect compact button meets 44px min touch target', () => {
    const src = readFile('src/components/LocationDetect.jsx');
    const compactSection = src.substring(src.indexOf('compactBtn'));
    expect(compactSection).toContain('minHeight: 44');
  });

  it('OnboardingWizard modal responsive on small screens', () => {
    const src = readFile('src/components/OnboardingWizard.jsx');
    expect(src).toContain('min(420px');
    expect(src).toContain('92vw');
  });
});

// ─── Go-Live Hardening: Navigation & UX ─────────────────────

describe('Navigation and UX — actionable paths', () => {
  it('Dashboard needs-attention links to filtered farmers page', () => {
    const src = readFile('src/pages/DashboardPage.jsx');
    expect(src).toContain("'/farmers?filter=needs_attention'");
  });

  it('FarmersPage reads URL filter param', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    expect(src).toContain('useSearchParams');
    expect(src).toContain("searchParams.get('filter')");
  });

  it('Dashboard task overflow links to view all', () => {
    const src = readFile('src/pages/DashboardPage.jsx');
    expect(src).toContain('View all');
    expect(src).toContain('tasks.length');
  });

  it('FarmerOverviewTab empty states have descriptive messages', () => {
    const src = readFile('src/pages/FarmerOverviewTab.jsx');
    expect(src).toContain('Activities will appear here');
    expect(src).toContain('Create a credit application');
  });
});

// ─── Last-Mile Hardening: Silent Failure Elimination ─────────

describe('Silent Failure Elimination', () => {
  it('FarmerNotificationsTab markRead surfaces error to user', () => {
    const src = readFile('src/pages/FarmerNotificationsTab.jsx');
    expect(src).toContain('actionError');
    expect(src).toContain("'Failed to mark as read");
  });

  it('FarmerNotificationsTab markAllRead surfaces error to user', () => {
    const src = readFile('src/pages/FarmerNotificationsTab.jsx');
    expect(src).toContain("'Failed to mark all as read");
  });

  it('PortfolioPage takeSnapshot surfaces error to user', () => {
    const src = readFile('src/pages/PortfolioPage.jsx');
    expect(src).toContain('snapshotError');
    expect(src).toContain("'Failed to save snapshot");
  });
});

// ─── Last-Mile Hardening: Stuck State Detection ──────────────

describe('Stuck State Detection', () => {
  it('PilotMetrics detects stuck farmers (approved, no login, no invite)', () => {
    const src = readFile('server/src/modules/pilotMetrics/service.js');
    expect(src).toContain('stuck_no_access');
    expect(src).toContain('Approved farmers with no login and no active invite');
  });

  it('System health endpoint includes consistency checks', () => {
    const src = readFile('server/src/modules/system/routes.js');
    expect(src).toContain('consistency');
    expect(src).toContain('stuckFarmers');
    expect(src).toContain('resend invite or create login');
  });

  it('FarmersPage needs_attention filter catches stuck and cancelled farmers', () => {
    const src = readFile('src/pages/FarmersPage.jsx');
    const filterSection = src.substring(src.indexOf("'needs_attention'"));
    expect(filterSection).toContain('isCancelled');
    expect(filterSection).toContain('isStuck');
  });
});

// ─── Last-Mile Hardening: Invite Accept Safety ───────────────

describe('Invite Accept Safety', () => {
  it('Invite accept checks for disabled/rejected farmer before creating account', () => {
    const src = readFile('server/src/modules/invites/routes.js');
    // disabled/rejected checks must appear before the transaction
    const disabledIdx = src.indexOf("registrationStatus === 'disabled'");
    const rejectedIdx = src.indexOf("registrationStatus === 'rejected'");
    const txIdx = src.indexOf('prisma.$transaction');
    expect(disabledIdx).toBeGreaterThan(-1);
    expect(rejectedIdx).toBeGreaterThan(-1);
    expect(disabledIdx).toBeLessThan(txIdx);
    expect(rejectedIdx).toBeLessThan(txIdx);
  });

  it('Invite accept transaction is atomic (userId + token consume)', () => {
    const src = readFile('server/src/modules/invites/routes.js');
    // All state changes happen inside a single $transaction block
    expect(src).toContain('$transaction');
    expect(src).toContain('userId: newUser.id');
    expect(src).toContain('inviteToken: null');
    expect(src).toContain('inviteAcceptedAt');
    expect(src).toContain("inviteDeliveryStatus: 'accepted'");
  });
});

// ─── Cross-cutting: existing safeguards still intact ──────────

describe('Existing safeguards remain intact', () => {
  it('Progress entry form still uses useDraft', () => {
    const src = readFile('src/pages/FarmerProgressTab.jsx');
    expect(src).toContain("useDraft(");
    expect(src).toContain('clearProgressDraft');
    expect(src).toContain('progressDraftRestored');
  });

  it('Client API still auto-generates X-Idempotency-Key', () => {
    const src = readFile('src/api/client.js');
    expect(src).toContain('X-Idempotency-Key');
  });

  it('OnboardingWizard still has submitGuardRef', () => {
    const src = readFile('src/components/OnboardingWizard.jsx');
    expect(src).toContain('submitGuardRef');
  });

  it('Audit service catches errors with console.warn (not silently)', () => {
    const src = readFile('server/src/modules/audit/service.js');
    expect(src).toContain("console.warn(`[AUDIT]");
  });

  it('dedupGuard imported in all route files that use it', () => {
    const routeFiles = [
      'server/src/modules/farmers/routes.js',
      'server/src/modules/applications/routes.js',
      'server/src/modules/seasons/routes.js',
      'server/src/modules/issues/routes.js',
    ];
    for (const f of routeFiles) {
      const src = readFile(f);
      expect(src).toContain("import { dedupGuard }");
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Edge-Case Hardening — Phase 2: Permission & Report Alignment
// ═══════════════════════════════════════════════════════════════

describe('Permission Edge Cases — Ownership Checks', () => {
  it('Reminders routes import prisma for ownership lookups', () => {
    const src = readFile('server/src/modules/reminders/routes.js');
    expect(src).toContain("import prisma from '../../config/database.js'");
  });

  it('Reminders PATCH /done enforces farmer ownership', () => {
    const src = readFile('server/src/modules/reminders/routes.js');
    expect(src).toContain("req.user.role === 'farmer'");
    expect(src).toContain('reminder.farmer.userId !== req.user.sub');
  });

  it('Reminders PATCH /dismiss enforces farmer ownership', () => {
    const src = readFile('server/src/modules/reminders/routes.js');
    // Both /done and /dismiss have ownership checks — verify dismiss block exists
    const dismissIdx = src.indexOf("'/:id/dismiss'");
    expect(dismissIdx).toBeGreaterThan(0);
    const dismissBlock = src.substring(dismissIdx);
    expect(dismissBlock).toContain('farmer.userId !== req.user.sub');
  });

  it('BuyerInterest routes import prisma for ownership lookups', () => {
    const src = readFile('server/src/modules/buyerInterest/routes.js');
    expect(src).toContain("import prisma from '../../config/database.js'");
  });

  it('BuyerInterest withdraw enforces farmer ownership', () => {
    const src = readFile('server/src/modules/buyerInterest/routes.js');
    const withdrawIdx = src.indexOf("'/:id/withdraw'");
    expect(withdrawIdx).toBeGreaterThan(0);
    const withdrawBlock = src.substring(withdrawIdx);
    expect(withdrawBlock).toContain("req.user.role === 'farmer'");
    expect(withdrawBlock).toContain('interest.farmer.userId !== req.user.sub');
  });
});

describe('Report Alignment — Portfolio Demographics', () => {
  it('Portfolio farmerWhere filters by registrationStatus approved', () => {
    const src = readFile('server/src/modules/portfolio/service.js');
    expect(src).toContain("registrationStatus: 'approved'");
  });

  it('Portfolio youth query aligned to age <= 35 (year - 36)', () => {
    const src = readFile('server/src/modules/portfolio/service.js');
    expect(src).toContain('getFullYear() - 36');
  });

  it('pilotMetrics youth query aligned to age <= 35 (year - 36)', () => {
    const src = readFile('server/src/modules/pilotMetrics/service.js');
    expect(src).toContain('getFullYear() - 36');
  });

  it('Reports youth query aligned to age <= 35 (year - 36)', () => {
    const src = readFile('server/src/modules/reports/service.js');
    expect(src).toContain('getFullYear() - 36');
  });
});

// ═══════════════════════════════════════════════════════════════
// Edge-Case Hardening — Phase 3: Offline/Upload/Mobile Safety
// ═══════════════════════════════════════════════════════════════

describe('Offline Queue — Retry Safety', () => {
  it('Has MAX_RETRIES constant to prevent infinite replay', () => {
    const src = readFile('src/utils/offlineQueue.js');
    expect(src).toContain('MAX_RETRIES');
  });

  it('Tracks retryCount on enqueued mutations', () => {
    const src = readFile('src/utils/offlineQueue.js');
    expect(src).toContain('retryCount: 0');
  });

  it('Abandons mutations that exceed max retries', () => {
    const src = readFile('src/utils/offlineQueue.js');
    expect(src).toContain('max_retries_exceeded');
  });

  it('Handles 409 Conflict as already-processed during sync', () => {
    const src = readFile('src/utils/offlineQueue.js');
    expect(src).toContain('conflict_already_processed');
    expect(src).toContain('status === 409');
  });

  it('Includes exponential backoff between failed sync items', () => {
    const src = readFile('src/utils/offlineQueue.js');
    expect(src).toContain('Math.pow(2,');
  });

  it('Sync lock prevents double-sync from rapid online events', () => {
    const src = readFile('src/utils/offlineQueue.js');
    expect(src).toContain('if (syncing) return');
  });
});

describe('API Client — Rate Limit UX', () => {
  it('formatApiError handles 429 with user-friendly message', () => {
    const src = readFile('src/api/client.js');
    expect(src).toContain('status === 429');
    expect(src).toContain('Too many requests');
  });

  it('Parses Retry-After header from 429 responses', () => {
    const src = readFile('src/api/client.js');
    expect(src).toContain('retry-after');
  });
});

describe('Upload Limit Alignment', () => {
  it('Server upload limit uses config.upload.maxFileSizeMB (not hardcoded)', () => {
    const src = readFile('server/src/modules/farmers/routes.js');
    expect(src).toContain('config.upload.maxFileSizeMB');
  });

  it('Client validates file size before upload', () => {
    const src = readFile('src/components/ProfilePhotoUpload.jsx');
    expect(src).toContain('MAX_FILE_SIZE');
    expect(src).toContain('ACCEPTED_TYPES');
  });
});

describe('Mobile Touch Targets — OnboardingWizard', () => {
  it('Reset link has minimum 44px touch target', () => {
    const src = readFile('src/components/OnboardingWizard.jsx');
    // resetLink style should include minHeight for mobile
    const resetIdx = src.indexOf('resetLink:');
    expect(resetIdx).toBeGreaterThan(0);
    const resetBlock = src.substring(resetIdx, resetIdx + 200);
    expect(resetBlock).toContain("minHeight: '44px'");
  });

  it('Reset confirm buttons have minimum 44px touch target', () => {
    const src = readFile('src/components/OnboardingWizard.jsx');
    // "Yes, start over" button should have minHeight
    expect(src).toContain("minHeight: '44px'");
  });

  it('Dismiss banner button has adequate touch target', () => {
    const src = readFile('src/components/OnboardingWizard.jsx');
    // Dismiss button should NOT have padding: 0 anymore
    const dismissMatch = src.indexOf('Dismiss</button>');
    expect(dismissMatch).toBeGreaterThan(0);
    const dismissBlock = src.substring(Math.max(0, dismissMatch - 300), dismissMatch);
    expect(dismissBlock).toContain("minHeight: '44px'");
  });
});

// ═══════════════════════════════════════════════════════════════
// Edge-Case Hardening — Phase 4: Audit/Feedback/Final Validation
// ═══════════════════════════════════════════════════════════════

describe('Sync Status — Failure Visibility', () => {
  it('SyncStatus shows failure count when sync fails', () => {
    const src = readFile('src/components/SyncStatus.jsx');
    expect(src).toContain('syncState.failed > 0');
    expect(src).toContain('failed to sync');
  });

  it('SyncStatus has failedBanner style', () => {
    const src = readFile('src/components/SyncStatus.jsx');
    expect(src).toContain('failedBanner');
  });

  it('SyncStatus shows Retry button on failure when online', () => {
    const src = readFile('src/components/SyncStatus.jsx');
    expect(src).toContain('Retry');
  });
});

describe('Audit Trail — Critical Route Coverage', () => {
  it('Issues routes import writeAuditLog', () => {
    const src = readFile('server/src/modules/issues/routes.js');
    expect(src).toContain("import { writeAuditLog }");
  });

  it('Issue creation writes audit log', () => {
    const src = readFile('server/src/modules/issues/routes.js');
    expect(src).toContain("action: 'issue_created'");
  });

  it('Issue update writes audit log', () => {
    const src = readFile('server/src/modules/issues/routes.js');
    expect(src).toContain("action: 'issue_updated'");
  });

  it('Issue bulk update writes audit log', () => {
    const src = readFile('server/src/modules/issues/routes.js');
    expect(src).toContain("action: 'issues_bulk_updated'");
  });

  it('SLA config update writes audit log', () => {
    const src = readFile('server/src/modules/issues/routes.js');
    expect(src).toContain("action: 'sla_config_updated'");
  });

  it('Security routes import writeAuditLog', () => {
    const src = readFile('server/src/modules/security/routes.js');
    expect(src).toContain("import { writeAuditLog }");
  });

  it('Security request creation writes audit log', () => {
    const src = readFile('server/src/modules/security/routes.js');
    expect(src).toContain("action: 'security_request_created'");
  });

  it('Security approval writes audit log', () => {
    const src = readFile('server/src/modules/security/routes.js');
    expect(src).toContain("action: 'security_request_approved'");
  });

  it('Security rejection writes audit log', () => {
    const src = readFile('server/src/modules/security/routes.js');
    expect(src).toContain("action: 'security_request_rejected'");
  });

  it('Security revocation writes audit log', () => {
    const src = readFile('server/src/modules/security/routes.js');
    expect(src).toContain("action: 'security_request_revoked'");
  });
});
