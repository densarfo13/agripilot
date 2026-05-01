/**
 * insightsEngine.js — pure aggregator that turns the data Farroway
 * has already captured (crops, location, listings, buyer interests,
 * recurring orders, scan history, daily completions) into a small,
 * ranked list of insights for the Home digest.
 *
 *   buildInsights({ profile, activeFarm, buyerId, now? }) → {
 *     primaryCrop:    string | null,
 *     primaryRegion:  string | null,
 *     primaryCountry: string | null,
 *     trust:          { level: 0..3, badges: string[] },
 *     insights:       Array<Insight>,
 *   }
 *
 *   Insight = {
 *     id:    string,
 *     kind:  'demand' | 'price' | 'activity' | 'top_crop' | 'trust' | 'recurring',
 *     icon:  string,                 // single Unicode glyph
 *     title: string,                 // localized via tStrict
 *     value: string,                 // localized via tStrict
 *     meta?: string,                 // optional sub-line
 *     tone:  'positive' | 'neutral' | 'attention',
 *   }
 *
 * Sources (all existing — no new persistence):
 *   • marketStore.getActiveListings   → primary crop discovery
 *   • marketStore.getBuyerInterests   → recent activity per crop
 *   • marketDemand.getDemandForCrop   → demand level + count
 *   • priceEngine.getReferencePrice   → price suggestion
 *   • topCropStats.getTopCrops        → top-selling crop in window
 *   • sellerReputation.computeSellerReputation → activity badges
 *   • verificationStore.getMaxLevelForAction   → trust level
 *   • engagementHistory.getRecentCompletions   → activity signal
 *   • recurringOrders.getRecurringOrdersForBuyer
 *
 * Strict-rule audit
 *   • Pure function — never writes storage; never throws.
 *   • Each insight self-suppresses when its source data is empty
 *     so the digest is "always relevant or absent" — never noisy.
 *   • Capped to 5 insights so the digest never overflows the card.
 */

import { tStrict } from '../i18n/strictT.js';
import { getActiveListings, getBuyerInterests } from '../market/marketStore.js';
import { getDemandForCrop } from '../market/marketDemand.js';
import { getReferencePrice } from '../lib/pricing/priceEngine.js';
import { getTopCrops } from '../market/topCropStats.js';
import { computeSellerReputation } from '../market/sellerReputation.js';
import { getRecurringOrdersForBuyer } from '../market/recurringOrders.js';
import { getCompletedInsightIds } from './insightCompletions.js';

// Spec §2: max 3 visible at a time. The engine produces every
// candidate then sorts by priority and slices.
const MAX_INSIGHTS = 3;

// Spec §3 priority weights (descending). Money first, then
// urgency, then activity, then informational.
const PRIORITY = Object.freeze({
  money:      100,
  urgency:     80,
  activity:    60,
  info:        40,
  trust:       20,
});

function _norm(s) { return String(s || '').trim().toLowerCase(); }

function _capitalize(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function _safeReadJsonArray(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/**
 * hasMeaningfulData — controlled-rollout gate. Returns `true` when
 * the user has produced enough activity for insights to be honest.
 *
 *   • Has any farm (profile / active farm / owned listing)
 *   • OR has any recent engagement completion
 *   • OR has any owned listing
 *   • OR has any submitted buyer interest
 *
 * Returns `false` for a brand-new install. Callers use this to
 * show a calm "Start using Farroway to get insights" empty state
 * instead of fabricating signals from no data.
 */
export function hasMeaningfulData({
  profile = {},
  activeFarm = null,
  farmerId = '',
  buyerId = '',
} = {}) {
  // Farm check (cheap; no localStorage read).
  const hasFarm = Boolean(
    profile?.farmId
    || activeFarm?.id
    || profile?.farmerId,
  );
  if (hasFarm) return true;

  // Activity check — engagement completion in the last 60 days.
  try {
    const completions = _safeReadJsonArray('farroway_engagement_history');
    if (completions.some((c) => {
      const t = Date.parse(c?.completedAt || '');
      return Number.isFinite(t)
        && t >= Date.now() - 60 * 86_400_000;
    })) return true;
  } catch { /* swallow */ }

  // Listings owned by this farmer.
  if (farmerId) {
    try {
      const listings = _safeReadJsonArray('farroway_market_listings');
      if (listings.some((l) => l && String(l.farmerId || '') === String(farmerId))) {
        return true;
      }
    } catch { /* swallow */ }
  }

  // Interests submitted by this buyer.
  if (buyerId) {
    try {
      const interests = _safeReadJsonArray('farroway_buyer_interests');
      if (interests.some((i) => i && String(i.buyerId || '') === String(buyerId))) {
        return true;
      }
    } catch { /* swallow */ }
  }

  return false;
}

function _resolvePrimaryCrop(profile, activeFarm, listings) {
  // Order: profile preference → active farm crop → newest listing
  // crop. We read the canonical `crop` field only — legacy
  // crop-id variants are normalized at the read boundary by callers
  // (canonicalizeFarmPayload), so this engine never needs them.
  const candidates = [
    profile?.crop,
    profile?.plantId,
    activeFarm?.crop,
    activeFarm?.plantId,
    listings?.[0]?.crop,
  ];
  for (const c of candidates) {
    const v = _norm(c);
    if (v) return v;
  }
  return null;
}

function _trustForUser(farmerId) {
  const out = { level: 0, badges: [] };
  if (!farmerId) return out;
  // Verification store reads — lazy-imported via direct localStorage
  // to avoid an import cycle (the verificationStore module is sync
  // but heavy, and the moat surface should stay light to import).
  try {
    const rows = _safeReadJsonArray('farroway_verifications');
    let max = 0;
    for (const r of rows) {
      if (!r || String(r.farmerId || '') !== String(farmerId)) continue;
      const lvl = Number(r.level || 0);
      if (Number.isFinite(lvl) && lvl > max) max = lvl;
    }
    out.level = Math.max(0, Math.min(3, max));
  } catch { /* swallow */ }

  try {
    const rep = computeSellerReputation(farmerId);
    if (rep && Array.isArray(rep.badges)) out.badges = rep.badges;
  } catch { /* swallow */ }

  return out;
}

function _activityCountSinceMs(records, sinceMs, key = 'createdAt') {
  if (!Array.isArray(records)) return 0;
  let n = 0;
  for (const r of records) {
    const t = Date.parse(r?.[key] || '');
    if (Number.isFinite(t) && t >= sinceMs) n += 1;
  }
  return n;
}

/**
 * @param {object} args
 * @param {object} [args.profile]
 * @param {object} [args.activeFarm]
 * @param {string} [args.buyerId]    optional — surfaces buyer-side recurring
 * @param {string} [args.farmerId]   optional — surfaces seller-side trust
 * @param {number} [args.now]
 * @returns {object}
 */
export function buildInsights({
  profile = {},
  activeFarm = null,
  buyerId = '',
  farmerId = '',
  now = Date.now(),
} = {}) {
  let listings = [];
  try { listings = getActiveListings() || []; } catch { listings = []; }
  const myFarmerId = String(farmerId
    || profile?.userId
    || profile?.farmerId
    || activeFarm?.farmerId
    || '');
  const myListings = listings.filter((l) =>
    l && String(l.farmerId || '') === myFarmerId);

  const primaryCrop = _resolvePrimaryCrop(profile, activeFarm, myListings);
  const primaryCountry = String(
    activeFarm?.country
    || activeFarm?.location?.country
    || profile?.country
    || '',
  );
  const primaryRegion = String(
    activeFarm?.region
    || activeFarm?.location?.region
    || profile?.region
    || '',
  );

  const insights = [];
  const sevenDaysMs = now - 7 * 86_400_000;

  // ── Demand insight (uses captured buyer-interests) ─────────
  if (primaryCrop) {
    let demand = { count: 0, level: 'low' };
    try {
      demand = getDemandForCrop({
        crop:    primaryCrop,
        country: primaryCountry,
        region:  primaryRegion,
      }) || demand;
    } catch { /* swallow */ }
    if (demand.count > 0) {
      const cropLabel = _capitalize(primaryCrop);
      const tonalKey = demand.level === 'high'
        ? 'positive' : demand.level === 'low' ? 'attention' : 'neutral';
      insights.push({
        id:    'demand_primary',
        kind:  'demand',
        icon:  '\uD83D\uDCC8',
        title: tStrict('insights.demand.title', 'Demand for {crop}')
          .replace('{crop}', cropLabel),
        value: tStrict(
          `insights.demand.value.${demand.level}`,
          demand.level === 'high'
            ? '{count} buyers actively looking'
            : demand.level === 'medium'
              ? '{count} buyers interested'
              : 'Quiet for now',
        ).replace('{count}', String(demand.count)),
        tone:     tonalKey,
        // Spec §3: high demand for the user's crop is money-class
        // urgency — list now to capture the buyers actively
        // searching. Medium drops a tier.
        priority: demand.level === 'high' ? PRIORITY.money + PRIORITY.urgency
                : demand.level === 'medium' ? PRIORITY.money
                : PRIORITY.activity,
        urgency:  demand.level === 'high' ? 'today' : 'this_week',
        cta: {
          label: tStrict('insights.cta.listNow', 'List now'),
          route: '/sell',
          kind:  'list_crop',
        },
      });
    }
  }

  // ── Price suggestion (uses captured location + crop) ────────
  if (primaryCrop && primaryCountry) {
    try {
      const ref = getReferencePrice({ crop: primaryCrop, country: primaryCountry });
      if (ref && Number.isFinite(Number(ref.price))) {
        const formatted = `${ref.price} ${ref.currency || ''}`
          + (ref.unit ? ` / ${ref.unit}` : '');
        insights.push({
          id:    'price_primary',
          kind:  'price',
          icon:  '\uD83D\uDCB0',
          title: tStrict('insights.price.title', 'Suggested price'),
          value: formatted.trim(),
          meta:  ref.source
            ? tStrict('insights.price.source', 'Source: {source}').replace('{source}', ref.source)
            : '',
          tone:     'neutral',
          // Direct money signal → top priority class.
          priority: PRIORITY.money,
          urgency:  'this_week',
          cta: {
            label: tStrict('insights.cta.applyPrice', 'Use this price'),
            route: '/sell',
            kind:  'apply_price',
          },
        });
      }
    } catch { /* swallow */ }
  }

  // ── Activity signal (interests received this week) ──────────
  let recentInterestsForMe = 0;
  if (myFarmerId && myListings.length > 0) {
    let allInterests = [];
    try { allInterests = getBuyerInterests() || []; } catch { allInterests = []; }
    const myListingIds = new Set(myListings.map((l) => l.id));
    const mine = allInterests.filter((i) =>
      i && myListingIds.has(i.listingId));
    recentInterestsForMe = _activityCountSinceMs(mine, sevenDaysMs);
    if (recentInterestsForMe > 0) {
      insights.push({
        id:    'activity_recent',
        kind:  'activity',
        icon:  '\uD83D\uDD14',
        title: tStrict('insights.activity.title', 'This week'),
        value: tStrict(
          'insights.activity.value',
          '{count} buyers reached out',
        ).replace('{count}', String(recentInterestsForMe)),
        tone:     'positive',
        // Buyer interest pending response = urgency, not just activity.
        priority: PRIORITY.urgency,
        urgency:  'this_week',
        cta: {
          label: tStrict('insights.cta.reviewBuyers', 'Review buyers'),
          route: '/sell',
          kind:  'review_interests',
        },
      });
    }
  }

  // ── Top crop in pilot (cohort signal) ───────────────────────
  // Spec §6 relevance: only fire when the user has a location
  // anchor (we treat that as a regional-cohort proxy in pilot)
  // and the cohort top crop is different from their primary.
  if (primaryCountry) {
    try {
      const top = getTopCrops({ windowDays: 90, limit: 1 });
      if (Array.isArray(top) && top[0]?.crop && top[0]?.score > 0) {
        const topCrop = _capitalize(top[0].crop);
        if (_norm(top[0].crop) !== primaryCrop) {
          insights.push({
            id:    'top_crop',
            kind:  'top_crop',
            icon:  '\u2728',
            title: tStrict('insights.topCrop.title', 'Top-selling crop'),
            value: topCrop,
            meta:  tStrict(
              'insights.topCrop.meta',
              '{count} recent transactions',
            ).replace('{count}', String(top[0].score)),
            tone:     'positive',
            priority: PRIORITY.info,
            urgency:  null,
            cta: {
              label: tStrict('insights.cta.browse', 'Browse listings'),
              route: '/buy',
              kind:  'browse_top',
            },
          });
        }
      }
    } catch { /* swallow */ }
  }

  // ── Recurring orders (buyer side) ───────────────────────────
  if (buyerId) {
    try {
      const recurring = getRecurringOrdersForBuyer(buyerId) || [];
      if (recurring.length > 0) {
        insights.push({
          id:    'recurring_buyer',
          kind:  'recurring',
          icon:  '\uD83D\uDD04',
          title: tStrict('insights.recurring.title', 'Your weekly supply'),
          value: recurring.length === 1
            ? _capitalize(recurring[0].crop)
            : tStrict(
                'insights.recurring.multi',
                '{count} crops on weekly auto-match',
              ).replace('{count}', String(recurring.length)),
          tone:     'neutral',
          priority: PRIORITY.activity,
          urgency:  'this_week',
          cta: {
            label: tStrict('insights.cta.viewRecurring', 'Open weekly feed'),
            route: '/buy',
            kind:  'view_recurring',
          },
        });
      }
    } catch { /* swallow */ }
  }

  // ── Trust signal (verification level + activity badges) ─────
  const trust = _trustForUser(myFarmerId);
  if (trust.level >= 2 || trust.badges.length > 0) {
    const trustValue = trust.level >= 2
      ? tStrict(
          'insights.trust.level.high',
          'Verified seller \u00B7 level {level}',
        ).replace('{level}', String(trust.level))
      : trust.badges.length === 1
        ? tStrict(
            `market.badge.${trust.badges[0] === 'fast_response' ? 'fastResponse' : 'active'}`,
            trust.badges[0] === 'fast_response' ? 'Fast response' : 'Active seller',
          )
        : tStrict(
            'insights.trust.value.multi',
            '{count} earned badges',
          ).replace('{count}', String(trust.badges.length));
    insights.push({
      id:    'trust',
      kind:  'trust',
      icon:  '\uD83D\uDEE1\uFE0F',
      title: tStrict('insights.trust.title', 'Your trust signals'),
      value: trustValue,
      tone:     'positive',
      priority: PRIORITY.trust,
      urgency:  null,
      // Spec §1: every insight needs an action button. The
      // trust signal routes to /sell where the next listing can
      // earn a fresh GPS + photo verification.
      cta: {
        label: tStrict('insights.cta.boostTrust', 'Verify another listing'),
        route: '/sell',
        kind:  'boost_trust',
      },
    });
  }

  // Spec §5: filter out anything completed in the last 24h so a
  // tapped insight doesn't hang around.
  let filtered = insights;
  try {
    const completed = getCompletedInsightIds();
    if (completed.size > 0) {
      filtered = insights.filter((it) => !completed.has(it.id));
    }
  } catch { /* swallow */ }

  // Spec §3: priority sort. Tie-breaker is the original order
  // (engine-discovery order) so the result stays stable.
  filtered = filtered
    .map((it, idx) => ({ it, idx }))
    .sort((a, b) => {
      const pa = Number(a.it.priority) || 0;
      const pb = Number(b.it.priority) || 0;
      if (pb !== pa) return pb - pa;
      return a.idx - b.idx;
    })
    .map((d) => d.it);

  return {
    primaryCrop,
    primaryRegion,
    primaryCountry,
    trust,
    insights: filtered.slice(0, MAX_INSIGHTS),
  };
}

export default { buildInsights };
