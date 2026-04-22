/**
 * orgDashboard.test.js — locks the organization dashboard
 * aggregator + CSV export contracts.
 *
 *   • Pure helpers: normalizeCrop, hectaresFromFarm
 *   • Pure aggregators: computeCropDistribution, computeYieldProjection,
 *       computeAverageScore, computeRiskIndicators
 *   • DB wrapper: buildOrganizationDashboard with in-memory Prisma fake
 *   • DB wrapper: listOrganizationFarmers (filters + pagination)
 *   • CSV: escapeCsvField, buildFarmersCsv, buildDashboardCsv
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  buildOrganizationDashboard, listOrganizationFarmers,
  computeCropDistribution, computeYieldProjection,
  computeAverageScore, computeRiskIndicators,
  normalizeCrop, hectaresFromFarm,
  _internal,
} from '../modules/organizations/dashboardService.js';
import {
  escapeCsvField, buildFarmersCsv, buildDashboardCsv,
} from '../modules/organizations/exportService.js';

// ═══════════════════════════════════════════════════════════════
// Pure helpers
// ═══════════════════════════════════════════════════════════════
describe('pure helpers', () => {
  it('normalizeCrop lowercases + trims', () => {
    expect(normalizeCrop('  MAIZE  ')).toBe('maize');
    expect(normalizeCrop(null)).toBe('');
    expect(normalizeCrop('')).toBe('');
  });

  it('hectaresFromFarm prefers landSizeHectares', () => {
    expect(hectaresFromFarm({ landSizeHectares: 2 })).toBe(2);
  });

  it('hectaresFromFarm converts acres', () => {
    const h = hectaresFromFarm({ farmSizeAcres: 4.942 });
    expect(h).toBeCloseTo(2, 2);
  });

  it('hectaresFromFarm converts landSizeValue + unit', () => {
    expect(hectaresFromFarm({ landSizeValue: 10000, landSizeUnit: 'SQUARE_METER' }))
      .toBe(1);
    expect(hectaresFromFarm({ landSizeValue: 5, landSizeUnit: 'HECTARE' }))
      .toBe(5);
  });

  it('hectaresFromFarm returns 0 for empty / zero values', () => {
    expect(hectaresFromFarm({})).toBe(0);
    expect(hectaresFromFarm(null)).toBe(0);
    expect(hectaresFromFarm({ farmSizeAcres: 0 })).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Crop distribution
// ═══════════════════════════════════════════════════════════════
describe('computeCropDistribution', () => {
  it('returns [] on empty input', () => {
    expect(computeCropDistribution([])).toEqual([]);
  });

  it('counts farms per crop + computes shares', () => {
    const dist = computeCropDistribution([
      { crop: 'MAIZE' }, { crop: 'maize' },
      { crop: 'rice' }, { crop: 'rice' }, { crop: 'rice' },
      { crop: 'cassava' },
    ]);
    expect(dist[0].crop).toBe('rice');
    expect(dist[0].farms).toBe(3);
    expect(dist[0].share).toBeCloseTo(3 / 6, 3);
    const maize = dist.find((r) => r.crop === 'maize');
    expect(maize.farms).toBe(2);
  });

  it('drops rows with no crop', () => {
    const dist = computeCropDistribution([
      { crop: 'maize' }, { crop: null }, { crop: '' },
    ]);
    expect(dist.length).toBe(1);
    expect(dist[0].farms).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Yield projection
// ═══════════════════════════════════════════════════════════════
describe('computeYieldProjection', () => {
  it('projects per-crop kg using embedded per-hectare band', () => {
    const farms = [
      { crop: 'maize',   landSizeHectares: 2 },  // 2 × 2500 = 5000
      { crop: 'maize',   landSizeHectares: 3 },  // 3 × 2500 = 7500
      { crop: 'cassava', landSizeHectares: 1 },  // 1 × 12000 = 12000
    ];
    const out = computeYieldProjection(farms);
    expect(out.totalKg).toBe(5000 + 7500 + 12000);
    const maizeRow = out.byCrop.find((r) => r.crop === 'maize');
    expect(maizeRow.farms).toBe(2);
    expect(maizeRow.kg).toBe(12500);
    expect(out.units).toBe('kg');
  });

  it('falls back to GENERIC_KG_PER_HECTARE for unknown crops', () => {
    const out = computeYieldProjection([
      { crop: 'made-up-crop', landSizeHectares: 2 },
    ]);
    expect(out.totalKg).toBe(2 * _internal.GENERIC_KG_PER_HECTARE);
  });

  it('drops farms with zero hectares', () => {
    const out = computeYieldProjection([
      { crop: 'maize', landSizeHectares: 0 },
      { crop: 'maize' },  // no size at all
      { crop: 'maize', landSizeHectares: 1 },
    ]);
    expect(out.byCrop[0].farms).toBe(1);
  });

  it('returns 0 total for empty / all-empty farms', () => {
    expect(computeYieldProjection([]).totalKg).toBe(0);
    expect(computeYieldProjection([{ crop: '' }]).totalKg).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Average score
// ═══════════════════════════════════════════════════════════════
describe('computeAverageScore', () => {
  function snap(farmerId, overall, ts) {
    return {
      farmerId, createdAt: new Date(ts || Date.now()),
      metadata: { kind: 'farroway_score_snapshot', overall },
    };
  }

  it('returns neutral shape when no snapshots', () => {
    expect(computeAverageScore([])).toEqual({ value: null, sampleSize: 0, band: null });
  });

  it('averages latest snapshot per farmer', () => {
    const out = computeAverageScore([
      snap('f1', 60, '2026-05-10'),
      snap('f1', 80, '2026-05-15'),   // newer → wins for f1
      snap('f2', 70, '2026-05-12'),
    ]);
    expect(out.sampleSize).toBe(2);
    expect(out.value).toBe(75);       // (80 + 70) / 2
    expect(out.band).toBe('strong');
  });

  it('assigns band from thresholds', () => {
    expect(computeAverageScore([snap('a', 90)]).band).toBe('excellent');
    expect(computeAverageScore([snap('a', 72)]).band).toBe('strong');
    expect(computeAverageScore([snap('a', 55)]).band).toBe('improving');
    expect(computeAverageScore([snap('a', 30)]).band).toBe('needs_help');
  });

  it('ignores non-score-snapshot metadata', () => {
    const out = computeAverageScore([
      { farmerId: 'f1', createdAt: new Date(),
        metadata: { kind: 'smart_alert', overall: 90 } },
    ]);
    expect(out.sampleSize).toBe(0);
  });

  it('tolerates stringified JSON metadata', () => {
    const out = computeAverageScore([
      { farmerId: 'f1', createdAt: new Date(),
        metadata: JSON.stringify({ kind: 'farroway_score_snapshot', overall: 88 }) },
    ]);
    expect(out.value).toBe(88);
  });
});

// ═══════════════════════════════════════════════════════════════
// Risk indicators
// ═══════════════════════════════════════════════════════════════
describe('computeRiskIndicators', () => {
  function notif(farmerId, type, { meta, read = false, ago = 1 } = {}) {
    return {
      farmerId, notificationType: type, read,
      createdAt: new Date(Date.now() - ago * 24 * 60 * 60 * 1000),
      metadata: meta,
    };
  }

  it('counts unread alerts per type within the window', () => {
    const out = computeRiskIndicators([
      notif('f1', 'market',  { ago: 1 }),
      notif('f1', 'weather', { ago: 2 }),
      notif('f2', 'reminder', { ago: 3, meta: { type: 'pest' } }),
      notif('f3', 'reminder', { ago: 40 }),           // outside 30d
      notif('f4', 'market',   { ago: 1, read: true }),// already read
    ], { windowMs: 30 * 24 * 60 * 60 * 1000 });
    expect(out.marketAlerts).toBe(1);
    expect(out.weatherAlerts).toBe(1);
    expect(out.pestAlerts).toBe(1);
    expect(out.farmersWithPendingAlerts).toBe(2); // f1 + f2
  });

  it('detects pest/disease via reminder + metadata.type', () => {
    const out = computeRiskIndicators([
      notif('f1', 'reminder', { meta: { type: 'disease' } }),
      notif('f2', 'reminder', { meta: { type: 'missed_task' } }),
    ]);
    expect(out.pestAlerts).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// DB wrapper: buildOrganizationDashboard
// ═══════════════════════════════════════════════════════════════
describe('buildOrganizationDashboard', () => {
  function makePrisma({ farmers = [], farms = [], notifications = [] } = {}) {
    return {
      farmer: {
        async findMany({ where, select }) {
          return farmers
            .filter((f) => !where.organizationId || f.organizationId === where.organizationId)
            .map((f) => pickSelect(f, select));
        },
        async count({ where }) {
          return farmers.filter((f) => !where.organizationId || f.organizationId === where.organizationId).length;
        },
      },
      farmProfile: {
        async findMany({ where }) {
          const ids = Array.isArray(where.farmerId?.in) ? new Set(where.farmerId.in) : null;
          return farms.filter((fp) => !ids || ids.has(fp.farmerId));
        },
      },
      farmerNotification: {
        async findMany({ where }) {
          const ids = Array.isArray(where.farmerId?.in) ? new Set(where.farmerId.in) : null;
          return notifications.filter((n) => {
            if (ids && !ids.has(n.farmerId)) return false;
            if (where.notificationType && typeof where.notificationType === 'string'
                && n.notificationType !== where.notificationType) return false;
            if (where.notificationType && where.notificationType.in
                && !where.notificationType.in.includes(n.notificationType)) return false;
            if (where.createdAt?.gte && new Date(n.createdAt) < where.createdAt.gte) return false;
            return true;
          });
        },
      },
    };
  }
  function pickSelect(row, select) {
    if (!select) return { ...row };
    const out = {};
    for (const [k, v] of Object.entries(select)) if (v) out[k] = row[k];
    return out;
  }

  it('returns empty dashboard shape when org has zero farmers', async () => {
    const prisma = makePrisma();
    const out = await buildOrganizationDashboard(prisma, { organizationId: 'org-1' });
    expect(out.totalFarmers).toBe(0);
    expect(out.cropDistribution).toEqual([]);
    expect(out.averageScore.value).toBeNull();
  });

  it('counts active vs inactive correctly', async () => {
    const now = new Date();
    const prisma = makePrisma({
      farmers: [
        { id: 'f1', organizationId: 'org-1', registrationStatus: 'approved', updatedAt: now },
        { id: 'f2', organizationId: 'org-1', registrationStatus: 'approved', updatedAt: now },
        { id: 'f3', organizationId: 'org-1', registrationStatus: 'approved', updatedAt: now },
      ],
      farms: [
        { farmerId: 'f1', crop: 'maize', status: 'active', landSizeHectares: 1 },
        { farmerId: 'f2', crop: 'rice',  status: 'archived', landSizeHectares: 0.5 },
        // f3 has no farm profile → inactive
      ],
    });
    const out = await buildOrganizationDashboard(prisma, { organizationId: 'org-1' });
    expect(out.totalFarmers).toBe(3);
    expect(out.active).toBe(1);
    expect(out.inactive).toBe(2);
  });

  it('aggregates crop distribution + yield projection from farm profiles', async () => {
    const prisma = makePrisma({
      farmers: [
        { id: 'f1', organizationId: 'org-1', updatedAt: new Date() },
        { id: 'f2', organizationId: 'org-1', updatedAt: new Date() },
      ],
      farms: [
        { farmerId: 'f1', crop: 'MAIZE',   status: 'active', landSizeHectares: 2 },
        { farmerId: 'f2', crop: 'cassava', status: 'active', landSizeHectares: 1 },
      ],
    });
    const out = await buildOrganizationDashboard(prisma, { organizationId: 'org-1' });
    const maize = out.cropDistribution.find((r) => r.crop === 'maize');
    expect(maize.farms).toBe(1);
    expect(out.yieldProjection.totalKg).toBe(2 * 2500 + 1 * 12000);
  });

  it('filters notifications by window for risk indicators', async () => {
    const now = new Date();
    const prisma = makePrisma({
      farmers: [{ id: 'f1', organizationId: 'org-1', updatedAt: now }],
      notifications: [
        { farmerId: 'f1', notificationType: 'weather', read: false, createdAt: now, metadata: null },
        { farmerId: 'f1', notificationType: 'weather', read: false,
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), metadata: null },
      ],
    });
    const out = await buildOrganizationDashboard(prisma, { organizationId: 'org-1', windowDays: 30 });
    expect(out.riskIndicators.weatherAlerts).toBe(1);
  });

  it('returns null on missing prisma / org id', async () => {
    expect(await buildOrganizationDashboard(null, { organizationId: 'x' })).toBeNull();
    expect(await buildOrganizationDashboard({}, {})).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// DB wrapper: listOrganizationFarmers
// ═══════════════════════════════════════════════════════════════
describe('listOrganizationFarmers', () => {
  function makePrisma({ farmers, farms = [], notifications = [] }) {
    return {
      farmer: {
        async findMany({ where, skip = 0, take = 50 }) {
          const scoped = farmers.filter((f) => f.organizationId === where.organizationId
            && (!where.region || f.region === where.region));
          return scoped.slice(skip, skip + take);
        },
        async count({ where }) {
          return farmers.filter((f) => f.organizationId === where.organizationId
            && (!where.region || f.region === where.region)).length;
        },
      },
      farmProfile: {
        async findMany({ where }) {
          const ids = Array.isArray(where.farmerId?.in) ? new Set(where.farmerId.in) : null;
          return farms.filter((fp) => !ids || ids.has(fp.farmerId));
        },
      },
      farmerNotification: {
        async findMany({ where }) {
          const ids = Array.isArray(where.farmerId?.in) ? new Set(where.farmerId.in) : null;
          return notifications.filter((n) => (!ids || ids.has(n.farmerId))
            && n.notificationType === where.notificationType);
        },
      },
    };
  }

  it('filters by region', async () => {
    const prisma = makePrisma({
      farmers: [
        { id: 'f1', organizationId: 'org-1', region: 'Ashanti', fullName: 'A', updatedAt: new Date(), createdAt: new Date() },
        { id: 'f2', organizationId: 'org-1', region: 'Lagos',   fullName: 'B', updatedAt: new Date(), createdAt: new Date() },
      ],
    });
    const out = await listOrganizationFarmers(prisma, { organizationId: 'org-1', region: 'Ashanti' });
    expect(out.data.length).toBe(1);
    expect(out.data[0].fullName).toBe('A');
  });

  it('filters by primary crop via farm profiles', async () => {
    const prisma = makePrisma({
      farmers: [
        { id: 'f1', organizationId: 'org-1', fullName: 'A', updatedAt: new Date(), createdAt: new Date() },
        { id: 'f2', organizationId: 'org-1', fullName: 'B', updatedAt: new Date(), createdAt: new Date() },
      ],
      farms: [
        { farmerId: 'f1', crop: 'maize', updatedAt: new Date() },
        { farmerId: 'f2', crop: 'rice',  updatedAt: new Date() },
      ],
    });
    const out = await listOrganizationFarmers(prisma, { organizationId: 'org-1', crop: 'maize' });
    expect(out.data.length).toBe(1);
    expect(out.data[0].primaryCrop).toBe('maize');
  });

  it('filters by score range from latest snapshot', async () => {
    const prisma = makePrisma({
      farmers: [
        { id: 'f1', organizationId: 'org-1', fullName: 'A', updatedAt: new Date(), createdAt: new Date() },
        { id: 'f2', organizationId: 'org-1', fullName: 'B', updatedAt: new Date(), createdAt: new Date() },
      ],
      notifications: [
        { farmerId: 'f1', notificationType: 'system', createdAt: new Date(),
          metadata: { kind: 'farroway_score_snapshot', overall: 90 } },
        { farmerId: 'f2', notificationType: 'system', createdAt: new Date(),
          metadata: { kind: 'farroway_score_snapshot', overall: 40 } },
      ],
    });
    const high = await listOrganizationFarmers(prisma, { organizationId: 'org-1', scoreMin: 70 });
    expect(high.data.length).toBe(1);
    expect(high.data[0].fullName).toBe('A');
    const low = await listOrganizationFarmers(prisma, { organizationId: 'org-1', scoreMax: 50 });
    expect(low.data.length).toBe(1);
    expect(low.data[0].fullName).toBe('B');
  });

  it('rejects missing org', async () => {
    const out = await listOrganizationFarmers({}, {});
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('missing_org');
  });
});

// ═══════════════════════════════════════════════════════════════
// CSV
// ═══════════════════════════════════════════════════════════════
describe('CSV helpers', () => {
  it('escapeCsvField RFC-4180 quotes commas, quotes, newlines', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField('plain')).toBe('plain');
  });

  it('buildFarmersCsv emits header + row per farmer', () => {
    const csv = buildFarmersCsv([
      {
        id: 'f1', fullName: 'Amina "Farmer"', phoneNumber: '+233555', region: 'Ashanti',
        registrationStatus: 'approved', primaryCrop: 'maize',
        score: { overall: 82, band: 'strong', date: '2026-05-15' },
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-05-14T00:00:00Z',
      },
    ]);
    expect(csv).toMatch(/^farmer_id,full_name/);
    expect(csv).toMatch(/"Amina ""Farmer"""/);
    expect(csv).toMatch(/82,strong,2026-05-15/);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('buildDashboardCsv emits summary + crop + yield sections', () => {
    const csv = buildDashboardCsv({
      organizationId: 'org-1',
      totalFarmers: 3, active: 2, inactive: 1,
      averageScore: { value: 75, sampleSize: 2, band: 'strong' },
      riskIndicators: { farmersWithPendingAlerts: 1, marketAlerts: 0, weatherAlerts: 1, pestAlerts: 0 },
      yieldProjection: { totalKg: 5000, byCrop: [{ crop: 'maize', farms: 2, kg: 5000 }], units: 'kg' },
      cropDistribution: [{ crop: 'maize', farms: 2, share: 0.667 }],
      window: { days: 30 },
      generatedAt: '2026-05-15T00:00:00Z',
    });
    expect(csv).toMatch(/total_farmers,3/);
    expect(csv).toMatch(/section,crop_distribution/);
    expect(csv).toMatch(/section,yield_by_crop/);
    expect(csv).toMatch(/maize,2,5000/);
  });
});
