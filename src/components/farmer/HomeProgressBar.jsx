/**
 * HomeProgressBar — small daily-completion progress bar shown on
 * the farmer home surface.
 *
 * Core Product Signal §3 + §7 (May 2026)
 * ──────────────────────────────────────
 * Progress is reinforcement, never a warning. The legacy
 * "0/100 Needs attention" flag is gone — the bar now speaks in
 * one of two states only:
 *
 *   • Tasks remaining → "You're on track — {n} step(s) left today"
 *   • All tasks done  → "Nice — you're done for today"
 *
 * The visual fill still tracks completion, but the colour is
 * always green (encouragement), never amber/red. No status pill
 * that contradicts the line — the headline IS the status.
 *
 * Design rules
 * ────────────
 *   • Read-only — never mutates state.
 *   • Self-hides when totalTasks <= 0.
 *   • All visible text via tStrict.
 *
 * Props
 * ─────
 *   doneToday    number — today's completion count
 *   totalToday   number — today's total assigned tasks
 *   streakDays   number — current streak (defaults to read from store)
 */

import { useMemo } from 'react';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';
import { getRetentionState } from '../../lib/retention/streakStore.js';

function _toNumber(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function HomeProgressBar({
  doneToday,
  totalToday,
  streakDays,
}) {
  // Subscribe to language change so labels refresh on flip.
  useTranslation();

  const done  = _toNumber(doneToday, 0);
  const total = _toNumber(totalToday, 0);

  // Resolve streak from the retention store when the parent didn't
  // pass it (most sites don't have it readily available).
  const streak = useMemo(() => {
    if (Number.isFinite(streakDays)) return _toNumber(streakDays, 0);
    try { return _toNumber(getRetentionState().streakDays, 0); }
    catch { return 0; }
  }, [streakDays]);

  if (total <= 0) return null;

  const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  const remaining = Math.max(0, total - done);
  const allDone = remaining === 0;

  // Spec §3 wording. Two states only. Streak is informational only
  // and surfaces as a tiny suffix when present, never as a warning.
  let headline;
  if (allDone) {
    headline = tStrict('progress.allDone', 'Nice \u2014 you\u2019re done for today');
  } else if (remaining === 1) {
    headline = tStrict(
      'progress.stepsLeft.one',
      'You\u2019re on track \u2014 1 step left today',
    );
  } else {
    headline = tStrict(
      'progress.stepsLeft.other',
      `You\u2019re on track \u2014 ${remaining} steps left today`,
      { n: remaining },
    );
  }

  // Status data-attr kept for analytics + assertions, but always
  // green-toned now (reinforcement-only — never "needs_attention").
  const status = allDone ? 'all_done' : 'on_track';

  return (
    <div
      style={S.wrap}
      data-testid="home-progress-bar"
      data-status={status}
      data-streak={streak || 0}
      role="group"
      aria-label={headline}
    >
      <div style={S.track} aria-hidden="true">
        <div
          style={{
            ...S.fill,
            width: pct + '%',
            background: '#22C55E',
          }}
        />
      </div>
      <span
        style={S.headline}
        data-testid="home-progress-headline"
        // Keep raw counts machine-readable for analytics that
        // previously parsed the rendered string.
        data-count={`${done}/${total}`}
      >
        {headline}
      </span>
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 12,
    border: '1px solid rgba(34,197,94,0.18)',
    background: 'rgba(34,197,94,0.06)',
    margin: '6px 0 12px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    transition: 'width 240ms ease, background 240ms ease',
  },
  headline: {
    fontWeight: 700,
    color: '#fff',
    fontSize: 13,
  },
};
