/**
 * FinanceEligibilityEngine.test — locks the Phase-2 finance honesty contract:
 * consent gates everything, never an approval, never fabricated yield/revenue,
 * never invented partners, audit events carry the §7 shape. `npx tsx …`.
 */
import {
  buildFinanceProfile, estimateEligibility, matchPartnerOffers,
  financeAuditEvent, BANNED_FINANCE_WORDING, FARMER_ELIGIBILITY_COPY,
} from '../FinanceEligibilityEngine.js';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// profile from REAL activity; yield/revenue honestly unavailable
const p = buildFinanceProfile({ farmerId: 'f1', cropCount: 2, harvestCount: 3, scanCount: 5,
  taskCompletionRate: 0.8, marketplaceActivityCount: 1, seasonsRecorded: 2 });
ok(p.estimatedYield === null && p.estimatedYieldStatus === 'no_live_feed', 'yield NEVER fabricated');
ok(p.estimatedRevenue === null && p.estimatedRevenueStatus === 'no_live_feed', 'revenue NEVER fabricated');
ok(p.activityRecord === 'strong', 'real activity → strong record label (no numeric score)');
ok(!('riskScore' in p), 'no fabricated numeric risk score field');

// consent gates EVERYTHING
const noConsent = estimateEligibility(p, false);
ok(noConsent.label === 'not_shared' && noConsent.sharable === false, 'no consent → not_shared, nothing sharable');
ok(matchPartnerOffers(p, [{ partnerId: 'bank1', type: 'loan' }], false).length === 0, 'no consent → zero offers matched');

// eligibility is a label + reasons — never approval wording
const el = estimateEligibility(p, true);
ok(el.label === 'possible' && el.reasons.includes('recorded_harvests'), 'strong record → possible + real reasons');
ok(/may qualify/.test(el.copy.message), 'farmer copy says "may qualify"');
for (const c of Object.values(FARMER_ELIGIBILITY_COPY))
  ok(!BANNED_FINANCE_WORDING.some((b) => c.message.toLowerCase().includes(b)), 'copy never contains banned wording: ' + c.key);

// thin record → insufficient, honestly
const thin = estimateEligibility(buildFinanceProfile({ cropCount: 1 }), true);
ok(thin.label === 'insufficient_record' && thin.sharable === false, 'thin record → insufficient, not sharable');

// offers: only REAL ones; empty in → honest empty out; expired filtered
ok(matchPartnerOffers(p, [], true).length === 0, 'no real offers → honest empty state (never invented)');
ok(matchPartnerOffers(p, null, true).length === 0, 'null offers → empty, never throws');
const offers = matchPartnerOffers(p, [
  { partnerId: 'bank1', type: 'loan' },
  { partnerId: '', type: 'loan' } as any,
  { partnerId: 'ins1', type: 'insurance', expiresAt: '2000-01-01T00:00:00Z' },
], true);
ok(offers.length === 1 && offers[0].partnerId === 'bank1', 'invalid + expired offers filtered; only real remain');

// audit event carries §7 shape
const ev = financeAuditEvent('FinanceConsentGranted', { actor: 'farmer', tenantId: 't1', correlationId: 'scan-x' });
ok(!!ev.id && !!ev.timestamp && ev.actor === 'farmer' && ev.tenantId === 't1' && ev.correlationId === 'scan-x',
  'audit event has id/timestamp/actor/tenantId/correlationId');

// totality
ok(estimateEligibility(null as any, true).label === 'unknown', 'null profile → unknown, never throws');
ok(buildFinanceProfile(null).activityRecord === 'none', 'null inputs → none record, never throws');

console.log('[FinanceEligibilityEngine] PASS — ' + passed + ' assertions. Consent-gated, label-only '
  + 'eligibility; no approvals, no fabricated yield/revenue/score, no invented partners; audit shape correct.');
