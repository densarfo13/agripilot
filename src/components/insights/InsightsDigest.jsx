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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import { buildInsights, hasMeaningfulData } from '../../insights/insightsEngine.js';
import {
  markInsightCompleted,
  INSIGHT_COMPLETION_CHANGED_EVENT,
} from '../../insights/insightCompletions.js';

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
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  ctaBtn: {
    appearance: 'none',
    border: 'none',
    padding: '6px 12px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.10)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
  },
  ctaBtnFocus: {
    background: '#22C55E',
    color: '#0B1D34',
  },
  urgencyChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    flex: '0 0 auto',
  },
  urgencyToday:        { background: 'rgba(239,68,68,0.16)',  border: '1px solid rgba(239,68,68,0.45)',  color: '#FCA5A5' },
  urgencyExpiringSoon: { background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.40)', color: '#FDE68A' },
  urgencyThisWeek:     { background: 'rgba(14,165,233,0.10)', border: '1px solid rgba(14,165,233,0.32)', color: '#7DD3FC' },
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
      INSIGHT_COMPLETION_CHANGED_EVENT,
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
    // Spec §1: every insight has an action. Read the action shape
    // from `cta` (new) with a fallback to legacy `action` for
    // backward compat with any stale engine output.
    const action = insight.cta || insight.action || null;
    try {
      trackEvent('insight_click', {
        id:    insight.id,
        kind:  insight.kind,
        route: action?.route || null,
      });
      // Spec §7: action_completed fires the moment the user
      // commits to the action, even before navigation resolves.
      // The receiving page additionally fires action_after_insight
      // (drop-off attribution).
      trackEvent('action_completed', {
        id:         insight.id,
        kind:       insight.kind,
        actionKind: action?.kind || null,
      });
    } catch { /* swallow */ }
    // Spec §5: mark the insight completed so it won't return for
    // the next 24h. Drives the `farroway:insight_completion_changed`
    // event so the digest re-renders without it.
    try { markInsightCompleted(insight.id, { actionKind: action?.kind || null }); }
    catch { /* swallow */ }
    if (!action || !action.route) return;
    // Stamp session storage so the receiving page can fire the
    // `action_after_insight` attribution event on mount.
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(ACTION_STAMP_KEY, JSON.stringify({
          insightId:   insight.id,
          insightKind: insight.kind,
          actionKind:  action.kind || null,
          stampedAt:   Date.now(),
          window:      ACTION_WINDOW_MS,
        }));
      }
    } catch { /* swallow */ }
    try { navigate(action.route); }
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

  // Fire `insight_view` once per non-empty render (legacy
  // aggregate event) plus a per-id `insight_shown` event so the
  // dashboard can attribute drop-off and completion at the row
  // level. The `shownRef` keeps a per-id dedupe set across the
  // session so a re-render from a `tick` doesn't re-fire shown.
  const shownRef = useRef(new Set());
  useEffect(() => {
    if (!flagOn) return;
    if (!result.insights || result.insights.length === 0) return;
    try {
      trackEvent('insight_view', {
        count: result.insights.length,
        kinds: result.insights.map((i) => i.kind),
      });
    } catch { /* swallow */ }
    for (const it of result.insights) {
      if (!it || !it.id) continue;
      if (shownRef.current.has(it.id)) continue;
      shownRef.current.add(it.id);
      try {
        trackEvent('insight_shown', {
          id:       it.id,
          kind:     it.kind,
          priority: it.priority || 0,
          urgency:  it.urgency  || null,
          tone:     it.tone     || null,
        });
      } catch { /* swallow */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn, result.insights.map((i) => i?.id || '').join('|')]);

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
          const cta = it.cta || it.action || null;
          const urgencyTone =
            it.urgency === 'today'          ? S.urgencyToday
            : it.urgency === 'expiring_soon' ? S.urgencyExpiringSoon
            : it.urgency === 'this_week'    ? S.urgencyThisWeek
            : null;
          const urgencyLabel =
            it.urgency === 'today'          ? tStrict('insights.urgency.today',         'Today')
            : it.urgency === 'expiring_soon' ? tStrict('insights.urgency.expiringSoon', 'Expiring soon')
            : it.urgency === 'this_week'    ? tStrict('insights.urgency.thisWeek',     'This week')
            : '';
          const ctaIsHighPriority = it.priority && it.priority >= 80;
          return (
            <div
              key={it.id}
              style={{
                ...S.row,
                background: tone.bg,
                border: `1px solid ${tone.border}`,
                flexDirection: 'column',
                alignItems: 'stretch',
              }}
              data-testid={`insights-row-${it.id}`}
              data-kind={it.kind}
              data-tone={it.tone}
              data-priority={String(it.priority || 0)}
              data-urgency={it.urgency || ''}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={S.icon} aria-hidden="true">{it.icon}</span>
                <span style={S.body}>
                  <span style={{ ...S.rowTitle, color: tone.color }}>
                    {it.title}
                  </span>
                  <span style={S.rowValue}>{it.value}</span>
                  {it.meta ? <span style={S.rowMeta}>{it.meta}</span> : null}
                </span>
              </div>
              <div style={S.actionRow}>
                {urgencyTone ? (
                  <span
                    style={{ ...S.urgencyChip, ...urgencyTone }}
                    data-testid={`insights-urgency-${it.id}`}
                  >
                    {urgencyLabel}
                  </span>
                ) : <span />}
                {cta ? (
                  <button
                    type="button"
                    onClick={() => handleInsightClick(it)}
                    style={{
                      ...S.ctaBtn,
                      ...(ctaIsHighPriority ? S.ctaBtnFocus : null),
                    }}
                    data-testid={`insights-cta-${it.id}`}
                    data-action={cta.kind || ''}
                  >
                    {cta.label
                      || tStrict('insights.cta.default', 'Take action')}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
