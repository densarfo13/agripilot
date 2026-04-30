/**
 * DailyReminderBanner — single-line contextual reminder shown
 * near the top of the farmer's home surface.
 *
 * Spec §1 / §2 / §4 / §7 in one component:
 *   • Default      → "Today's farm task is ready"
 *   • Weather      → "Rain today — check your farm plan"
 *   • Missed       → "You missed a task. Let's get back on track."
 *   • New streak   → "Let's start a new streak today"   (post-miss)
 *   • All done     → "You're done for today"
 *   • Return       → "We've prepared your next steps"   (≥2 day absence)
 *
 * Strict rules
 * ────────────
 *   • Reads only — never mutates the heavy loop state.
 *   • Local-only — no fetch; uses retention/streakStore + the page's
 *     already-loaded weather summary.
 *   • Hides when the variant is `null` (no eligible message).
 *   • Visible text routes through `tStrict` so non-English UIs never
 *     leak the English fallback.
 *
 * Props
 * ─────
 *   weather          page's existing weather summary (optional)
 *   todayCompleted   boolean — task already done today
 *   onCta            optional click handler routed by the parent
 *                    page (e.g. scroll/focus the primary task card)
 */

import { useEffect, useMemo } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';
import {
  getRetentionState,
  recordVisit,
  missedYesterday,
  daysSinceLastVisit,
  shouldShowReminderToday,
  markReminderShown,
} from '../../lib/retention/streakStore.js';
import {
  pickReminderMessage,
  maybeShowBrowserNotification,
} from '../../lib/retention/reminderEngine.js';

const TONE_STYLE = {
  default:    { bg: 'rgba(34,197,94,0.10)',  fg: '#86EFAC', border: 'rgba(34,197,94,0.30)' },
  weather:    { bg: 'rgba(14,165,233,0.10)', fg: '#7DD3FC', border: 'rgba(14,165,233,0.30)' },
  missed:     { bg: 'rgba(245,158,11,0.10)', fg: '#FCD34D', border: 'rgba(245,158,11,0.30)' },
  new_streak: { bg: 'rgba(168,85,247,0.10)', fg: '#D8B4FE', border: 'rgba(168,85,247,0.30)' },
  all_done:   { bg: 'rgba(34,197,94,0.10)',  fg: '#86EFAC', border: 'rgba(34,197,94,0.30)' },
  return:     { bg: 'rgba(245,158,11,0.10)', fg: '#FDE68A', border: 'rgba(245,158,11,0.30)' },
};

export default function DailyReminderBanner({
  weather = null,
  todayCompleted = false,
  onCta,
}) {
  // Subscribe to language change so the message refreshes on flip.
  useTranslation();

  // Mark today as visited the first time the banner mounts. The
  // streakStore.recordVisit call is idempotent (no-op on second
  // call within the same local day), so this is safe to run on
  // every mount.
  useEffect(() => {
    try { recordVisit(); } catch { /* never propagate */ }
  }, []);

  const message = useMemo(() => {
    const retention = getRetentionState();
    return pickReminderMessage({
      retention,
      missedYesterday: missedYesterday(),
      daysSinceVisit:  daysSinceLastVisit(),
      weather,
      todayCompleted,
    });
  }, [weather, todayCompleted]);

  // Fire a browser notification at most once per day, only when
  // permission is already granted (we never prompt here — that's
  // a user-gesture flow). Skip the all-done variant — no need to
  // notify a farmer who already finished their work.
  useEffect(() => {
    if (!message || message.variant === 'all_done') return;
    try {
      if (!shouldShowReminderToday()) return;
      const text = tStrict(message.key, message.fallback);
      if (!text) return;
      const fired = maybeShowBrowserNotification(text);
      // Mark shown whether or not the OS-level notification fired —
      // the inline banner is the canonical surface; the OS toast
      // is augmentation. Avoids the inline banner re-flashing on
      // every render once we've already informed the farmer.
      void fired;
      markReminderShown();
    } catch { /* never propagate from a render-time hook */ }
  }, [message]);

  if (!message) return null;

  const text = tStrict(message.key, message.fallback);
  if (!text) return null;
  const tone = TONE_STYLE[message.variant] || TONE_STYLE.default;

  const showCta = !todayCompleted && message.variant !== 'all_done';
  const ctaText = tStrict('retention.cta.continue', 'Continue');

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="daily-reminder-banner"
      data-variant={message.variant}
      style={{
        ...S.wrap,
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
      }}
    >
      <span style={S.text}>{text}</span>
      {showCta && typeof onCta === 'function' ? (
        <button
          type="button"
          onClick={onCta}
          style={S.cta}
          data-testid="daily-reminder-cta"
        >
          {ctaText} →
        </button>
      ) : null}
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 14px',
    borderRadius: 12,
    margin: '8px 0 12px',
    fontSize: 14,
    fontWeight: 600,
  },
  text: { flex: 1 },
  cta: {
    appearance: 'none',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'inherit',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  },
};
