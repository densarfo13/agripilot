/**
 * Impact Dashboard Service — Phase 1 (Pilot-Ready)
 *
 * Simple, clear aggregations for NGO impact reporting.
 * All queries are org-scoped. Uses existing tables only:
 *   - farmers (gender, dateOfBirth, region, etc.)
 *   - farm_seasons (status, lastActivityDate)
 *   - officer_validations
 *   - season_progress_entries
 */

import prisma from '../../config/database.js';

// ─── Helpers ────────────────────────────────────────────

const VALID_GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];
const AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55+', 'unknown'];
const VALID_REG_STATUSES = ['pending_approval', 'approved', 'rejected', 'disabled'];

function ageFromDob(dob) {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function ageGroup(age) {
  if (age === null || age === undefined) return 'unknown';
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55+';
}

function isYouth(age) {
  return age !== null && age !== undefined && age >= 15 && age <= 35;
}

/** Build org filter for farmers table. */
function orgFilter(organizationId) {
  if (!organizationId) return {};
  return { organizationId };
}

// ─── Main Dashboard ─────────────────────────────────────

export async function getImpactDashboard({ organizationId, filters = {} }) {
  const where = { ...orgFilter(organizationId) };

  // Apply filters
  if (filters.gender && VALID_GENDERS.includes(filters.gender)) {
    where.gender = filters.gender;
  }
  if (filters.region) {
    where.region = filters.region;
  }
  if (filters.registrationStatus && VALID_REG_STATUSES.includes(filters.registrationStatus)) {
    where.registrationStatus = filters.registrationStatus;
  }
  if (filters.crop) {
    where.primaryCrop = filters.crop;
  }
  if (filters.dateFrom) {
    where.createdAt = { ...(where.createdAt || {}), gte: new Date(filters.dateFrom) };
  }
  if (filters.dateTo) {
    where.createdAt = { ...(where.createdAt || {}), lte: new Date(filters.dateTo) };
  }

  // Fetch farmers with related data
  const farmers = await prisma.farmer.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      gender: true,
      dateOfBirth: true,
      region: true,
      createdAt: true,
      farmSeasons: {
        select: {
          status: true,
          lastActivityDate: true,
          progressEntries: {
            select: { id: true },
          },
          officerValidations: {
            select: { id: true },
          },
        },
      },
    },
  });

  // ─── Build aggregations ─────────────────────────────
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 3600 * 1000);

  const summary = {
    totalFarmers: 0,
    womenFarmers: 0,
    youthFarmers: 0,
    activeFarmers: 0,
    validatedRecords: 0,
    needsAttention: 0,
  };

  const genderDist = { male: 0, female: 0, other: 0, prefer_not_to_say: 0, unknown: 0 };
  const ageGroupDist = {};
  for (const g of AGE_GROUPS) ageGroupDist[g] = 0;

  // Participation by demographic
  const activeByGender = { male: 0, female: 0, other: 0, prefer_not_to_say: 0, unknown: 0 };
  const totalByGender = { male: 0, female: 0, other: 0, prefer_not_to_say: 0, unknown: 0 };
  const activeByAge = {};
  const totalByAge = {};
  for (const g of AGE_GROUPS) { activeByAge[g] = 0; totalByAge[g] = 0; }

  // Needs attention lists (capped at 20 items, but totals tracked)
  const noUpdate = [];     // farmers with seasons but zero progress entries
  const notValidated = []; // farmers with seasons but zero officer validations
  const inactive = [];     // farmers with active season but no activity in 30d
  let noUpdateCount = 0, notValidatedCount = 0, inactiveCount = 0;

  for (const farmer of farmers) {
    const g = farmer.gender && VALID_GENDERS.includes(farmer.gender) ? farmer.gender : 'unknown';
    const age = ageFromDob(farmer.dateOfBirth);
    const ag = ageGroup(age);

    // Age group filter (applied in-memory since DB has dateOfBirth not age)
    if (filters.ageGroup && filters.ageGroup !== ag) continue;

    summary.totalFarmers++;
    if (g === 'female') summary.womenFarmers++;
    if (isYouth(age)) summary.youthFarmers++;

    genderDist[g]++;
    ageGroupDist[ag]++;
    totalByGender[g]++;
    totalByAge[ag]++;

    // Activity
    const hasActiveSeason = farmer.farmSeasons.some(s => s.status === 'active');
    const hasRecentActivity = farmer.farmSeasons.some(s =>
      s.lastActivityDate && new Date(s.lastActivityDate) > thirtyDaysAgo
    );
    const isActive = hasActiveSeason || hasRecentActivity;

    if (isActive) {
      summary.activeFarmers++;
      activeByGender[g]++;
      activeByAge[ag]++;
    }

    // Validation
    const hasValidation = farmer.farmSeasons.some(s => s.officerValidations.length > 0);
    if (hasValidation) {
      summary.validatedRecords++;
    }

    // ── Needs Attention classification ──
    const hasSeasons = farmer.farmSeasons.length > 0;
    const hasAnyUpdate = farmer.farmSeasons.some(s => s.progressEntries.length > 0);
    const isStale = hasActiveSeason && !hasRecentActivity;
    const needsFlag = (hasSeasons && !hasAnyUpdate) || (hasSeasons && !hasValidation) || isStale;

    if (needsFlag) {
      summary.needsAttention++;
      const entry = { id: farmer.id, name: farmer.fullName, gender: g, region: farmer.region };

      if (hasSeasons && !hasAnyUpdate) {
        noUpdateCount++;
        if (noUpdate.length < 20) noUpdate.push(entry);
      }
      if (hasSeasons && !hasValidation) {
        notValidatedCount++;
        if (notValidated.length < 20) notValidated.push(entry);
      }
      if (isStale) {
        inactiveCount++;
        if (inactive.length < 20) inactive.push(entry);
      }
    }
  }

  return {
    summary,
    demographics: {
      gender: genderDist,
      ageGroup: ageGroupDist,
    },
    participation: {
      activeRateByGender: buildRateMap(activeByGender, totalByGender),
      activeRateByAge: buildRateMap(activeByAge, totalByAge),
    },
    needsAttention: {
      noUpdate,
      noUpdateCount,
      notValidated,
      notValidatedCount,
      inactive,
      inactiveCount,
    },
    appliedFilters: filters,
  };
}

function buildRateMap(numerator, denominator) {
  const result = {};
  for (const key of Object.keys(denominator)) {
    const total = denominator[key] || 0;
    const count = numerator[key] || 0;
    result[key] = {
      count,
      total,
      rate: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  }
  return result;
}

// ─── Trends (lightweight) ───────────────────────────────

export async function getImpactTrends({ organizationId, months = 6 }) {
  const orgWhere = orgFilter(organizationId);
  // Build period boundaries up-front
  const periods = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const periodLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    periods.push({ periodEnd, periodLabel });
  }

  // Single query: fetch all farmers created up to the latest period
  const latestEnd = periods[periods.length - 1].periodEnd;
  const allFarmers = await prisma.farmer.findMany({
    where: {
      ...orgWhere,
      createdAt: { lte: latestEnd },
    },
    select: {
      id: true,
      createdAt: true,
      farmSeasons: {
        where: { createdAt: { lte: latestEnd } },
        select: {
          status: true,
          createdAt: true,
          lastActivityDate: true,
          officerValidations: { select: { id: true } },
        },
      },
    },
  });

  // Aggregate per period in-memory (one DB query instead of N)
  const points = periods.map(({ periodEnd, periodLabel }) => {
    const cutoff = new Date(periodEnd - 30 * 24 * 3600 * 1000);
    let total = 0, active = 0, validated = 0;

    for (const f of allFarmers) {
      if (new Date(f.createdAt) > periodEnd) continue;
      total++;

      const eligibleSeasons = f.farmSeasons.filter(s => new Date(s.createdAt) <= periodEnd);
      const isActive = eligibleSeasons.some(s =>
        s.status === 'active' || (s.lastActivityDate && new Date(s.lastActivityDate) > cutoff)
      );
      if (isActive) active++;

      const hasValidation = eligibleSeasons.some(s => s.officerValidations.length > 0);
      if (hasValidation) validated++;
    }

    return {
      period: periodLabel,
      activeFarmers: active,
      totalFarmers: total,
      activeRate: total > 0 ? Math.round((active / total) * 1000) / 10 : 0,
      validatedFarmers: validated,
      validationRate: total > 0 ? Math.round((validated / total) * 1000) / 10 : 0,
    };
  });

  return { months, trends: points };
}

// ─── CSV Export ──────────────────────────────────────────

export async function getImpactExportCSV({ organizationId, filters = {} }) {
  const dashboard = await getImpactDashboard({ organizationId, filters });
  const s = dashboard.summary;

  const rows = [];

  // Summary
  rows.push(['IMPACT SUMMARY']);
  rows.push(['Metric', 'Value', '%']);
  rows.push(['Total Farmers', s.totalFarmers, '']);
  rows.push(['Women Farmers', s.womenFarmers, s.totalFarmers ? pct(s.womenFarmers, s.totalFarmers) : '0']);
  rows.push(['Youth Farmers (15-35)', s.youthFarmers, s.totalFarmers ? pct(s.youthFarmers, s.totalFarmers) : '0']);
  rows.push(['Active Farmers (30d)', s.activeFarmers, s.totalFarmers ? pct(s.activeFarmers, s.totalFarmers) : '0']);
  rows.push(['Validated Records', s.validatedRecords, s.totalFarmers ? pct(s.validatedRecords, s.totalFarmers) : '0']);
  rows.push(['Needs Attention', s.needsAttention, '']);
  rows.push([]);

  // Gender distribution
  rows.push(['GENDER DISTRIBUTION']);
  rows.push(['Gender', 'Count']);
  for (const [k, v] of Object.entries(dashboard.demographics.gender)) {
    if (v > 0) rows.push([k, v]);
  }
  rows.push([]);

  // Age distribution
  rows.push(['AGE GROUP DISTRIBUTION']);
  rows.push(['Age Group', 'Count']);
  for (const [k, v] of Object.entries(dashboard.demographics.ageGroup)) {
    if (v > 0) rows.push([k, v]);
  }
  rows.push([]);

  // Active rate by gender
  rows.push(['ACTIVE RATE BY GENDER']);
  rows.push(['Gender', 'Active', 'Total', 'Rate %']);
  for (const [k, v] of Object.entries(dashboard.participation.activeRateByGender)) {
    if (v.total > 0) rows.push([k, v.count, v.total, v.rate]);
  }
  rows.push([]);

  // Active rate by age
  rows.push(['ACTIVE RATE BY AGE GROUP']);
  rows.push(['Age Group', 'Active', 'Total', 'Rate %']);
  for (const [k, v] of Object.entries(dashboard.participation.activeRateByAge)) {
    if (v.total > 0) rows.push([k, v.count, v.total, v.rate]);
  }
  rows.push([]);

  // Needs attention lists
  rows.push(['NEEDS ATTENTION — NO UPDATE']);
  rows.push(['Name', 'Gender', 'Region']);
  for (const f of dashboard.needsAttention.noUpdate) {
    rows.push([f.name, f.gender, f.region]);
  }
  rows.push([]);

  rows.push(['NEEDS ATTENTION — NOT VALIDATED']);
  rows.push(['Name', 'Gender', 'Region']);
  for (const f of dashboard.needsAttention.notValidated) {
    rows.push([f.name, f.gender, f.region]);
  }
  rows.push([]);

  rows.push(['NEEDS ATTENTION — INACTIVE']);
  rows.push(['Name', 'Gender', 'Region']);
  for (const f of dashboard.needsAttention.inactive) {
    rows.push([f.name, f.gender, f.region]);
  }

  return rows.map(row =>
    row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}

function pct(n, d) {
  return (Math.round((n / d) * 1000) / 10).toString();
}

// ─── Filter Options ─────────────────────────────────────

export async function getImpactFilterOptions({ organizationId }) {
  const orgWhere = orgFilter(organizationId);

  const [crops, regions] = await Promise.all([
    prisma.farmer.findMany({
      where: { ...orgWhere, primaryCrop: { not: null } },
      select: { primaryCrop: true },
      distinct: ['primaryCrop'],
      orderBy: { primaryCrop: 'asc' },
    }),
    prisma.farmer.findMany({
      where: { ...orgWhere, region: { not: null } },
      select: { region: true },
      distinct: ['region'],
      orderBy: { region: 'asc' },
    }),
  ]);

  return {
    genders: ['male', 'female', 'other', 'prefer_not_to_say'],
    ageGroups: ['18-24', '25-34', '35-44', '45-54', '55+'],
    registrationStatuses: VALID_REG_STATUSES,
    regions: regions.map(r => r.region),
    crops: crops.map(c => c.primaryCrop),
  };
}
