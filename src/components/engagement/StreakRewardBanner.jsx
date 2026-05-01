/**
 * StreakRewardBanner — one slot that surfaces either:
 *   • the milestone celebration when the user just crossed 3/7/14/30, or
 *   • the "don't break your streak" risk warning when the streak
 *     is alive but no completion has been logged today (after 4pm).
 *
 * Spec coverage (Daily streak system §4, §6)
 *   §4 reward + warning messages
 *   §6 milestones at 3, 7, 14
 *
 * Position
 *   Mounts on `FarmerOverviewTab` above EngagementStrip when the
 *   `streakRewards` flag is on. Self-suppresses when neither a
 *   milestone nor a risk condition fires.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Reads via streakRewards.getStreakSnapshot — pure read on
 *     existing stores.
 *   • Acknowledge stamps written only on user dismiss / nav.
 *   • Never throws.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import {
  getStreakSnapshot,
  acknowledgeMilestone,
  acknowledgeRisk,
  shouldShowRisk,
} from '../../engine/streakRewards.js';
import { ENGAGEMENT_CHANGE_EVENT } from '../../engine/engagementHistory.js';

const S = {
  card: {
    borderRadius: 14,
    padding: '12px 14px',
    color: '#fff',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    margin: '0 0 10px',
  },
  milestone: {
    background: 'linear-gradient(135deg, rgba(252,211,77,0.20), rgba(245,158,11,0.18))',
    border: '1px solid rgba(252,211,77,0.55)',
  },
  risk: {
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.45)',
  },
  icon: { fontSize: 24, lineHeight: 1, flex: '0 0 auto' },
  body: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 800 },
  copy:  { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 },
  rowBtns: { display: 'flex', gap: 8, marginTop: 6 },
  primary: {
    appearance: 'none',
    border: 'none',
    background: '#FCD34D',
    color: '#0B1D34',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ghost: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.20)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default function StreakRewardBanner({ style }) {
  useTranslation();
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('streakRewards');
  const [tick, setTick] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Refresh snapshot when engagement history ticks (a completion
  // bumps the streak via updateStreak → engagement_changed event
  // fires from the history store).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    try {
      window.addEventListener(ENGAGEMENT_CHANGE_EVENT, handler);
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(ENGAGEMENT_CHANGE_EVENT, handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, []);

  const snapshot = useMemo(() => {
    if (!flagOn) return null;
    try { return getStreakSnapshot(); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn, tick]);

  const showMilestone = !!(snapshot && snapshot.justCrossedMilestone);
  const showRisk = !!(snapshot
    && !showMilestone
    && snapshot.atRisk
    && shouldShowRisk());

  // Once-per-mount view event for whichever banner ends up visible.
  useEffect(() => {
    if (!flagOn) return;
    if (showMilestone) {
      try {
        trackEvent('streak_milestone_view', {
          milestone: snapshot.justCrossedMilestone,
          count: snapshot.count,
        });
      } catch { /* swallow */ }
    } else if (showRisk) {
      try {
        trackEvent('streak_risk_view', { count: snapshot.count });
      } catch { /* swallow */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn, showMilestone, showRisk]);

  const handleMilestoneDismiss = useCallback(() => {
    if (!snapshot || !snapshot.justCrossedMilestone) return;
    try { acknowledgeMilestone(snapshot.justCrossedMilestone); }
    catch { /* swallow */ }
    setDismissed(true);
  }, [snapshot]);

  const handleRiskAct = useCallback(() => {
    try { acknowledgeRisk(); } catch { /* swallow */ }
    try { trackEvent('streak_risk_act', { count: snapshot?.count || 0 }); }
    catch { /* swallow */ }
    setDismissed(true);
  }, [snapshot]);

  const handleRiskDismiss = useCallback(() => {
    try { acknowledgeRisk(); } catch { /* swallow */ }
    try { trackEvent('streak_risk_dismiss', { count: snapshot?.count || 0 }); }
    catch { /* swallow */ }
    setDismissed(true);
  }, [snapshot]);

  if (!flagOn || dismissed) return null;

  // Milestone takes priority over risk — celebrating "you hit 7
  // days" matters more than warning about today's gap.
  if (showMilestone) {
    const m = snapshot.justCrossedMilestone;
    const titleKey = `streak.milestone.${m}.title`;
    const titleFallback =
      m === 3   ? '3-day streak \u2014 you\u2019re building a habit.'
      : m === 7  ? '7-day streak \u2014 a full week. Nice work.'
      : m === 14 ? '14-day streak \u2014 you\u2019re unstoppable.'
      :            `${m}-day streak \u2014 incredible consistency.`;
    return (
      <section
        style={{ ...S.card, ...S.milestone, ...(style || null) }}
        data-testid="streak-milestone-banner"
        data-milestone={m}
      >
        <span style={S.icon} aria-hidden="true">{'\uD83C\uDF89'}</span>
        <div style={S.body}>
          <span style={S.title}>{tStrict(titleKey, titleFallback)}</span>
          <span style={S.copy}>
            {tStrict('streak.milestone.copy',
              'Daily action compounds. One more tomorrow keeps it going.')}
          </span>
          <div style={S.rowBtns}>
            <button
              type="button"
              onClick={handleMilestoneDismiss}
              style={S.primary}
              data-testid="streak-milestone-ack"
            >
              {tStrict('streak.milestone.ack', 'Nice')}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (showRisk) {
    return (
      <section
        style={{ ...S.card, ...S.risk, ...(style || null) }}
        data-testid="streak-risk-banner"
        data-streak={snapshot.count}
      >
        <span style={S.icon} aria-hidden="true">{'\u23F3'}</span>
        <div style={S.body}>
          <span style={{ ...S.title, color: '#FDE68A' }}>
            {tStrict('streak.risk.title',
              'Don\u2019t break your streak')}
          </span>
          <span style={S.copy}>
            {tStrict('streak.risk.copy',
              'You\u2019re on a {count}-day streak. One quick task today keeps it alive.')
              .replace('{count}', String(snapshot.count))}
          </span>
          <div style={S.rowBtns}>
            <button
              type="button"
              onClick={() => {
                handleRiskAct();
                try { navigate('/'); } catch { /* swallow */ }
              }}
              style={S.primary}
              data-testid="streak-risk-act"
            >
              {tStrict('streak.risk.act', 'Show me a task')}
            </button>
            <button
              type="button"
              onClick={handleRiskDismiss}
              style={S.ghost}
              data-testid="streak-risk-dismiss"
            >
              {tStrict('common.notNow', 'Not now')}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return null;
}
