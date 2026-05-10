/**
 * WeakestPointCard — surfaces the spec's "what to fix this week"
 * recommendation directly above the Growth Analytics panel.
 *
 * Renders one of three states:
 *   1. No-data    — sample too small; quiet "keep collecting" line
 *   2. All-green  — every metric above threshold; calm green chip
 *   3. Recommend  — flags the weakest category + plays the spec's
 *                   exact remediation copy (reduce friction /
 *                   improve action clarity / improve habit loop /
 *                   improve share triggers)
 *
 * Pure render — never mutates state. Reads from
 * `findWeakestPoint()` which is itself a pure derivation of
 * `buildGrowthAnalytics()`. Both run on every mount; cheap.
 *
 * Strict-rule audit
 *   • All visible text via tStrict.
 *   • Self-hides nothing — all three states render so the
 *     operator always sees the data-driven loop status.
 *   • Caller-supplied `analytics` lets the card plug into a
 *     pre-fetched server snapshot when the dashboard ships
 *     server-side aggregation later.
 */

import { useMemo } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';
import { findWeakestPoint } from '../../analytics/weakestPoint.js';

function _fmtPct(rate) {
  if (rate == null || !Number.isFinite(rate)) return '\u2014';
  return `${(rate * 100).toFixed(1)}%`;
}

export default function WeakestPointCard({
  analytics,
  testId = 'weakest-point-card',
}) {
  // Subscribe to language change so labels refresh on flip.
  useTranslation();

  const result = useMemo(() => {
    try { return findWeakestPoint({ analytics }); }
    catch { return null; }
  }, [analytics]);

  // No-data path: when result is null, we still render so the
  // operator sees the panel exists. Two sub-states distinguish
  // "all green" from "insufficient sample" — we infer from the
  // caller-supplied analytics or the world default.
  const hasData = !!(analytics && analytics.overview
                     && Number(analytics.overview.totalEvents) > 0);

  if (!result && !hasData) {
    return (
      <section style={{ ...S.card, ...S.cardNeutral }} data-testid={testId} data-state="no-data">
        <span style={S.eyebrow}>
          {tStrict('growth.weakestPoint.eyebrow', 'Weekly focus')}
        </span>
        <h3 style={S.title}>
          {tStrict('growth.weakestPoint.noData.title',
            'Not enough data yet')}
        </h3>
        <p style={S.body}>
          {tStrict('growth.weakestPoint.noData.body',
            'Keep shipping \u2014 the recommendation appears once the funnel has at least 5 entries per stage.')}
        </p>
      </section>
    );
  }

  if (!result) {
    return (
      <section style={{ ...S.card, ...S.cardOk }} data-testid={testId} data-state="all-green">
        <span style={S.eyebrow}>
          {tStrict('growth.weakestPoint.eyebrow', 'Weekly focus')}
        </span>
        <h3 style={S.title}>
          {tStrict('growth.weakestPoint.allGreen.title',
            'Every metric is above target')}
        </h3>
        <p style={S.body}>
          {tStrict('growth.weakestPoint.allGreen.body',
            'No fix recommended this week. Keep monitoring \u2014 the lowest metric will surface here when one drops.')}
        </p>
      </section>
    );
  }

  const r = result;
  const titleText = tStrict(
    r.recommendation.titleKey,
    r.recommendation.titleFallback,
  );
  const bodyText = tStrict(
    r.recommendation.bodyKey,
    r.recommendation.bodyFallback,
  );
  return (
    <section
      style={{ ...S.card, ...S.cardWarn }}
      data-testid={testId}
      data-state="recommend"
      data-category={r.category}
    >
      <span style={S.eyebrow}>
        {tStrict('growth.weakestPoint.eyebrow', 'Weekly focus')}
      </span>
      <h3 style={S.title}>{titleText}</h3>
      <p style={S.body}>{bodyText}</p>
      <div style={S.metricRow} data-testid={`${testId}-metric`}>
        <span style={S.metricLabel}>
          {tStrict(`growth.weakestPoint.metricLabel.${r.metric}`,
            _humanize(r.metric))}
        </span>
        <span style={S.metricValue}>{_fmtPct(r.rate)}</span>
        <span style={S.metricThreshold}>
          {tStrict('growth.weakestPoint.target',
            `target ${_fmtPct(r.threshold)}`,
            { threshold: _fmtPct(r.threshold) })}
        </span>
      </div>
      <span style={S.detailsHint}>
        {tStrict('growth.weakestPoint.detailsHint',
          `${r.details.stage2Count} of ${r.details.stage1Count}`,
          {
            numerator:   r.details.stage2Count,
            denominator: r.details.stage1Count,
          })}
      </span>
    </section>
  );
}

function _humanize(slug) {
  return String(slug || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\s+/, '')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const C = {
  green:   '#C8944D',
  greenFg: '#86EFAC',
  amber:   '#F59E0B',
  amberFg: '#FCD34D',
  ink:     '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.72)',
  inkDim:  'rgba(255,255,255,0.55)',
};

const S = {
  card: {
    borderRadius: 16,
    padding: '1.125rem 1.25rem',
    color: C.ink,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardNeutral: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  cardOk: {
    background: 'rgba(200,148,77,0.10)',
    border: `1px solid ${C.green}40`,
  },
  cardWarn: {
    background: 'rgba(245,158,11,0.10)',
    border: `1px solid ${C.amber}55`,
  },
  eyebrow: {
    fontSize: '0.6875rem',
    fontWeight: 800,
    color: C.amberFg,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  title: {
    margin: '2px 0 0',
    fontSize: '1rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.3,
  },
  body: {
    margin: '4px 0 0',
    fontSize: '0.875rem',
    color: C.inkSoft,
    lineHeight: 1.5,
  },
  metricRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  metricLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: C.inkDim,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  metricValue: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#FFFFFF',
    fontVariantNumeric: 'tabular-nums',
  },
  metricThreshold: {
    fontSize: '0.75rem',
    color: C.amberFg,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
  },
  detailsHint: {
    marginTop: 4,
    fontSize: '0.75rem',
    color: C.inkDim,
    fontVariantNumeric: 'tabular-nums',
  },
};
