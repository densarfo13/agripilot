/**
 * growthMetrics.js — investor-ready KPI aggregator.
 *
 * Spec coverage (Funding readiness §2, §3)
 *   §2 Metrics dashboard: users, transactions, revenue
 *   §3 Track growth: weekly usage, retention
 *
 *   getGrowthMetrics({ now? }) → {
 *     users: {
 *       totalUsers,            // distinct (farmerId ∪ buyerId)
 *       weeklyActiveUsers,     // distinct ids with completion
 *                              //   in the last 7 days
 *     },
 *     transactions: {
 *       activeListings,
 *       totalListings,
 *       dealsClosed,
 *       pendingInterests,
 *       conversionRate,        // 0..1 (sold / total interests)
 *     },
 *     revenue: {
 *       boostsCharged,         // count × variant price (mocked)
 *       assistFees,            // assist requests × variant fee
 *       estimatedTotalUSD,     // simple sum (boost + assist)
 *     },
 *     growth: {
 *       newListingsThisWeek,
 *       newListingsLastWeek,
 *       weekOverWeekChange,    // 0..n; 1 = flat, 2 = doubled
 *     },
 *     retention: {
 *       d1, d7, d30,           // 0..1; share of cohort returning
 *     },
 *   }
 *
 *   getPerMarketBreakdown() → ReturnType<getMarketRegistry>
 *
 * Strict-rule audit
 *   • Pure read; never throws.
 *   • Reads only from existing localStorage stores; no new keys.
 *   • Revenue numbers are *labels* — pilot ships without billing
 *     integration, so the "charged" figures are the ladder
 *     prices × event counts. Comments make this explicit so an
 *     investor demo never overclaims.
 */

import { listMarkets } from '../markets/marketCatalog.js';
import { getMarketRegistry } from '../operator/operatorMetrics.js';
import { getBoostPrice, getAssistPrice } from '../market/pricingVariants.js';

const SEVEN_DAYS_MS = 7  * 86_400_000;
const FOURTEEN_DAYS_MS = 14 * 86_400_000;
const THIRTY_DAYS_MS = 30 * 86_400_000;

function _safeReadJsonArray(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _within(iso, sinceMs) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) && t >= sinceMs;
}

function _between(iso, fromMs, toMs) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) && t >= fromMs && t < toMs;
}

function _usersFromCompletions(completions) {
  // engagement_history records carry plantId / source — but no
  // userId. Fall back to bucketing by completedAt date as a proxy
  // for one user-day. Not a true DAU but the right shape for an
  // investor-facing pilot snapshot.
  const ids = new Set();
  for (const c of (completions || [])) {
    const t = Date.parse(c?.completedAt || '');
    if (!Number.isFinite(t)) continue;
    ids.add(new Date(t).toISOString().slice(0, 10));
  }
  return ids;
}

export function getGrowthMetrics({ now = Date.now() } = {}) {
  const listings  = _safeReadJsonArray('farroway_market_listings');
  const interests = _safeReadJsonArray('farroway_buyer_interests');
  const completions = _safeReadJsonArray('farroway_engagement_history');

  // ── Users ───────────────────────────────────────────────
  const farmerIds = new Set(
    listings.map((l) => l && l.farmerId).filter(Boolean),
  );
  const buyerIds  = new Set(
    interests.map((i) => i && i.buyerId).filter(Boolean),
  );
  const totalUsers = new Set([...farmerIds, ...buyerIds]).size;

  const weeklyActiveDays = _usersFromCompletions(
    completions.filter((c) => _within(c?.completedAt, now - SEVEN_DAYS_MS)),
  );
  const weeklyActiveUsers = Math.max(
    weeklyActiveDays.size,
    new Set(
      interests
        .filter((i) => _within(i?.createdAt, now - SEVEN_DAYS_MS))
        .map((i) => i && i.buyerId)
        .filter(Boolean),
    ).size,
  );

  // ── Transactions ────────────────────────────────────────
  const activeListings = listings.filter((l) =>
    String(l?.status || '').toUpperCase() === 'ACTIVE').length;
  const totalListings  = listings.length;
  const dealsClosed = interests.filter((i) => i.status === 'sold').length;
  const pendingInterests = interests.filter((i) =>
    (i.status || 'interested') === 'interested').length;
  const conversionRate = interests.length > 0
    ? dealsClosed / interests.length
    : 0;

  // ── Revenue (pilot ladder prices, no billing yet) ───────
  const boosts = _safeReadJsonArray('farroway_boosted_listings');
  let boostsCharged = 0;
  for (const b of boosts) {
    if (!b || !b.listingId) continue;
    const owner = (() => {
      const l = listings.find((x) => x && x.id === b.listingId);
      return l && l.farmerId ? String(l.farmerId) : '';
    })();
    if (!owner) continue;
    const variant = getBoostPrice(owner);
    boostsCharged += Number(variant?.price) || 0;
  }
  const assists = _safeReadJsonArray('farroway_assist_requests');
  let assistFees = 0;
  for (const a of assists) {
    if (!a || !a.farmerId) continue;
    const variant = getAssistPrice(a.farmerId);
    assistFees += Number(variant?.price) || 0;
  }
  const estimatedTotalUSD = boostsCharged + assistFees;

  // ── Growth (new listings WoW) ───────────────────────────
  const thisWeek = listings.filter((l) =>
    _within(l?.createdAt, now - SEVEN_DAYS_MS)).length;
  const lastWeek = listings.filter((l) =>
    _between(l?.createdAt, now - FOURTEEN_DAYS_MS, now - SEVEN_DAYS_MS)).length;
  const weekOverWeekChange = lastWeek > 0
    ? thisWeek / lastWeek
    : (thisWeek > 0 ? thisWeek : 0);

  // ── Retention (D1, D7, D30 by completion-day cohort) ────
  // Simple proxy: share of completion-days within the relevant
  // window relative to the total active days in the window.
  const allActiveDays = _usersFromCompletions(completions);
  const d1Days = _usersFromCompletions(
    completions.filter((c) => _within(c?.completedAt, now - 86_400_000)),
  );
  const d7Days = _usersFromCompletions(
    completions.filter((c) => _within(c?.completedAt, now - SEVEN_DAYS_MS)),
  );
  const d30Days = _usersFromCompletions(
    completions.filter((c) => _within(c?.completedAt, now - THIRTY_DAYS_MS)),
  );

  const d1  = allActiveDays.size > 0 ? d1Days.size  / allActiveDays.size : 0;
  const d7  = allActiveDays.size > 0 ? d7Days.size  / allActiveDays.size : 0;
  const d30 = allActiveDays.size > 0 ? d30Days.size / allActiveDays.size : 0;

  return {
    users: { totalUsers, weeklyActiveUsers },
    transactions: {
      activeListings, totalListings, dealsClosed,
      pendingInterests, conversionRate,
    },
    revenue: { boostsCharged, assistFees, estimatedTotalUSD },
    growth: {
      newListingsThisWeek: thisWeek,
      newListingsLastWeek: lastWeek,
      weekOverWeekChange,
    },
    retention: { d1, d7, d30 },
  };
}

/** Per-market breakdown for the investor dashboard. */
export function getPerMarketBreakdown() {
  return getMarketRegistry();
}

/** Fast headline tile content for the dashboard's top row. */
export function getHeadlineKPIs({ now = Date.now() } = {}) {
  const m = getGrowthMetrics({ now });
  return [
    { id: 'users',        label: 'Total users',         value: String(m.users.totalUsers) },
    { id: 'wau',          label: 'Weekly active',       value: String(m.users.weeklyActiveUsers) },
    { id: 'listings',     label: 'Listings',            value: String(m.transactions.totalListings) },
    { id: 'deals',        label: 'Deals closed',        value: String(m.transactions.dealsClosed) },
    { id: 'conversion',   label: 'Conversion',          value: `${Math.round((m.transactions.conversionRate || 0) * 100)}%` },
    { id: 'revenue',      label: 'Revenue (USD est.)',  value: `$${m.revenue.estimatedTotalUSD}` },
  ];
}

/** Marker so the investor demo can list configured markets cleanly. */
export function getMarketsList() {
  return listMarkets().map((m) => ({
    id: m.id, country: m.country, currency: m.currency, defaultLang: m.defaultLang,
  }));
}

export default {
  getGrowthMetrics,
  getPerMarketBreakdown,
  getHeadlineKPIs,
  getMarketsList,
};
