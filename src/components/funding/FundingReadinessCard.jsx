/**
 * FundingReadinessCard — score + progress bar + 2-3 tips.
 *
 * Replaces the older `ApplyReadinessChecklist` (which exposed all
 * 7 criteria as a checklist). The Smart Funding spec deliberately
 * asks for the slimmer, focused presentation — score message +
 * top tips only — so the Hub's primary surface stays scannable.
 *
 * The score itself is computed by the recommendation engine via
 * `calculateFundingReadiness(ctx)`; this component is a pure
 * render layer over the engine's return value, so it doesn't
 * duplicate the math.
 *
 * Strict-rule audit
 *   • Pure UI; no I/O outside an analytics ping when the score
 *     band changes.
 *   • Visible labels via tStrict; never leaks English in non-en.
 *   • Tip strings are passed in by the engine — they're already
 *     short imperatives ("Add your farm or garden location.").
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackFundingEvent } from '../../analytics/fundingAnalytics.js';

const STYLES = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title:  { margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' },
  pct: {
    fontSize: 26,
    fontWeight: 800,
    color: '#22C55E',
    fontVariantNumeric: 'tabular-nums',
  },
  bar: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: { height: '100%', background: '#22C55E', borderRadius: 999, transition: 'width 220ms ease' },
  message: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 },
  tipsTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },
  tipsList: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    lineHeight: 1.4,
  },
};

function _band(score) {
  if (score < 40)  return 'low';
  if (score < 70)  return 'medium';
  return 'high';
}

function _messageFor(score) {
  const band = _band(score);
  if (band === 'low') {
    return tStrict(
      'funding.readiness.message.low',
      'Complete your profile to improve recommendations.'
    );
  }
  if (band === 'medium') {
    return tStrict(
      'funding.readiness.message.medium',
      'You are building a stronger profile.'
    );
  }
  return tStrict(
    'funding.readiness.message.high',
    'Your profile is getting stronger for support opportunities.'
  );
}

/**
 * @param {object} props
 * @param {number} props.score      0..100
 * @param {string[]} [props.tips]   shown 2..3 max
 * @param {object} [props.context]  passed through to analytics
 */
export default function FundingReadinessCard({ score = 0, tips = [], context = {} }) {
  // Subscribe to language change so labels refresh on flip.
  useTranslation();

  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const message = _messageFor(safeScore);

  // Fire `funding_readiness_viewed` once on mount and again only
  // when the band crosses (low → medium → high). Avoids spamming
  // analytics on every parent re-render.
  const lastBandRef = useRef(_band(safeScore));
  const mountFiredRef = useRef(false);
  useEffect(() => {
    const band = _band(safeScore);
    if (!mountFiredRef.current) {
      mountFiredRef.current = true;
      try {
        trackFundingEvent('funding_readiness_viewed', {
          score: safeScore,
          band,
          country:  context.country || null,
          userRole: context.userRole || null,
        });
      } catch { /* never propagate */ }
      lastBandRef.current = band;
      return;
    }
    if (band !== lastBandRef.current) {
      lastBandRef.current = band;
      try {
        trackFundingEvent('funding_readiness_change', {
          score: safeScore,
          band,
          country:  context.country || null,
          userRole: context.userRole || null,
        });
      } catch { /* never propagate */ }
    }
  }, [safeScore, context.country, context.userRole]);

  const visibleTips = Array.isArray(tips) ? tips.slice(0, 3) : [];

  return (
    <section style={STYLES.card} data-testid="funding-readiness-card">
      <div style={STYLES.header}>
        <h3 style={STYLES.title}>
          {tStrict('funding.readiness.headline', 'Your funding readiness')}
        </h3>
        <span style={STYLES.pct} aria-label={`${safeScore}%`}>
          {safeScore}<span style={{ fontSize: 14, marginLeft: 2, fontWeight: 600 }}>%</span>
        </span>
      </div>
      <div
        style={STYLES.bar}
        role="progressbar"
        aria-valuenow={safeScore}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ ...STYLES.fill, width: `${safeScore}%` }} />
      </div>
      <p style={STYLES.message}>{message}</p>
      {visibleTips.length > 0 ? (
        <>
          <div style={STYLES.tipsTitle}>
            {tStrict('funding.readiness.tipsTitle', 'Improve your readiness')}
          </div>
          <ul style={STYLES.tipsList}>
            {visibleTips.map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
