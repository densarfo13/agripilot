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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import { buildInsights, hasMeaningfulData } from '../../insights/insightsEngine.js';

// Session-storage stamp written when an insight is tapped. The
// receiving page (e.g. /sell, /buy) reads it on mount and fires
// `action_after_insight` if the timestamp is fresh (<60s old),
// then clears it so the attribution never carries to a later
// unrelated visit. Drop-off shows up as: insight_view without a
// matching action_after_insight in the analytics window.
const ACTION_STAMP_KEY = 'farroway_insight_action_pending';
const ACTION_WINDOW_MS = 60_000;
const EMPTY_DISMISS_KEY = 'farroway_insight_empty_dismissed';

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
  rowButton: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  emptyCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#EAF2FF',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  emptyBody: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  emptyTitle: { fontSize: 14, fontWeight: 800, color: '#fff' },
  emptyCopy:  { fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 },
  emptyDismiss: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
    padding: 0,
    lineHeight: 1,
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
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('farrowayMoat');
  const [tick, setTick] = useState(0);
  const [emptyDismissed, setEmptyDismissed] = useState(() => {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      return sessionStorage.getItem(EMPTY_DISMISS_KEY) === 'true';
    } catch { return false; }
  });

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

  // Controlled-rollout gate (§2): only show insights when the user
  // has produced enough data for the engine's signals to be honest.
  const userHasData = useMemo(() => {
    try { return hasMeaningfulData({ profile, activeFarm, buyerId, farmerId }); }
    catch { return false; }
  }, [profile, activeFarm, buyerId, farmerId]);

  const handleInsightClick = useCallback((insight) => {
    if (!insight) return;
    try {
      trackEvent('insight_click', {
        id:    insight.id,
        kind:  insight.kind,
        route: insight.action?.route || null,
      });
    } catch { /* swallow */ }
    if (!insight.action || !insight.action.route) return;
    // Stamp session storage so the receiving page can fire the
    // `action_after_insight` attribution event on mount. Cleared
    // by the receiver after read so a later unrelated visit
    // never inherits the stamp.
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(ACTION_STAMP_KEY, JSON.stringify({
          insightId:   insight.id,
          insightKind: insight.kind,
          actionKind:  insight.action.kind || null,
          stampedAt:   Date.now(),
          window:      ACTION_WINDOW_MS,
        }));
      }
    } catch { /* swallow */ }
    try { navigate(insight.action.route); }
    catch { /* swallow */ }
  }, [navigate]);

  const handleEmptyDismiss = useCallback(() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(EMPTY_DISMISS_KEY, 'true');
      }
    } catch { /* swallow */ }
    try { trackEvent('insight_dismiss', { state: 'empty' }); }
    catch { /* swallow */ }
    setEmptyDismissed(true);
  }, []);

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

  const insightCount = result.insights ? result.insights.length : 0;

  // Empty state (§3): controlled rollout shows a calm onboarding
  // hint when the user has zero data instead of just hiding the
  // section entirely. Once dismissed for the session, hide.
  if (insightCount === 0) {
    if (userHasData) return null;        // engine couldn't produce yet
    if (emptyDismissed) return null;
    return (
      <section
        style={{ ...S.emptyCard, ...(style || null) }}
        data-testid="insights-digest-empty"
      >
        <span style={{ fontSize: 22, lineHeight: 1, flex: '0 0 auto' }} aria-hidden="true">
          {'\u2728'}
        </span>
        <div style={S.emptyBody}>
          <span style={S.emptyTitle}>
            {tStrict('insights.empty.title', 'Insights coming soon')}
          </span>
          <span style={S.emptyCopy}>
            {tStrict('insights.empty.body',
              'Start using Farroway to get insights \u2014 list a crop, browse the marketplace, or complete a daily task.')}
          </span>
        </div>
        <button
          type="button"
          onClick={handleEmptyDismiss}
          style={S.emptyDismiss}
          aria-label={tStrict('common.close', 'Close')}
          data-testid="insights-digest-empty-dismiss"
        >
          {'\u2715'}
        </button>
      </section>
    );
  }

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
          const tappable = Boolean(it.action && it.action.route);
          const rowStyle = {
            ...S.row,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
          };
          const rowChildren = (
            <>
              <span style={S.icon} aria-hidden="true">{it.icon}</span>
              <span style={S.body}>
                <span style={{ ...S.rowTitle, color: tone.color }}>
                  {it.title}
                </span>
                <span style={S.rowValue}>{it.value}</span>
                {it.meta ? <span style={S.rowMeta}>{it.meta}</span> : null}
              </span>
            </>
          );
          if (tappable) {
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => handleInsightClick(it)}
                style={{ ...rowStyle, ...S.rowButton, color: '#fff' }}
                data-testid={`insights-row-${it.id}`}
                data-kind={it.kind}
                data-tone={it.tone}
                data-action={it.action?.kind || ''}
              >
                {rowChildren}
              </button>
            );
          }
          return (
            <div
              key={it.id}
              style={rowStyle}
              data-testid={`insights-row-${it.id}`}
              data-kind={it.kind}
              data-tone={it.tone}
            >
              {rowChildren}
            </div>
          );
        })}
      </div>
    </section>
  );
}
