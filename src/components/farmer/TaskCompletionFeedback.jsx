/**
 * TaskCompletionFeedback — post-completion panel matching spec §3.
 *
 * Renders the exact mock from the spec:
 *
 *   --------------------------------
 *   ✅ Task completed
 *
 *   🔥 {streak}-day streak
 *
 *   You're on track.
 *
 *   Next:
 *   {nextTask.title}
 *   --------------------------------
 *
 *   [ Continue → ]
 *
 * Composability
 * ─────────────
 * The component is presentational only. The parent owns:
 *   • when to show it (after `completeFarmerTask` resolves)
 *   • the `nextTask` lookup (already in the loop state machine)
 *   • the `onContinue` action (typically: hide the panel + advance
 *     the loop's next-up task)
 *
 * Streak handling
 * ───────────────
 * Reads from `getRetentionState()` so the streak chip reflects the
 * latest count. The parent should call `recordCompletion()` from
 * `streakStore.js` BEFORE rendering this panel — the order matters
 * because `recordCompletion` is idempotent (safe to call from
 * multiple completion sites) but must run first for the chip text
 * to show today's streak.
 *
 * Visible text
 * ────────────
 * All strings route through `tStrict` so non-English UIs never see
 * an English fallback. The streak chip uses `{count}` interpolation
 * via the existing `t(key, vars)` mechanism.
 */

import { useMemo } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';
import { getRetentionState } from '../../lib/retention/streakStore.js';
import { pickMicroReward } from '../../lib/retention/reminderEngine.js';

export default function TaskCompletionFeedback({
  open,
  nextTaskTitle = '',
  onContinue,
  onClose,
}) {
  const { t } = useTranslation();

  // Streak reads on every open so the chip reflects the latest
  // recordCompletion() call from the parent.
  const streakDays = useMemo(() => {
    if (!open) return 0;
    try { return getRetentionState().streakDays || 0; }
    catch { return 0; }
  }, [open]);

  // Micro-reward: deterministic per-day, so the same string sits
  // on the panel even if the parent re-mounts during animation.
  const micro = useMemo(() => (open ? pickMicroReward() : null), [open]);

  if (!open) return null;

  const completedLabel = tStrict('retention.completed.title', 'Task completed');
  const onTrackLabel   = tStrict('retention.completed.onTrack', "You're on track.");
  const nextLabel      = tStrict('retention.completed.next', 'Next:');
  const continueLabel  = tStrict('retention.cta.continue', 'Continue');
  const closeLabel     = tStrict('retention.cta.close', 'Close');
  // Spec v2 §2: explicit "+1 progress" line shown alongside the
  // streak chip so the farmer sees both the running total (streak)
  // and the per-completion delta. Stays subtle.
  const progressDeltaLabel = tStrict('retention.completed.progressDelta', '+1 progress');

  // Streak text uses interpolation when the key has a `{count}`
  // token; pass count via the bound t. Hides entirely when streak
  // is 0 (a fresh first-day completion shows other context, not a
  // chip with "0").
  const streakLabel = streakDays > 0
    ? (t('retention.completed.streak', { count: streakDays })
       || `${streakDays}-day streak`)
    : '';

  const microLabel = micro ? tStrict(micro.key, micro.fallback) : '';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="task-completion-feedback"
      style={S.wrap}
    >
      <div style={S.row}>
        <span style={S.checkIcon} aria-hidden="true">✅</span>
        <strong style={S.title}>{completedLabel}</strong>
      </div>

      {streakLabel ? (
        <div style={S.streakRow} data-testid="completion-streak">
          <span style={S.flame} aria-hidden="true">🔥</span>
          <span style={S.streakText}>{streakLabel}</span>
          {progressDeltaLabel ? (
            <span style={S.progressDelta} aria-label={progressDeltaLabel}>
              {progressDeltaLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {microLabel ? (
        <div style={S.micro}>{microLabel}</div>
      ) : (
        <div style={S.micro}>{onTrackLabel}</div>
      )}

      {nextTaskTitle ? (
        <div style={S.nextRow} data-testid="completion-next">
          <span style={S.nextLabel}>{nextLabel}</span>
          <span style={S.nextTitle}>{nextTaskTitle}</span>
        </div>
      ) : null}

      <div style={S.ctaRow}>
        <button
          type="button"
          onClick={onContinue}
          style={S.cta}
          data-testid="completion-continue"
        >
          {continueLabel} →
        </button>
        {/* Close button — present even when the parent reuses
            `onContinue` for both. We default the close handler to
            the continue handler so there's no dead control. */}
        <button
          type="button"
          onClick={onClose || onContinue}
          style={S.ctaSecondary}
          data-testid="completion-close"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

const S = {
  wrap: {
    margin: '12px 0',
    padding: '16px',
    borderRadius: 14,
    border: '1px solid rgba(34,197,94,0.30)',
    background: 'rgba(34,197,94,0.08)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row:        { display: 'flex', alignItems: 'center', gap: 8 },
  checkIcon:  { fontSize: 22 },
  title:      { fontSize: 16, fontWeight: 700 },
  streakRow:  { display: 'flex', alignItems: 'center', gap: 6 },
  flame:      { fontSize: 18 },
  streakText: { fontSize: 14, fontWeight: 600, color: '#FCD34D' },
  micro:      { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  nextRow:    { marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  nextLabel:  { color: 'rgba(255,255,255,0.55)', marginRight: 6 },
  nextTitle:  { fontWeight: 600 },
  ctaRow: {
    marginTop: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cta: {
    appearance: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    border: 'none',
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  ctaSecondary: {
    appearance: 'none',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.18)',
    padding: '9px 14px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  progressDelta: {
    fontSize: 12,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.18)',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.35)',
  },
};
