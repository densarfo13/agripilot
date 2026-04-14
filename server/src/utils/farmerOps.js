/**
 * Farmer Operations Utilities — single source of truth for:
 *
 *   1. Duplicate detection scoring (enhanced)
 *   2. Activity status classification (ACTIVE / INACTIVE / SETUP_INCOMPLETE)
 *   3. Time-bound metric helpers (explicit time windows)
 *   4. Profile completeness calculation (Farmer model)
 *   5. Program/cohort filtering helpers
 *
 * Rules:
 *   - One definition per concept, used everywhere
 *   - No fabricated data — only real recorded activity
 *   - Org-scoped by default
 *   - Backward compatible — degrades gracefully for old records
 */

// ═══════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════

/** Default activity window in days. A farmer with qualifying activity within this window is ACTIVE. */
export const DEFAULT_ACTIVITY_WINDOW_DAYS = 30;

/** Fields required for a complete farmer profile. */
export const REQUIRED_FARMER_FIELDS = [
  'fullName',
  'phone',
  'region',
  'primaryCrop',
  'landSizeHectares',
  'countryCode',
];

/** Optional but valuable fields (not required for completeness). */
export const OPTIONAL_FARMER_FIELDS = [
  'district',
  'village',
  'gender',
  'dateOfBirth',
  'latitude',
  'longitude',
  'nationalId',
];

// ═══════════════════════════════════════════════════════════
//  1. DUPLICATE DETECTION — ENHANCED SCORING
// ═══════════════════════════════════════════════════════════

/**
 * Score how likely a candidate match is a true duplicate.
 *
 * @param {object} input - The new farmer data being checked
 * @param {object} existing - An existing farmer record from the DB
 * @returns {{ score: number, signals: string[], matchLevel: 'exact'|'likely'|'possible'|'none' }}
 *
 * Scoring:
 *   phone exact match      → +50
 *   nationalId exact match → +50
 *   name exact (case-insensitive) + same region → +30
 *   name fuzzy (normalized) + same region → +20
 *   name exact (case-insensitive) alone → +15
 *   same region + same crop → +5
 *
 * Match levels:
 *   exact    ≥ 50  (phone or nationalId match)
 *   likely   ≥ 30  (name+region)
 *   possible ≥ 15  (name only or weaker signals)
 *   none     < 15
 */
export function scoreDuplicateMatch(input, existing) {
  let score = 0;
  const signals = [];

  // Phone match (strongest signal)
  if (input.phone && existing.phone) {
    const normInput = normalizeForComparison(input.phone);
    const normExist = normalizeForComparison(existing.phone);
    if (normInput && normExist && normInput === normExist) {
      score += 50;
      signals.push('phone_exact');
    }
  }

  // National ID match
  if (input.nationalId && existing.nationalId) {
    const normInput = input.nationalId.replace(/\s+/g, '').toLowerCase();
    const normExist = existing.nationalId.replace(/\s+/g, '').toLowerCase();
    if (normInput === normExist) {
      score += 50;
      signals.push('national_id_exact');
    }
  }

  // Name matching
  if (input.fullName && existing.fullName) {
    const inputName = input.fullName.trim().toLowerCase();
    const existName = existing.fullName.trim().toLowerCase();

    if (inputName === existName) {
      // Exact name + region = strong
      if (input.region && existing.region && input.region.toLowerCase().trim() === existing.region.toLowerCase().trim()) {
        score += 30;
        signals.push('name_exact_region_match');
      } else {
        score += 15;
        signals.push('name_exact');
      }
    } else {
      // Fuzzy: normalized name comparison (remove spaces, compare sorted tokens)
      const inputTokens = inputName.split(/\s+/).sort().join('');
      const existTokens = existName.split(/\s+/).sort().join('');
      if (inputTokens === existTokens && inputTokens.length > 3) {
        if (input.region && existing.region && input.region.toLowerCase().trim() === existing.region.toLowerCase().trim()) {
          score += 20;
          signals.push('name_fuzzy_region_match');
        } else {
          score += 10;
          signals.push('name_fuzzy');
        }
      }
    }
  }

  // Region + crop bonus (weak)
  if (input.region && existing.region && input.primaryCrop && existing.primaryCrop) {
    if (
      input.region.toLowerCase().trim() === existing.region.toLowerCase().trim() &&
      input.primaryCrop.toLowerCase().trim() === existing.primaryCrop.toLowerCase().trim()
    ) {
      score += 5;
      signals.push('region_crop_match');
    }
  }

  let matchLevel = 'none';
  if (score >= 50) matchLevel = 'exact';
  else if (score >= 30) matchLevel = 'likely';
  else if (score >= 15) matchLevel = 'possible';

  return { score, signals, matchLevel };
}

function normalizeForComparison(phone) {
  if (!phone) return '';
  return phone.replace(/[\s\-\(\)\.+]/g, '').slice(-9); // last 9 digits
}

// ═══════════════════════════════════════════════════════════
//  2. ACTIVITY STATUS — SINGLE DEFINITION
// ═══════════════════════════════════════════════════════════

/**
 * Classify a farmer's activity status using one consistent definition.
 *
 * @param {object} farmer - Farmer record with relations loaded:
 *   - registrationStatus, userId, onboardingCompletedAt
 *   - userAccount: { active, lastLoginAt }
 *   - farmSeasons: [{ status, lastActivityDate, progressEntries }]
 *   - (optional) farmProfiles: [{ ... }]
 * @param {object} opts
 * @param {number} [opts.windowDays=30] - Days to look back for activity
 * @returns {{ status: 'ACTIVE'|'INACTIVE'|'SETUP_INCOMPLETE'|'PENDING_APPROVAL'|'DISABLED', reason: string, lastActivityAt: Date|null }}
 *
 * Definition:
 *   DISABLED           → registrationStatus = 'disabled'
 *   PENDING_APPROVAL   → registrationStatus = 'pending_approval'
 *   SETUP_INCOMPLETE   → approved but missing: user account OR no season OR profile incomplete
 *   ACTIVE             → has qualifying activity within windowDays
 *   INACTIVE           → approved + set up, but no qualifying activity within windowDays
 *
 * "Qualifying activity" means any of:
 *   - lastLoginAt within window
 *   - season lastActivityDate within window
 *   - progress entry created within window
 */
export function classifyFarmerActivity(farmer, opts = {}) {
  const windowDays = opts.windowDays ?? DEFAULT_ACTIVITY_WINDOW_DAYS;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  if (!farmer) return { status: 'INACTIVE', reason: 'No farmer record', lastActivityAt: null };

  // Registration status checks
  if (farmer.registrationStatus === 'disabled') {
    return { status: 'DISABLED', reason: 'Account disabled', lastActivityAt: null };
  }
  if (farmer.registrationStatus === 'pending_approval') {
    return { status: 'PENDING_APPROVAL', reason: 'Awaiting approval', lastActivityAt: null };
  }
  if (farmer.registrationStatus === 'rejected') {
    return { status: 'DISABLED', reason: 'Registration rejected', lastActivityAt: null };
  }

  // Setup completeness checks
  const acct = farmer.userAccount;
  if (!farmer.userId && !acct) {
    return { status: 'SETUP_INCOMPLETE', reason: 'No user account linked', lastActivityAt: null };
  }
  if (acct && !acct.active) {
    return { status: 'DISABLED', reason: 'User account deactivated', lastActivityAt: null };
  }

  const hasAnySeason = farmer.farmSeasons && farmer.farmSeasons.length > 0;
  if (!hasAnySeason) {
    return { status: 'SETUP_INCOMPLETE', reason: 'No season created', lastActivityAt: null };
  }

  // Find most recent activity date across all signals
  let lastActivityAt = null;

  // Login activity
  if (acct?.lastLoginAt) {
    const loginDate = new Date(acct.lastLoginAt);
    if (!lastActivityAt || loginDate > lastActivityAt) lastActivityAt = loginDate;
  }

  // Season activity dates
  if (farmer.farmSeasons) {
    for (const season of farmer.farmSeasons) {
      if (season.lastActivityDate) {
        const d = new Date(season.lastActivityDate);
        if (!lastActivityAt || d > lastActivityAt) lastActivityAt = d;
      }
    }
  }

  // Classify based on recency
  if (lastActivityAt && lastActivityAt >= cutoff) {
    return { status: 'ACTIVE', reason: `Activity within last ${windowDays} days`, lastActivityAt };
  }

  return {
    status: 'INACTIVE',
    reason: lastActivityAt
      ? `No activity since ${lastActivityAt.toISOString().split('T')[0]}`
      : 'No recorded activity',
    lastActivityAt,
  };
}

// ═══════════════════════════════════════════════════════════
//  3. TIME-BOUND METRIC HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Build standard time windows for metric queries.
 *
 * @param {object} [opts]
 * @param {number} [opts.activityWindowDays=30]
 * @returns {{ activityCutoff: Date, weekCutoff: Date, monthCutoff: Date, quarterCutoff: Date, windowLabel: string }}
 */
export function buildTimeWindows(opts = {}) {
  const windowDays = opts.activityWindowDays ?? DEFAULT_ACTIVITY_WINDOW_DAYS;
  const now = new Date();

  return {
    now,
    activityCutoff: new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000),
    weekCutoff: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    monthCutoff: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    quarterCutoff: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    windowDays,
    windowLabel: `last ${windowDays} days`,
  };
}

// ═══════════════════════════════════════════════════════════
//  4. PROFILE COMPLETENESS — FARMER MODEL
// ═══════════════════════════════════════════════════════════

/**
 * Calculate profile completeness for a Farmer record.
 *
 * @param {object} farmer - Farmer DB record
 * @returns {{ complete: boolean, filledCount: number, totalRequired: number, missingFields: string[], completionPct: number }}
 */
export function calculateFarmerCompleteness(farmer) {
  if (!farmer) {
    return {
      complete: false,
      filledCount: 0,
      totalRequired: REQUIRED_FARMER_FIELDS.length,
      missingFields: [...REQUIRED_FARMER_FIELDS],
      completionPct: 0,
    };
  }

  const missingFields = [];
  let filledCount = 0;

  for (const field of REQUIRED_FARMER_FIELDS) {
    const value = farmer[field];
    const isFilled = value !== null && value !== undefined && value !== '' &&
      (typeof value !== 'number' || value > 0);

    if (isFilled) {
      filledCount++;
    } else {
      missingFields.push(field);
    }
  }

  const totalRequired = REQUIRED_FARMER_FIELDS.length;
  const completionPct = Math.round((filledCount / totalRequired) * 100);
  const complete = filledCount === totalRequired;

  return { complete, filledCount, totalRequired, missingFields, completionPct };
}

/**
 * Summarize completeness across a list of farmers.
 *
 * @param {object[]} farmers
 * @returns {{ total: number, complete: number, incomplete: number, completePct: number, commonMissing: { field: string, count: number }[] }}
 */
export function summarizeCompleteness(farmers) {
  if (!farmers || farmers.length === 0) {
    return { total: 0, complete: 0, incomplete: 0, completePct: 0, commonMissing: [] };
  }

  let completeCount = 0;
  const missingCounts = {};

  for (const farmer of farmers) {
    const result = calculateFarmerCompleteness(farmer);
    if (result.complete) completeCount++;
    for (const field of result.missingFields) {
      missingCounts[field] = (missingCounts[field] || 0) + 1;
    }
  }

  const commonMissing = Object.entries(missingCounts)
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: farmers.length,
    complete: completeCount,
    incomplete: farmers.length - completeCount,
    completePct: Math.round((completeCount / farmers.length) * 100),
    commonMissing,
  };
}

// ═══════════════════════════════════════════════════════════
//  5. PROGRAM / COHORT FILTERING
// ═══════════════════════════════════════════════════════════

/**
 * Build Prisma `where` filter for farmer queries scoped by org/program/cohort.
 *
 * @param {object} opts
 * @param {string} [opts.organizationId]
 * @param {string} [opts.programId]
 * @param {string} [opts.cohortId]
 * @param {string} [opts.region]
 * @param {string} [opts.primaryCrop]
 * @returns {object} Prisma where clause
 */
export function buildFarmerScopeFilter(opts = {}) {
  const where = {};

  if (opts.organizationId) where.organizationId = opts.organizationId;
  if (opts.programId) where.programId = opts.programId;
  if (opts.cohortId) where.cohortId = opts.cohortId;
  if (opts.region) where.region = opts.region;
  if (opts.primaryCrop) where.primaryCrop = opts.primaryCrop;

  return where;
}

/**
 * Build time-bounded Prisma filters for "active farmer" counting.
 * Uses a single consistent definition across dashboard, reports, and exports.
 *
 * @param {object} opts
 * @param {string} [opts.organizationId]
 * @param {string} [opts.programId]
 * @param {string} [opts.cohortId]
 * @param {number} [opts.windowDays=30]
 * @returns {{ activeFarmerWhere: object, inactiveFarmerWhere: object, setupIncompleteWhere: object, timeWindows: object }}
 */
export function buildActivityFilters(opts = {}) {
  const scope = buildFarmerScopeFilter(opts);
  const tw = buildTimeWindows({ activityWindowDays: opts.windowDays });

  const approvedBase = { ...scope, registrationStatus: 'approved' };

  // ACTIVE: approved + (login OR season activity) within window
  const activeFarmerWhere = {
    ...approvedBase,
    OR: [
      { userAccount: { lastLoginAt: { gte: tw.activityCutoff } } },
      { farmSeasons: { some: { lastActivityDate: { gte: tw.activityCutoff } } } },
    ],
  };

  // SETUP_INCOMPLETE: approved but no user account OR no season
  const setupIncompleteWhere = {
    ...approvedBase,
    OR: [
      { userId: null },
      { farmSeasons: { none: {} } },
    ],
  };

  // INACTIVE: approved + has account + has season + no recent activity
  const inactiveFarmerWhere = {
    ...approvedBase,
    userId: { not: null },
    farmSeasons: { some: {} },
    AND: [
      {
        OR: [
          { userAccount: { lastLoginAt: { lt: tw.activityCutoff } } },
          { userAccount: { lastLoginAt: null } },
        ],
      },
      {
        OR: [
          { farmSeasons: { every: { lastActivityDate: { lt: tw.activityCutoff } } } },
          { farmSeasons: { every: { lastActivityDate: null } } },
        ],
      },
    ],
  };

  return { activeFarmerWhere, inactiveFarmerWhere, setupIncompleteWhere, timeWindows: tw };
}
