/**
 * Pilot QA Checklist Service
 *
 * Provides lightweight persistence + auto-derived signals for the internal
 * pilot QA / readiness checklist. Not customer-facing.
 *
 * Permissions enforced at route layer (super_admin, institutional_admin only).
 * All queries are org-scoped — super_admin may pass any orgId, institutional_admin
 * is forced to their own org by the route layer.
 */

import prisma from '../../config/database.js';

// ─── Canonical checklist definition ──────────────────────
// The 51-item master list. Stored items reference itemKey.
// autoDerive: true means we try to infer status from real system data.

export const CHECKLIST_ITEMS = [
  // A. Organization Setup
  { itemKey: 'org_setup.org_created',          category: 'org_setup', label: 'Org created', description: 'Organization record exists; org context is set', autoDerive: true },
  { itemKey: 'org_setup.admin_login',           category: 'org_setup', label: 'Admin login works', description: 'Institutional admin can log in and sees own org context' },
  { itemKey: 'org_setup.org_context_visible',   category: 'org_setup', label: 'Org context visible in UI', description: 'Org name shown in sidebar; super_admin org-switcher works' },
  { itemKey: 'org_setup.no_cross_org_leakage',  category: 'org_setup', label: 'No cross-org data leakage', description: 'Org-scoped user cannot see another org\'s farmers or applications' },

  // B. User Onboarding
  { itemKey: 'user_onboarding.farmer_record_only', category: 'user_onboarding', label: 'Farmer record only (no login)', description: 'Create farmer without email/password; invite token generated' },
  { itemKey: 'user_onboarding.farmer_with_login',  category: 'user_onboarding', label: 'Farmer + login account', description: 'Create farmer with email+password; login works immediately', autoDerive: true },
  { itemKey: 'user_onboarding.farmer_with_invite', category: 'user_onboarding', label: 'Farmer + invite link', description: 'Invite generates token; farmer completes registration via link', autoDerive: true },

  // C. Invite Delivery
  { itemKey: 'invite_delivery.email_invite',         category: 'invite_delivery', label: 'Email invite path', description: 'Email invite sends and is received (requires email configured)' },
  { itemKey: 'invite_delivery.phone_manual_share',   category: 'invite_delivery', label: 'Manual/phone share path', description: 'Copy link works; shared link is valid; farmer can access it' },
  { itemKey: 'invite_delivery.invite_acceptance',    category: 'invite_delivery', label: 'Invite accepted end-to-end', description: 'Farmer opens link, registers, and can log in successfully', autoDerive: true },
  { itemKey: 'invite_delivery.expired_invite',       category: 'invite_delivery', label: 'Expired invite handling', description: 'Expired link shows clear error; resend works from farmer detail page' },

  // D. Farmer First Use
  { itemKey: 'farmer_first_use.first_login',           category: 'farmer_first_use', label: 'First login', description: 'Farmer logs in; sees farmer home; no errors or blank screens', autoDerive: true },
  { itemKey: 'farmer_first_use.first_season',          category: 'farmer_first_use', label: 'First season created', description: 'Season created for approved farmer; shows active on farmer home', autoDerive: true },
  { itemKey: 'farmer_first_use.first_progress_update', category: 'farmer_first_use', label: 'First progress update', description: 'Farmer submits progress entry; field officer sees it in validation queue', autoDerive: true },
  { itemKey: 'farmer_first_use.first_image_upload',    category: 'farmer_first_use', label: 'First image upload', description: 'Image uploads; links to correct season; visible in evidence', autoDerive: true },
  { itemKey: 'farmer_first_use.stage_confirmation',    category: 'farmer_first_use', label: 'Stage confirmation', description: 'Officer confirms crop stage; farmer sees confirmation in app' },
  { itemKey: 'farmer_first_use.harvest_report',        category: 'farmer_first_use', label: 'Harvest report submitted', description: 'Farmer submits harvest; season transitions to harvested status', autoDerive: true },

  // E. Officer Workflow
  { itemKey: 'officer_workflow.assigned_list',    category: 'officer_workflow', label: 'Assigned farmer list scoped', description: 'Field officer sees only their assigned farmers; not all org farmers' },
  { itemKey: 'officer_workflow.validation_queue', category: 'officer_workflow', label: 'Validation queue works', description: 'Needs-attention page shows stale/overdue items correctly', autoDerive: true },
  { itemKey: 'officer_workflow.quick_validate',   category: 'officer_workflow', label: 'Quick validate action', description: 'Officer validates season from list; confirmation updates status' },
  { itemKey: 'officer_workflow.overdue_visible',  category: 'officer_workflow', label: 'Overdue items visible', description: 'Overdue harvests and stale seasons visible in needs-attention', autoDerive: true },

  // F. Reviewer Workflow
  { itemKey: 'reviewer_workflow.review_queue',       category: 'reviewer_workflow', label: 'Review queue loads correctly', description: 'Reviewer sees verification/fraud queue; items load without error' },
  { itemKey: 'reviewer_workflow.blockers_visible',   category: 'reviewer_workflow', label: 'Blockers clearly flagged', description: 'Fraud hold and escalated items have distinct visual treatment' },
  { itemKey: 'reviewer_workflow.next_action_obvious',category: 'reviewer_workflow', label: 'Next action obvious', description: 'UI shows what action is required for each application status' },
  { itemKey: 'reviewer_workflow.approve_reject_evidence', category: 'reviewer_workflow', label: 'Approve/reject/request-evidence all work', description: 'All three reviewer workflow actions complete without error' },

  // G. Admin Visibility
  { itemKey: 'admin_visibility.pending_approvals',     category: 'admin_visibility', label: 'Pending farmer approvals surfaced', description: 'Admin sees pending registrations; count shows on dashboard', autoDerive: true },
  { itemKey: 'admin_visibility.stale_farmers',         category: 'admin_visibility', label: 'Stale farmers visible', description: 'Farmers with no updates for 14+ days appear in needs-attention', autoDerive: true },
  { itemKey: 'admin_visibility.overdue_validations',   category: 'admin_visibility', label: 'Overdue validations visible', description: 'Seasons with unvalidated entries 7+ days old appear in alerts', autoDerive: true },
  { itemKey: 'admin_visibility.invite_problems',       category: 'admin_visibility', label: 'Invite problems surfaced', description: 'Expired/unaccepted invites show up in needs-attention and farmer detail', autoDerive: true },
  { itemKey: 'admin_visibility.low_confidence',        category: 'admin_visibility', label: 'Low-confidence records flagged', description: 'Low credibility scores surfaced in pilot metrics needs-attention', autoDerive: true },

  // H. Security & Access
  { itemKey: 'security_access.farmer_blocked_admin',     category: 'security_access', label: 'Farmer blocked from admin pages', description: 'Logged-in farmer cannot access /admin/* or staff-only routes' },
  { itemKey: 'security_access.reviewer_officer_limits',  category: 'security_access', label: 'Reviewer/officer restrictions hold', description: 'Reviewer cannot create farmers; field_officer cannot approve applications' },
  { itemKey: 'security_access.org_scoping_holds',        category: 'security_access', label: 'Org scoping enforced', description: 'institutional_admin cannot see data from other organizations' },
  { itemKey: 'security_access.user_editing_restrictions',category: 'security_access', label: 'User-editing restrictions hold', description: 'Role-change and org-change restrictions correctly enforced' },
  { itemKey: 'security_access.sod_jit_checks',           category: 'security_access', label: 'SoD/JIT approval gates hold', description: 'Farmer disable and role escalation require secondary approval' },

  // I. Country & Phone
  { itemKey: 'country_phone.country_selection',   category: 'country_phone', label: 'Country selection works', description: '195-country selector loads; search and select work correctly' },
  { itemKey: 'country_phone.international_phone', category: 'country_phone', label: 'International phone input works', description: 'Phone input with dial code; updates correctly on country change' },
  { itemKey: 'country_phone.normalization',        category: 'country_phone', label: 'Phone normalization works', description: 'Phone stored with dial code; duplicate check uses normalized form' },
  { itemKey: 'country_phone.onboarding_flow',     category: 'country_phone', label: 'Onboarding with intl phone succeeds', description: 'Full self-register or invite flow with non-KE phone number works' },

  // J. Season Lifecycle
  { itemKey: 'season_lifecycle.create_season', category: 'season_lifecycle', label: 'Create season', description: 'New season created for approved farmer; status shows active', autoDerive: true },
  { itemKey: 'season_lifecycle.stale_updates', category: 'season_lifecycle', label: 'Stale update detection', description: 'No-update season flagged after 14 days in needs-attention', autoDerive: true },
  { itemKey: 'season_lifecycle.resume_season', category: 'season_lifecycle', label: 'Resume interrupted season', description: 'Interrupted season can be resumed; previous progress preserved' },
  { itemKey: 'season_lifecycle.harvest',       category: 'season_lifecycle', label: 'Harvest flow end-to-end', description: 'Harvest report transitions season to harvested; scoring runs', autoDerive: true },

  // K. Image & Evidence
  { itemKey: 'image_evidence.upload_works',        category: 'image_evidence', label: 'Image upload works', description: 'Image upload from mobile/desktop; file stored and linked correctly', autoDerive: true },
  { itemKey: 'image_evidence.retry_failure',       category: 'image_evidence', label: 'Upload failure + retry', description: 'Upload failure shows clear retry message; no orphaned DB record left' },
  { itemKey: 'image_evidence.image_linked',        category: 'image_evidence', label: 'Image linked to correct season', description: 'Uploaded image appears in the correct season\'s evidence section' },
  { itemKey: 'image_evidence.wrong_image_correct', category: 'image_evidence', label: 'Wrong image correction', description: 'Admin or officer can re-upload or unlink an incorrect image' },

  // L. Monitoring & Failures
  { itemKey: 'monitoring_failure.failed_login',      category: 'monitoring_failure', label: 'Failed login logged', description: 'Failed login attempts logged via opsLogger (IP + reason)' },
  { itemKey: 'monitoring_failure.expired_invite',    category: 'monitoring_failure', label: 'Expired invite surfaced', description: 'Expired invites visible in needs-attention and farmer detail badge' },
  { itemKey: 'monitoring_failure.failed_upload',     category: 'monitoring_failure', label: 'Failed upload logged', description: 'Upload failures logged; visible in operational monitoring' },
  { itemKey: 'monitoring_failure.permission_errors', category: 'monitoring_failure', label: 'Permission denials logged', description: 'Permission errors logged via opsLogger with role and endpoint context' },
];

export const VALID_ITEM_KEYS = new Set(CHECKLIST_ITEMS.map(i => i.itemKey));

export const CATEGORY_META = {
  org_setup:          { label: 'A. Organization Setup',     color: '#1d4ed8' },
  user_onboarding:    { label: 'B. User Onboarding',        color: '#059669' },
  invite_delivery:    { label: 'C. Invite Delivery',        color: '#0891b2' },
  farmer_first_use:   { label: 'D. Farmer First Use',       color: '#7c3aed' },
  officer_workflow:   { label: 'E. Officer Workflow',        color: '#d97706' },
  reviewer_workflow:  { label: 'F. Reviewer Workflow',       color: '#be185d' },
  admin_visibility:   { label: 'G. Admin Visibility',        color: '#374151' },
  security_access:    { label: 'H. Security & Access',       color: '#dc2626' },
  country_phone:      { label: 'I. Country & Phone',         color: '#2563eb' },
  season_lifecycle:   { label: 'J. Season Lifecycle',        color: '#16a34a' },
  image_evidence:     { label: 'K. Image & Evidence',        color: '#ea580c' },
  monitoring_failure: { label: 'L. Monitoring & Failures',   color: '#6366f1' },
};

// ─── Auto-derive signals ──────────────────────────────────

async function computeAutoStatus({ organizationId }) {
  const farmerWhere    = organizationId ? { organizationId } : {};
  const seasonWhere    = organizationId ? { farmer: { organizationId } } : {};
  const progressWhere  = organizationId ? { season: { farmer: { organizationId } } } : {};
  const staleThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const overdueThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    orgExists,
    farmerLoginCount,
    farmerWithAccountCount,
    invitedFarmerCount,
    inviteAcceptedCount,
    seasonCount,
    progressCount,
    imageCount,
    harvestCount,
    pendingApprovalCount,
    staleSeasonCount,
    overdueValidationCount,
    lowCredCount,
    expiredInviteCount,
  ] = await Promise.all([
    organizationId
      ? prisma.organization.count({ where: { id: organizationId } })
      : Promise.resolve(1),
    prisma.user.count({
      where: { role: 'farmer', lastLoginAt: { not: null }, ...(organizationId ? { organizationId } : {}) },
    }),
    // Farmers with a linked user account (login possible)
    prisma.farmer.count({ where: { userId: { not: null }, ...farmerWhere } }),
    prisma.farmer.count({ where: { selfRegistered: false, invitedAt: { not: null }, ...farmerWhere } }),
    prisma.farmer.count({ where: { inviteDeliveryStatus: 'accepted', ...farmerWhere } }),
    prisma.farmSeason.count({ where: seasonWhere }),
    prisma.seasonProgressEntry.count({ where: progressWhere }),
    prisma.seasonProgressEntry.count({ where: { imageUrl: { not: null }, ...progressWhere } }),
    prisma.harvestReport.count({ where: organizationId ? { season: { farmer: { organizationId } } } : {} }),
    prisma.farmer.count({ where: { registrationStatus: 'pending_approval', ...farmerWhere } }),
    prisma.farmSeason.count({
      where: {
        status: 'active',
        progressEntries: { none: { createdAt: { gte: staleThreshold } } },
        ...seasonWhere,
      },
    }),
    prisma.farmSeason.count({
      where: {
        status: 'active',
        progressEntries: { some: { createdAt: { lt: overdueThreshold }, validatedAt: null } },
        ...seasonWhere,
      },
    }),
    prisma.credibilityAssessment.count({
      where: {
        score: { lt: 40 },
        season: { status: 'active', ...seasonWhere },
      },
    }).catch(() => 0),
    prisma.farmer.count({
      where: {
        inviteToken: { not: null },
        userId: null,
        inviteExpiresAt: { lt: new Date() },
        ...farmerWhere,
      },
    }),
  ]);

  const auto = {};

  // Org setup
  if (orgExists) auto['org_setup.org_created'] = 'pass';

  // User onboarding
  if (farmerWithAccountCount > 0) auto['user_onboarding.farmer_with_login'] = 'pass';
  if (invitedFarmerCount > 0) auto['user_onboarding.farmer_with_invite'] = 'pass';

  // Invite delivery
  if (inviteAcceptedCount > 0) {
    auto['invite_delivery.invite_acceptance'] = 'pass';
  } else if (invitedFarmerCount > 0) {
    // Invites sent but zero accepted — signal worth flagging
    auto['invite_delivery.invite_acceptance'] = 'fail';
  }

  // Farmer first use
  if (farmerLoginCount > 0)  auto['farmer_first_use.first_login'] = 'pass';
  if (seasonCount > 0) {
    auto['farmer_first_use.first_season'] = 'pass';
    auto['season_lifecycle.create_season'] = 'pass';
  }
  if (progressCount > 0) auto['farmer_first_use.first_progress_update'] = 'pass';
  if (imageCount > 0) {
    auto['farmer_first_use.first_image_upload'] = 'pass';
    auto['image_evidence.upload_works'] = 'pass';
  }
  if (harvestCount > 0) {
    auto['farmer_first_use.harvest_report'] = 'pass';
    auto['season_lifecycle.harvest'] = 'pass';
  }

  // Officer / admin signals (pass = data exists to exercise the feature)
  if (staleSeasonCount > 0) {
    auto['officer_workflow.validation_queue'] = 'pass';
    auto['officer_workflow.overdue_visible'] = 'pass';
    auto['admin_visibility.stale_farmers'] = 'pass';
    auto['season_lifecycle.stale_updates'] = 'pass';
  }
  if (overdueValidationCount > 0) auto['admin_visibility.overdue_validations'] = 'pass';
  if (pendingApprovalCount > 0)   auto['admin_visibility.pending_approvals'] = 'pass';
  if (lowCredCount > 0)           auto['admin_visibility.low_confidence'] = 'pass';

  if (expiredInviteCount > 0) {
    auto['admin_visibility.invite_problems'] = 'pass';
    auto['monitoring_failure.expired_invite'] = 'pass';
  }

  return auto;
}

// ─── Public service functions ─────────────────────────────

/**
 * Return all 51 checklist items merged with stored status + auto-derived signals.
 * @param {{ organizationId: string|null }} orgScope
 */
export async function getChecklist({ organizationId }) {
  const [stored, auto] = await Promise.all([
    prisma.pilotChecklistItem.findMany({
      where: organizationId ? { organizationId } : { organizationId: null },
      include: { updatedBy: { select: { id: true, fullName: true } } },
    }),
    computeAutoStatus({ organizationId }),
  ]);

  const storedMap = {};
  for (const s of stored) storedMap[s.itemKey] = s;

  return CHECKLIST_ITEMS.map(def => {
    const s = storedMap[def.itemKey];
    return {
      itemKey: def.itemKey,
      category: def.category,
      label: def.label,
      description: def.description,
      autoDerive: !!def.autoDerive,
      // Stored values
      status: s?.status ?? 'not_started',
      notes: s?.notes ?? null,
      updatedAt: s?.updatedAt ?? null,
      updatedBy: s?.updatedBy ?? null,
      // Auto-derived suggestion (only returned when status is not_started)
      suggestedStatus: s?.status === 'not_started' || !s ? (auto[def.itemKey] ?? null) : null,
    };
  });
}

/**
 * Create or update a single checklist item.
 */
export async function upsertChecklistItem({ itemKey, organizationId, status, notes, updatedById }) {
  if (!VALID_ITEM_KEYS.has(itemKey)) {
    const err = new Error(`Unknown checklist item key: ${itemKey}`);
    err.statusCode = 400;
    throw err;
  }

  const def = CHECKLIST_ITEMS.find(i => i.itemKey === itemKey);

  const data = {
    category: def.category,
    updatedById: updatedById || null,
  };
  if (status !== undefined) data.status = status;
  if (notes !== undefined) data.notes = notes ?? null;

  // NOTE: Prisma upsert with composite unique containing a nullable field is unreliable
  // (PostgreSQL treats NULL != NULL, so the ON CONFLICT clause can't match null-org rows).
  // Use findFirst + create/update to handle this correctly.
  const orgId = organizationId ?? null;
  const existing = await prisma.pilotChecklistItem.findFirst({
    where: { itemKey, organizationId: orgId },
  });

  if (existing) {
    return prisma.pilotChecklistItem.update({
      where: { id: existing.id },
      data,
      include: { updatedBy: { select: { id: true, fullName: true } } },
    });
  }

  return prisma.pilotChecklistItem.create({
    data: {
      itemKey,
      organizationId: orgId,
      ...data,
      status: status ?? 'not_started',
    },
    include: { updatedBy: { select: { id: true, fullName: true } } },
  });
}

/**
 * Live health indicators — pulled from real system data only.
 */
export async function getHealthIndicators({ organizationId }) {
  const farmerWhere   = organizationId ? { organizationId } : {};
  const seasonWhere   = organizationId ? { farmer: { organizationId } } : {};
  const staleThresh   = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const overdueThresh = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    invitesSent,
    invitesAccepted,
    farmersFirstUpdate,
    activeSeasons,
    staleSeasons,
    overdueValidations,
    pendingReviews,
    checklistFail,
    checklistBlocked,
  ] = await Promise.all([
    prisma.farmer.count({ where: { selfRegistered: false, invitedAt: { not: null }, ...farmerWhere } }),
    prisma.farmer.count({ where: { inviteDeliveryStatus: 'accepted', ...farmerWhere } }),
    prisma.farmer.count({
      where: {
        ...farmerWhere,
        farmSeasons: { some: { progressEntries: { some: {} } } },
      },
    }),
    prisma.farmSeason.count({ where: { status: 'active', ...seasonWhere } }),
    prisma.farmSeason.count({
      where: {
        status: 'active',
        progressEntries: { none: { createdAt: { gte: staleThresh } } },
        ...seasonWhere,
      },
    }),
    prisma.farmSeason.count({
      where: {
        status: 'active',
        progressEntries: { some: { createdAt: { lt: overdueThresh }, validatedAt: null } },
        ...seasonWhere,
      },
    }),
    prisma.application.count({
      where: {
        status: { in: ['submitted', 'under_review', 'needs_more_evidence', 'field_review_required', 'escalated'] },
        ...(organizationId ? { farmer: { organizationId } } : {}),
      },
    }),
    prisma.pilotChecklistItem.count({
      where: { status: 'fail', ...(organizationId ? { organizationId } : { organizationId: null }) },
    }),
    prisma.pilotChecklistItem.count({
      where: { status: 'blocked', ...(organizationId ? { organizationId } : { organizationId: null }) },
    }),
  ]);

  return {
    invitesSent,
    invitesAccepted,
    inviteAcceptRate: invitesSent > 0 ? Math.round((invitesAccepted / invitesSent) * 100) : null,
    farmersFirstUpdate,
    activeSeasons,
    staleSeasons,
    overdueValidations,
    pendingReviews,
    checklistFail,
    checklistBlocked,
  };
}

/**
 * Pilot validation report — summary of checklist completion + key risks.
 */
export async function getReport({ organizationId }) {
  const stored = await prisma.pilotChecklistItem.findMany({
    where: organizationId ? { organizationId } : { organizationId: null },
    select: { itemKey: true, category: true, status: true },
  });

  const storedMap = {};
  for (const s of stored) storedMap[s.itemKey] = s;

  // Build stats across all 51 canonical items
  const counts = { pass: 0, fail: 0, blocked: 0, not_started: 0, not_applicable: 0 };
  const categoryFail = {};
  const categoryBlocked = {};

  for (const def of CHECKLIST_ITEMS) {
    const status = storedMap[def.itemKey]?.status ?? 'not_started';
    counts[status] = (counts[status] ?? 0) + 1;

    if (status === 'fail') {
      categoryFail[def.category] = (categoryFail[def.category] ?? 0) + 1;
    }
    if (status === 'blocked') {
      categoryBlocked[def.category] = (categoryBlocked[def.category] ?? 0) + 1;
    }
  }

  const total = CHECKLIST_ITEMS.length;
  const actionable = total - counts.not_applicable - counts.not_started;
  const passRate = actionable > 0 ? Math.round((counts.pass / actionable) * 100) : null;

  const topFailCategories = Object.entries(categoryFail)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, n]) => ({ category: cat, label: CATEGORY_META[cat]?.label ?? cat, count: n }));

  const topBlockedCategories = Object.entries(categoryBlocked)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, n]) => ({ category: cat, label: CATEGORY_META[cat]?.label ?? cat, count: n }));

  // Key risks: categories with most untested items (not_started) that have autoDerive
  const riskCategories = {};
  for (const def of CHECKLIST_ITEMS.filter(i => i.autoDerive)) {
    const status = storedMap[def.itemKey]?.status ?? 'not_started';
    if (status === 'not_started') {
      riskCategories[def.category] = (riskCategories[def.category] ?? 0) + 1;
    }
  }
  const keyRisks = Object.entries(riskCategories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat, n]) => ({ category: cat, label: CATEGORY_META[cat]?.label ?? cat, untested: n }));

  return {
    total,
    ...counts,
    passRate,
    topFailCategories,
    topBlockedCategories,
    keyRisks,
    generatedAt: new Date().toISOString(),
  };
}
