/**
 * FinanceEligibilityEngine — Phase-2 finance/insurance matching core (pure, total).
 *
 * Farroway is NOT a lender or insurer. This engine builds an honest FarmerFinanceProfile
 * from REAL farm activity, estimates eligibility as a LABEL with reasons, and matches only
 * REAL partner offers — behind explicit farmer consent, with every share auditable.
 *
 * HONESTY RULES (gate-locked by check:finance-honesty):
 *   • estimatedYield / estimatedRevenue are `null` + 'no_live_feed' — NEVER fabricated
 *     (FarmBrainState contract). No numeric credit/risk score without a real model —
 *     activityRecord is a label derived from real counts.
 *   • Farmer copy: "Based on your farm record, you may qualify for support." NEVER
 *     "approved" / "guaranteed" / "pre-approved" — banned wording exported + tested.
 *   • No consent → nothing shared, nothing matched ('not_shared').
 *   • No real partner offers → honest empty state, never invented partners.
 *
 * Composes the EXISTING consent runtime (src/runtime/consent) + FundingRuntime; forks neither.
 */
export const BANNED_FINANCE_WORDING = Object.freeze([
  'you are approved', 'approved', 'pre-approved', 'guaranteed', 'instant loan', 'credit score',
]);

export const FARMER_ELIGIBILITY_COPY = Object.freeze({
  possible: { key: 'finance.eligibility.possible', message: 'Based on your farm record, you may qualify for support.' },
  insufficient_record: { key: 'finance.eligibility.insufficient', message: 'Keep recording your farm activity — more history helps you qualify for support.' },
  not_shared: { key: 'finance.eligibility.notShared', message: 'Your farm record is private. Give consent to check support options.' },
  unknown: { key: 'finance.eligibility.unknown', message: 'We could not check support options right now.' },
});

export interface FinanceProfileInputs {
  farmerId?: string | null;
  farmId?: string | null;
  cropCount?: number;            // real crops on record
  harvestCount?: number;         // real HarvestReport rows
  scanCount?: number;            // real scans
  taskCompletionRate?: number | null; // 0..1, real
  marketplaceActivityCount?: number;  // real listings/sales
  seasonsRecorded?: number;      // real FarmSeason rows
}

const _n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Build the profile from REAL activity only. Yield/revenue honestly unavailable. */
export function buildFinanceProfile(inputs: FinanceProfileInputs | null | undefined) {
  const i = inputs && typeof inputs === 'object' ? inputs : {};
  const crops = _n(i.cropCount), harvests = _n(i.harvestCount), scans = _n(i.scanCount);
  const market = _n(i.marketplaceActivityCount), seasons = _n(i.seasonsRecorded);
  const tcr = (typeof i.taskCompletionRate === 'number' && i.taskCompletionRate >= 0 && i.taskCompletionRate <= 1)
    ? i.taskCompletionRate : null;
  const points = (crops > 0 ? 1 : 0) + (harvests > 0 ? 2 : 0) + (scans >= 3 ? 1 : 0)
    + (tcr != null && tcr >= 0.5 ? 1 : 0) + (market > 0 ? 1 : 0) + (seasons >= 2 ? 1 : 0);
  const activityRecord = points >= 5 ? 'strong' : points >= 3 ? 'growing' : points >= 1 ? 'limited' : 'none';
  return Object.freeze({
    farmerId: i.farmerId || null, farmId: i.farmId || null,
    cropCount: crops, harvestCount: harvests, scanCount: scans,
    taskCompletionRate: tcr, marketplaceActivityCount: market, seasonsRecorded: seasons,
    estimatedYield: null, estimatedYieldStatus: 'no_live_feed',       // NEVER fabricated
    estimatedRevenue: null, estimatedRevenueStatus: 'no_live_feed',   // NEVER fabricated
    activityRecord,                                                   // label, not a score
  });
}

export type FinanceProfile = ReturnType<typeof buildFinanceProfile>;

/** Eligibility is a LABEL + reasons — never an approval. Consent gates everything. */
export function estimateEligibility(profile: FinanceProfile | null, consentGranted: boolean) {
  if (consentGranted !== true) {
    return Object.freeze({ label: 'not_shared', reasons: Object.freeze(['consent_not_granted']),
      copy: FARMER_ELIGIBILITY_COPY.not_shared, sharable: false });
  }
  if (!profile) {
    return Object.freeze({ label: 'unknown', reasons: Object.freeze(['no_profile']),
      copy: FARMER_ELIGIBILITY_COPY.unknown, sharable: false });
  }
  const reasons: string[] = [];
  if (profile.harvestCount > 0) reasons.push('recorded_harvests');
  if (profile.taskCompletionRate != null && profile.taskCompletionRate >= 0.5) reasons.push('consistent_task_completion');
  if (profile.scanCount >= 3) reasons.push('active_crop_monitoring');
  if (profile.marketplaceActivityCount > 0) reasons.push('marketplace_activity');
  const label = (profile.activityRecord === 'strong' || profile.activityRecord === 'growing')
    ? 'possible' : 'insufficient_record';
  return Object.freeze({
    label, reasons: Object.freeze(reasons),
    copy: label === 'possible' ? FARMER_ELIGIBILITY_COPY.possible : FARMER_ELIGIBILITY_COPY.insufficient_record,
    sharable: label === 'possible',
  });
}

export interface PartnerOffer {
  partnerId: string; type: 'loan' | 'insurance' | 'grant' | 'input_credit';
  amount?: number | null; terms?: string; eligibilityReason?: string;
  status?: string; expiresAt?: string | null;
}

/** Match only REAL offers, only with consent. Empty in → honest empty out. */
export function matchPartnerOffers(profile: FinanceProfile | null, offers: PartnerOffer[] | null | undefined, consentGranted: boolean) {
  if (consentGranted !== true || !profile) return Object.freeze([]);
  const list = Array.isArray(offers) ? offers : [];
  return Object.freeze(list.filter((o) => o && typeof o.partnerId === 'string' && o.partnerId.length > 0
    && ['loan', 'insurance', 'grant', 'input_credit'].includes(o.type)
    && (!o.expiresAt || (function () { try { return new Date(o.expiresAt as string).getTime() > Date.now(); } catch { return false; } })())));
}

/** Audit event for every data-share (§7 shape). Pure builder; caller persists via eventRuntime. */
export function financeAuditEvent(kind: string, ctx: { actor?: string; tenantId?: string | null; correlationId?: string | null; detail?: string }) {
  const c = ctx || {};
  return Object.freeze({
    id: 'finevt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    type: String(kind || 'finance.event'),
    timestamp: new Date().toISOString(),
    actor: c.actor || 'farmer',
    tenantId: c.tenantId || null,
    correlationId: c.correlationId || null,
    detail: (c.detail || '').slice(0, 200),
  });
}

const _module = { BANNED_FINANCE_WORDING, FARMER_ELIGIBILITY_COPY, buildFinanceProfile, estimateEligibility, matchPartnerOffers, financeAuditEvent };
export default _module;
