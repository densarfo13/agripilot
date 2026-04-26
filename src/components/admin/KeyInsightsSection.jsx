/**
 * KeyInsightsSection — decision-level summary card row for the
 * NGO/admin dashboard.
 *
 * Converts the raw aggregates already fetched by AdminDashboard
 * (`summary`, `farmers`, `performance`, `scoring`, `marketplace`)
 * into three short, action-oriented insight cards. No new backend
 * endpoints — every number is derived client-side from what the
 * page already loaded.
 *
 * Computations
 * ────────────
 * 1. High Risk Alert
 *    risk = scoring[] entries with score < 40
 *    pct  = riskCount / total scored farms
 *    e.g. "15% of farmers may underperform due to low activity"
 *
 * 2. Market Opportunity
 *    readyCount = farmers[] in a harvest-ready stage
 *                 ('harvest' | 'post_harvest' | 'ready_to_sell')
 *    falls back to marketplace.totalListings when stage data thin.
 *    e.g. "230 farms are ready to sell within 2 weeks"
 *
 * 3. Performance Insight
 *    Compares average yield in performance[] between low-risk and
 *    medium/high-risk cohorts. Low-risk maps loosely to "farmers
 *    who complete their tasks" because the risk score in this
 *    pipeline is driven by activity / completion. The lift is
 *    expressed as a percentage uplift the on-track cohort enjoys.
 *    Falls back to the global summary.completionRate when the
 *    cohort split is degenerate.
 *    e.g. "Farmers completing tasks have 28% higher success rate"
 *
 * Each insight self-hides when its inputs are missing or yield
 * zero / negative numbers — never shows a card with a misleading
 * "0%" or empty count. The whole section also hides when none of
 * the three insights resolve to a renderable number.
 *
 * UI
 * ──
 * Three stacked cards, mobile-first; on wider screens they lay
 * out as a responsive grid via the existing `S.cardsRow` style
 * inherited from the dashboard. Strings come from the same
 * `resolve(t, key, fallback)` helper the parent already uses, so
 * non-English UIs render translated copy when the keys ship; the
 * fallback strings are the spec examples verbatim until then.
 */

import { useTranslation } from '../../i18n/index.js';

function resolve(t, key, fallback) {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
}

const READY_STAGES = new Set([
  'harvest',
  'post_harvest',
  'ready_to_sell',
  'ready',
]);

function _toNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Given the same data the parent dashboard already has, return the
 * three insight values. Exported for tests and for callers that
 * want the numbers without rendering.
 *
 * Each entry is `{ value, ... }` where `value === null` means
 * "don't render this card" (insufficient data).
 */
export function computeInsights({
  summary    = null,
  farmers    = null,
  performance = null,
  scoring    = null,
  marketplace = null,
} = {}) {
  // ─── 1. High-risk farmers ──────────────────────────────────
  let highRisk = null;
  const score = Array.isArray(scoring) ? scoring : null;
  if (score && score.length) {
    const lowScored = score.filter((s) => _toNumber(s?.score) > 0 && _toNumber(s?.score) < 40).length;
    const total     = score.length;
    if (total > 0 && lowScored > 0) {
      highRisk = {
        pct:    Math.round((lowScored / total) * 100),
        count:  lowScored,
        total,
      };
    }
  }

  // ─── 2. Market opportunity (ready-to-sell) ─────────────────
  let market = null;
  const farmList = Array.isArray(farmers) ? farmers : [];
  const readyByStage = farmList.filter((f) => {
    const stage = String(f?.stage || '').toLowerCase();
    return READY_STAGES.has(stage);
  }).length;
  // Prefer the explicit stage-derived count; otherwise use the
  // marketplace listings total (each listing == one farm willing
  // to sell). One of the two is usually populated in any pilot.
  const readyCount = readyByStage > 0
    ? readyByStage
    : _toNumber(marketplace?.totalListings);
  if (readyCount > 0) {
    market = { count: readyCount, source: readyByStage > 0 ? 'stage' : 'listings' };
  }

  // ─── 3. Performance lift ──────────────────────────────────
  let perfLift = null;
  const perf = Array.isArray(performance) ? performance : [];
  if (perf.length > 0) {
    const safe = perf.filter((p) => p?.risk === 'low' || p?.risk === 'safe');
    const atRisk = perf.filter((p) => p?.risk === 'high' || p?.risk === 'medium');
    const avg = (arr) => {
      if (!arr.length) return 0;
      const total = arr.reduce((s, x) => s + _toNumber(x?.yield), 0);
      return total / arr.length;
    };
    const safeAvg = avg(safe);
    const riskAvg = avg(atRisk);
    if (safe.length > 0 && atRisk.length > 0 && riskAvg > 0 && safeAvg > riskAvg) {
      perfLift = {
        pct: Math.round(((safeAvg - riskAvg) / riskAvg) * 100),
        source: 'cohort',
      };
    }
  }
  // Last-resort fallback: surface the global completion rate when
  // the cohort split was degenerate but we still have a number to
  // show. Phrased as "completion average" rather than "lift".
  if (!perfLift && summary && Number.isFinite(_toNumber(summary.completionRate))) {
    const pct = Math.round(_toNumber(summary.completionRate) * 100);
    if (pct > 0) {
      perfLift = { pct, source: 'completion' };
    }
  }

  return { highRisk, market, perfLift };
}

export default function KeyInsightsSection({
  summary, farmers, performance, scoring, marketplace,
}) {
  const { t } = useTranslation();
  const insights = computeInsights({ summary, farmers, performance, scoring, marketplace });

  const cards = [];

  if (insights.highRisk) {
    const { pct } = insights.highRisk;
    cards.push({
      key: 'risk',
      tone: 'danger',
      icon: '⚠',
      title: resolve(t, 'admin.insights.highRisk.title', 'High Risk Alert'),
      body:  resolve(
        t,
        'admin.insights.highRisk.body',
        `${pct}% of farmers may underperform due to low activity`,
      ).replace('{pct}', String(pct)),
    });
  }

  if (insights.market) {
    const { count } = insights.market;
    cards.push({
      key: 'market',
      tone: 'success',
      icon: '🛒',
      title: resolve(t, 'admin.insights.market.title', 'Market Opportunity'),
      body:  resolve(
        t,
        'admin.insights.market.body',
        `${count} farms are ready to sell within 2 weeks`,
      ).replace('{count}', String(count)),
    });
  }

  if (insights.perfLift) {
    const { pct, source } = insights.perfLift;
    const fallback = source === 'completion'
      ? `Farmers completing tasks have a ${pct}% completion rate`
      : `Farmers completing tasks have ${pct}% higher success rate`;
    const keyName = source === 'completion'
      ? 'admin.insights.performance.bodyCompletion'
      : 'admin.insights.performance.bodyLift';
    cards.push({
      key: 'perf',
      tone: 'info',
      icon: '📈',
      title: resolve(t, 'admin.insights.performance.title', 'Performance Insight'),
      body:  resolve(t, keyName, fallback).replace('{pct}', String(pct)),
    });
  }

  if (cards.length === 0) return null;

  return (
    <section style={S.section} data-testid="admin-key-insights">
      <h3 style={S.h3}>
        {resolve(t, 'admin.insights.sectionTitle', 'Key Insights')}
      </h3>
      <div style={S.grid}>
        {cards.map((c) => (
          <article
            key={c.key}
            style={{ ...S.card, ...toneStyle(c.tone) }}
            data-tone={c.tone}
            data-insight={c.key}
          >
            <div style={S.cardHeader}>
              <span style={S.icon} aria-hidden="true">{c.icon}</span>
              <h4 style={S.cardTitle}>{c.title}</h4>
            </div>
            <p style={S.cardBody}>{c.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function toneStyle(tone) {
  switch (tone) {
    case 'danger':  return { borderColor: 'rgba(239,68,68,0.45)',  background: 'rgba(239,68,68,0.10)' };
    case 'success': return { borderColor: 'rgba(34,197,94,0.45)',  background: 'rgba(34,197,94,0.10)' };
    case 'info':
    default:        return { borderColor: 'rgba(14,165,233,0.40)', background: 'rgba(14,165,233,0.08)' };
  }
}

const S = {
  section: { marginTop: '1.25rem' },
  h3: { fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.75rem',
  },
  card: {
    padding: '0.875rem 1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  icon: { fontSize: '1.1rem', lineHeight: 1 },
  cardTitle: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'rgba(255,255,255,0.85)',
  },
  cardBody: {
    margin: 0,
    fontSize: '1rem',
    lineHeight: 1.4,
    color: '#fff',
  },
};
