/**
 * InsightsDigest — Home-mountable digest card that pulls together
 * 1–5 personalised insights from the data Farroway has already
 * captured.
 *
 * Spec coverage (Long-term moat §2, §6)
 *   §2 Generate insights — demand / price / activity signals
 *   §6 Personalize — relevant crops + demand insights
 *
 * Position
 *   Mounts on `FarmerOverviewTab` under the engagement strip when
 *   `farrowayMoat` is on. Returns null when the engine produced
 *   no insights (new install with no history) so the card never
 *   renders empty.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; the engine is the only source of
 *     truth.
 *   • Self-suppresses behind the `farrowayMoat` flag.
 *   • Auto-refreshes on `farroway:market_changed` /
 *     `farroway:engagement_changed` so the card stays fresh as
 *     the underlying stores tick.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import { buildInsights } from '../../insights/insightsEngine.js';

const TONES = {
  positive:  { color: '#86EFAC', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.32)' },
  neutral:   { color: '#7DD3FC', bg: 'rgba(14,165,233,0.10)', border: 'rgba(14,165,233,0.32)' },
  attention: { color: '#FCD34D', bg: 'rgba(252,211,77,0.10)', border: 'rgba(252,211,77,0.32)' },
};

const S = {
  card: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#EAF2FF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  headRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
  },
  icon: { fontSize: 22, lineHeight: 1, flex: '0 0 auto' },
  body: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  rowTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.72)',
  },
  rowValue: { fontSize: 14, fontWeight: 700, color: '#fff' },
  rowMeta:  { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 },
  empty: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.5,
  },
};

/**
 * @param {object} props
 * @param {object} [props.profile]
 * @param {object} [props.activeFarm]
 * @param {string} [props.buyerId]
 * @param {string} [props.farmerId]
 * @param {object} [props.style]
 */
export default function InsightsDigest({
  profile,
  activeFarm,
  buyerId,
  farmerId,
  style,
}) {
  useTranslation();
  const flagOn = isFeatureEnabled('farrowayMoat');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    const evts = [
      'farroway:market_changed',
      'farroway:engagement_changed',
      'farroway:recurring_changed',
      'farroway:boost_changed',
      'storage',
    ];
    try {
      for (const e of evts) window.addEventListener(e, handler);
    } catch { /* swallow */ }
    return () => {
      try {
        for (const e of evts) window.removeEventListener(e, handler);
      } catch { /* swallow */ }
    };
  }, []);

  const result = useMemo(() => {
    try {
      return buildInsights({ profile, activeFarm, buyerId, farmerId });
    } catch {
      return { insights: [], trust: { level: 0, badges: [] } };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activeFarm, buyerId, farmerId, tick]);

  // Fire `insight_view` once per non-empty render. Helps measure
  // whether the digest is actually doing useful work for users.
  useEffect(() => {
    if (!flagOn) return;
    if (!result.insights || result.insights.length === 0) return;
    try {
      trackEvent('insight_view', {
        count: result.insights.length,
        kinds: result.insights.map((i) => i.kind),
      });
    } catch { /* swallow */ }
    // Only fire once per mount — `tick` changes don't refire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn]);

  if (!flagOn) return null;
  if (!result.insights || result.insights.length === 0) return null;

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="insights-digest"
    >
      <div style={S.headRow}>
        <span style={S.eyebrow}>
          {tStrict('insights.title', 'Insights for you')}
        </span>
      </div>
      <div style={S.list}>
        {result.insights.map((it) => {
          const tone = TONES[it.tone] || TONES.neutral;
          return (
            <div
              key={it.id}
              style={{
                ...S.row,
                background: tone.bg,
                border: `1px solid ${tone.border}`,
              }}
              data-testid={`insights-row-${it.id}`}
              data-kind={it.kind}
              data-tone={it.tone}
            >
              <span style={S.icon} aria-hidden="true">{it.icon}</span>
              <span style={S.body}>
                <span style={{ ...S.rowTitle, color: tone.color }}>
                  {it.title}
                </span>
                <span style={S.rowValue}>{it.value}</span>
                {it.meta ? <span style={S.rowMeta}>{it.meta}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
