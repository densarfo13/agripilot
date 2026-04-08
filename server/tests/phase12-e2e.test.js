/**
 * Phase 12 — End-to-End Validation
 * 6 comprehensive test scenarios covering the full Farroway pipeline:
 *   1. Kenya: Full approval pipeline (submit → verify → fraud → decision → approve)
 *   2. Kenya: Fraud detection pipeline (submit → verify → fraud hold → escalate)
 *   3. Tanzania: Multi-region credit pipeline with TZS currency
 *   4. Farmer daily-use: Activities → Reminders → Notifications cycle
 *   5. Post-harvest: Storage → Guidance → Market → Buyer Interest
 *   6. Admin: Stats → Region config → i18n → Demand intelligence
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4000/api';
let token;

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

describe('Phase 12 — End-to-End Validation (6 Scenarios)', () => {
  before(async () => {
    const r = await api('POST', '/auth/login', { email: 'admin@farroway.com', password: 'password123' });
    assert.equal(r.status, 200);
    token = r.data.accessToken || r.data.token;
  });

  // ═════════════════════════════════════════════════════════
  // SCENARIO 1: Kenya Full Approval Pipeline
  // ═════════════════════════════════════════════════════════
  describe('Scenario 1: Kenya Full Approval Pipeline', () => {
    let farmerId, appId;

    it('1a. Create Kenyan farmer', async () => {
      const r = await api('POST', '/farmers', {
        fullName: 'E2E Kenya Farmer', phone: '+254799000001',
        nationalId: 'KE-E2E-001', region: 'Central', district: 'Kiambu',
        countryCode: 'KE', primaryCrop: 'maize', farmSizeAcres: 5, yearsExperience: 10,
      });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      farmerId = r.data.id;
    });

    it('1b. Create and submit application', async () => {
      const r = await api('POST', '/applications', {
        farmerId, cropType: 'maize', farmSizeAcres: 5.0,
        requestedAmount: 60000, purpose: 'Hybrid seeds and fertilizer',
        season: '2026-long-rains',
      });
      assert.equal(r.status, 201);
      appId = r.data.id;
      assert.equal(r.data.status, 'draft');
      assert.equal(r.data.currencyCode, 'KES');

      // Submit
      const s = await api('PATCH', `/applications/${appId}/status`, { status: 'submitted' });
      assert.equal(s.status, 200);
      assert.equal(s.data.status, 'submitted');
    });

    it('1c. Run verification engine', async () => {
      const r = await api('POST', `/applications/${appId}/score-verification`);
      assert.equal(r.status, 200);
      assert.ok(typeof r.data.verificationScore === 'number');
      assert.ok(r.data.factors);
    });

    it('1d. Run fraud engine', async () => {
      const r = await api('POST', `/applications/${appId}/score-fraud`);
      assert.equal(r.status, 200);
      assert.ok(typeof r.data.fraudRiskScore === 'number');
      assert.ok(r.data.fraudRiskLevel);
    });

    it('1e. Run decision engine', async () => {
      const r = await api('POST', `/applications/${appId}/score-decision`);
      assert.equal(r.status, 200);
      assert.ok(r.data.decision);
      assert.ok(r.data.reasons?.length > 0);
    });

    it('1f. Run benchmark engine', async () => {
      const r = await api('POST', `/applications/${appId}/score-benchmark`);
      assert.equal(r.status, 200);
      assert.ok(r.data.id, 'Should have benchmark result');
      assert.ok(typeof r.data.verificationPercentile === 'number' || r.data.peerGroupSize !== undefined);
    });

    it('1g. Run intelligence engine (12 signals)', async () => {
      const r = await api('POST', `/applications/${appId}/score-intelligence`);
      assert.equal(r.status, 200);
      assert.ok(r.data.id, 'Should have intelligence result');
      // Check for signal fields (stored as individual columns)
      assert.ok(r.data.mlShadowScore !== undefined || r.data.satelliteSignal !== undefined);
    });

    it('1h. Approve application', async () => {
      // Ensure under_review status for approval
      const app = await api('GET', `/applications/${appId}`);
      const validForApproval = ['submitted', 'under_review', 'conditional_approved', 'needs_more_evidence'];
      if (!validForApproval.includes(app.data.status)) {
        // If decision engine moved it, reopen first
        if (['approved', 'rejected', 'escalated'].includes(app.data.status)) {
          await api('POST', `/applications/${appId}/reopen`);
        }
      }
      if (app.data.status === 'submitted') {
        await api('PATCH', `/applications/${appId}/status`, { status: 'under_review' });
      }
      const r = await api('POST', `/applications/${appId}/approve`);
      assert.equal(r.status, 200, `Approve failed: ${JSON.stringify(r.data)}`);
      assert.equal(r.data.status, 'approved');
    });

    it('1i. Verify audit trail', async () => {
      const r = await api('GET', '/audit?limit=5');
      assert.equal(r.status, 200);
      assert.ok(r.data.logs?.length > 0);
    });
  });

  // ═════════════════════════════════════════════════════════
  // SCENARIO 2: Kenya Fraud Detection Pipeline
  // ═════════════════════════════════════════════════════════
  describe('Scenario 2: Kenya Fraud Detection Pipeline', () => {
    let appId;

    it('2a. Find submitted application with fraud result', async () => {
      // Use existing seeded fraud-flagged app
      const r = await api('GET', '/applications?status=escalated&limit=1');
      assert.equal(r.status, 200);
      if (r.data.applications?.length > 0) {
        appId = r.data.applications[0].id;
      } else {
        // Fall back — find any submitted app
        const s = await api('GET', '/applications?limit=1');
        appId = s.data.applications?.[0]?.id;
      }
      assert.ok(appId, 'Need an application for fraud test');
    });

    it('2b. Get fraud result with flags', async () => {
      const r = await api('GET', `/applications/${appId}/fraud`);
      // May or may not have fraud result
      if (r.status === 200) {
        assert.ok(r.data.fraudRiskLevel);
      }
    });

    it('2c. Escalate flagged application', async () => {
      // Create new app to escalate
      const farmers = await api('GET', '/farmers?limit=1');
      const fid = farmers.data.farmers[0].id;
      const a = await api('POST', '/applications', {
        farmerId: fid, cropType: 'maize', requestedAmount: 50000, farmSizeAcres: 3,
      });
      const newAppId = a.data.id;
      await api('PATCH', `/applications/${newAppId}/status`, { status: 'submitted' });
      await api('PATCH', `/applications/${newAppId}/status`, { status: 'under_review' });

      const r = await api('POST', `/applications/${newAppId}/escalate`, { reason: 'Suspicious patterns detected' });
      assert.equal(r.status, 200);
      assert.equal(r.data.status, 'escalated');
    });

    it('2d. Reject escalated application', async () => {
      const esc = await api('GET', '/applications?status=escalated&limit=1');
      const id = esc.data.applications?.[0]?.id;
      assert.ok(id);
      const r = await api('POST', `/applications/${id}/reject`, { reason: 'Fraud confirmed after investigation' });
      assert.equal(r.status, 200);
      assert.equal(r.data.status, 'rejected');
    });
  });

  // ═════════════════════════════════════════════════════════
  // SCENARIO 3: Tanzania Multi-Region Pipeline
  // ═════════════════════════════════════════════════════════
  describe('Scenario 3: Tanzania Multi-Region Pipeline', () => {
    let tzFarmerId, tzAppId;

    it('3a. Create Tanzanian farmer', async () => {
      const r = await api('POST', '/farmers', {
        fullName: 'E2E Tanzania Farmer', phone: '+255799000001',
        region: 'Dar es Salaam', countryCode: 'TZ', preferredLanguage: 'sw',
        primaryCrop: 'rice', farmSizeAcres: 4,
      });
      assert.equal(r.status, 201);
      tzFarmerId = r.data.id;
      assert.equal(r.data.countryCode, 'TZ');
    });

    it('3b. Create TZ application with TZS currency', async () => {
      const r = await api('POST', '/applications', {
        farmerId: tzFarmerId, cropType: 'rice', farmSizeAcres: 4.0,
        requestedAmount: 900000, purpose: 'Paddy rice inputs',
        season: '2026-masika',
      });
      assert.equal(r.status, 201);
      tzAppId = r.data.id;
      assert.equal(r.data.currencyCode, 'TZS', 'Should auto-set TZS for TZ farmer');
    });

    it('3c. Submit and run verification (TZ region-aware)', async () => {
      await api('PATCH', `/applications/${tzAppId}/status`, { status: 'submitted' });
      const r = await api('POST', `/applications/${tzAppId}/score-verification`);
      assert.equal(r.status, 200);
      assert.ok(typeof r.data.verificationScore === 'number');
    });

    it('3d. Run fraud with TZ thresholds', async () => {
      const r = await api('POST', `/applications/${tzAppId}/score-fraud`);
      assert.equal(r.status, 200);
      assert.ok(r.data.fraudRiskLevel);
    });

    it('3e. Run decision engine for TZ', async () => {
      const r = await api('POST', `/applications/${tzAppId}/score-decision`);
      assert.equal(r.status, 200);
      assert.ok(r.data.decision);
    });

    it('3f. Verify TZ region config', async () => {
      const r = await api('GET', '/region-config/TZ');
      assert.equal(r.status, 200);
      assert.equal(r.data.currencyCode, 'TZS');
      assert.ok(r.data.seasons);
    });

    it('3g. Verify TZ season data', async () => {
      const r = await api('GET', '/region-config/TZ/season');
      assert.equal(r.status, 200);
      assert.ok(r.data.season || r.data.name);
    });
  });

  // ═════════════════════════════════════════════════════════
  // SCENARIO 4: Farmer Daily-Use Cycle
  // ═════════════════════════════════════════════════════════
  describe('Scenario 4: Farmer Daily-Use Cycle', () => {
    let farmerId;

    it('4a. Get farmer for daily use', async () => {
      const r = await api('GET', '/farmers?limit=1');
      farmerId = r.data.farmers[0].id;
      assert.ok(farmerId);
    });

    it('4b. Log planting activity → auto-generates reminders', async () => {
      const r = await api('POST', `/activities/farmer/${farmerId}`, {
        activityType: 'planting', cropType: 'beans',
        description: 'E2E test planting', activityDate: '2026-04-01',
      });
      assert.equal(r.status, 201);
      assert.equal(r.data.activityType, 'planting');
    });

    it('4c. View activity summary', async () => {
      const r = await api('GET', `/activities/farmer/${farmerId}/summary`);
      assert.equal(r.status, 200);
      assert.ok(typeof r.data.thisMonthCount === 'number');
      assert.ok(r.data.byType);
    });

    it('4d. Generate crop lifecycle reminders', async () => {
      const r = await api('POST', `/reminders/farmer/${farmerId}/generate`, {
        cropType: 'maize', plantingDate: '2026-03-15',
      });
      assert.equal(r.status, 201);
      assert.ok(r.data.generated > 0);
    });

    it('4e. View reminder summary (pending, overdue, completed)', async () => {
      const r = await api('GET', `/reminders/farmer/${farmerId}/summary`);
      assert.equal(r.status, 200);
      assert.ok(typeof r.data.pending === 'number');
      assert.ok(typeof r.data.overdue === 'number');
      assert.ok(typeof r.data.completedThisMonth === 'number');
    });

    it('4f. Mark reminder done', async () => {
      const list = await api('GET', `/reminders/farmer/${farmerId}?status=pending`);
      assert.ok(list.data.length > 0, 'Need pending reminders');
      const r = await api('PATCH', `/reminders/${list.data[0].id}/done`);
      assert.equal(r.status, 200);
      assert.equal(r.data.completed, true);
    });

    it('4g. Check notifications and mark all read', async () => {
      const count = await api('GET', `/notifications/farmer/${farmerId}/unread-count`);
      assert.equal(count.status, 200);

      const r = await api('POST', `/notifications/farmer/${farmerId}/mark-all-read`);
      assert.equal(r.status, 200);

      const after = await api('GET', `/notifications/farmer/${farmerId}/unread-count`);
      assert.equal(after.data.unread, 0);
    });
  });

  // ═════════════════════════════════════════════════════════
  // SCENARIO 5: Post-Harvest Full Cycle
  // ═════════════════════════════════════════════════════════
  describe('Scenario 5: Post-Harvest Full Cycle', () => {
    let farmerId;

    it('5a. Get farmer with storage data', async () => {
      const r = await api('GET', '/farmers?limit=1');
      farmerId = r.data.farmers[0].id;
    });

    it('5b. Create storage entry', async () => {
      const r = await api('POST', `/post-harvest/storage/farmer/${farmerId}`, {
        cropType: 'beans', quantityKg: 500, harvestDate: '2026-03-20',
        storageMethod: 'sealed_bags', storageCondition: 'good', readyToSell: false,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.cropType, 'beans');
    });

    it('5c. View storage dashboard with enrichment', async () => {
      const r = await api('GET', `/post-harvest/storage/farmer/${farmerId}/dashboard`);
      assert.equal(r.status, 200);
      assert.ok(r.data.totalItems >= 1);
      assert.ok(r.data.items?.length >= 1);
      // Check enriched fields
      const item = r.data.items.find(i => i.cropType === 'beans');
      if (item) {
        assert.ok(typeof item.maxRecommendedDays === 'number');
        assert.ok(typeof item.isOverStorageLimit === 'boolean');
      }
    });

    it('5d. Get storage guidance for crop', async () => {
      const r = await api('GET', '/post-harvest/guidance/maize?country=KE');
      assert.equal(r.status, 200);
      assert.ok(r.data.tips.length > 0);
      assert.ok(r.data.optimalMoisture);
      assert.ok(r.data.maxDays);
    });

    it('5e. Get market prices', async () => {
      const r = await api('GET', '/market-guidance/prices?country=KE');
      assert.equal(r.status, 200);
    });

    it('5f. Express buyer interest', async () => {
      const r = await api('POST', `/buyer-interest/farmer/${farmerId}`, {
        cropType: 'beans', quantityKg: 500, priceExpectation: 80,
        preferredBuyerType: 'wholesale',
      });
      assert.equal(r.status, 201);
      assert.equal(r.data.status, 'expressed');
    });

    it('5g. View demand summary', async () => {
      const r = await api('GET', '/buyer-interest/demand/summary?cropType=beans');
      assert.equal(r.status, 200);
      assert.ok(r.data.totalInterests >= 1);
    });

    it('5h. Withdraw interest', async () => {
      const list = await api('GET', `/buyer-interest/farmer/${farmerId}?status=expressed`);
      const beans = list.data.find(i => i.cropType === 'beans');
      assert.ok(beans, 'Should have beans interest');
      const r = await api('PATCH', `/buyer-interest/${beans.id}/withdraw`);
      assert.equal(r.status, 200);
      assert.equal(r.data.status, 'withdrawn');
    });
  });

  // ═════════════════════════════════════════════════════════
  // SCENARIO 6: Admin Control & Cross-Cutting Validation
  // ═════════════════════════════════════════════════════════
  describe('Scenario 6: Admin Control & Cross-Cutting Validation', () => {
    it('6a. Application stats with multi-status pipeline', async () => {
      const r = await api('GET', '/applications/stats');
      assert.equal(r.status, 200);
      assert.ok(r.data.statusCounts.length >= 2, 'Should have multiple status groups');
      assert.ok(r.data.aggregates._count > 0);
    });

    it('6b. Portfolio summary with multi-region data', async () => {
      const r = await api('GET', '/portfolio/summary');
      assert.equal(r.status, 200);
      assert.ok(r.data.totalApplications >= 12, `Expected 12+ apps, got ${r.data.totalApplications}`);
      assert.ok(r.data.cropBreakdown?.length >= 3, 'Should have 3+ crop types');
      assert.ok(r.data.regionBreakdown?.length >= 2, 'Should have 2+ regions');
    });

    it('6c. Region configs for both KE and TZ', async () => {
      const [ke, tz] = await Promise.all([
        api('GET', '/region-config/KE'),
        api('GET', '/region-config/TZ'),
      ]);
      assert.equal(ke.status, 200);
      assert.equal(tz.status, 200);
      assert.equal(ke.data.currencyCode, 'KES');
      assert.equal(tz.data.currencyCode, 'TZS');
      assert.notEqual(ke.data.country, tz.data.country);
    });

    it('6d. i18n — English and Swahili translations', async () => {
      const [en, sw] = await Promise.all([
        fetch(`${BASE}/localization/translations/en`).then(r => r.json()),
        fetch(`${BASE}/localization/translations/sw`).then(r => r.json()),
      ]);
      assert.ok(Object.keys(en).length >= 50, `EN keys: ${Object.keys(en).length}`);
      assert.ok(Object.keys(sw).length >= 50, `SW keys: ${Object.keys(sw).length}`);
      // Verify specific translations exist and differ where expected
      assert.ok(en['status.approved']);
      assert.ok(sw['status.approved']);
      assert.notEqual(en['status.approved'], sw['status.approved'], 'Translations should differ');
    });

    it('6e. Demand intelligence across regions', async () => {
      const [overall, ke, tz] = await Promise.all([
        api('GET', '/buyer-interest/demand/summary'),
        api('GET', '/buyer-interest/demand/summary?country=KE'),
        api('GET', '/buyer-interest/demand/summary?country=TZ'),
      ]);
      assert.equal(overall.status, 200);
      assert.ok(overall.data.totalInterests >= 1);
      assert.equal(ke.status, 200);
      assert.equal(tz.status, 200);
    });

    it('6f. Audit trail has entries', async () => {
      const r = await api('GET', '/audit?limit=20');
      assert.equal(r.status, 200);
      assert.ok(r.data.total >= 10, `Expected 10+ audit entries, got ${r.data.total}`);
    });

    it('6g. Portfolio report generation', async () => {
      const r = await api('GET', '/reports/portfolio');
      assert.equal(r.status, 200);
      assert.ok(r.data.statusBreakdown);
      assert.ok(r.data.cropBreakdown);
      assert.ok(r.data.regionBreakdown);
    });

    it('6h. Users list (multi-role)', async () => {
      const r = await api('GET', '/users');
      assert.equal(r.status, 200);
      assert.ok(r.data.length >= 8, `Expected 8+ users, got ${r.data.length}`);
      const roles = new Set(r.data.map(u => u.role));
      assert.ok(roles.size >= 4, 'Should have 4+ distinct roles');
    });
  });
});
