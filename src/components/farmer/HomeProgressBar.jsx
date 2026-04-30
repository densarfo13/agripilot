/**
 * HomeProgressBar — small daily-completion progress bar shown on
 * the farmer home surface (spec §5).
 *
 * Visual
 * ──────
 *   ┌───────────────────────────────────────────────┐
 *   │  Today  ████████░░░░  2 / 5    On track        │
 *   └───────────────────────────────────────────────┘
 *
 *   Status label is one of:
 *     • "On track"          — pct ≥ 60% OR all tasks done OR streak active
 *     • "Needs attention"   — pct <  60% AND no completion today
 *
 * Design rules
 * ────────────
 *   • Read-only — never mutates state.
 *   • Self-hides when totalTasks <= 0 (no clutter when there's
 *     literally nothing to track).
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
  const status = (pct >= 60 || done === total || streak > 0) ? 'on_track' : 'needs_attention';

  const todayLabel = tStrict('retention.progressBar.today', 'Today');
  const onTrackLabel = tStrict('retention.progressBar.onTrack', 'On track');
  const needsLabel   = tStrict('retention.progressBar.needsAttention', 'Needs attention');
  const statusLabel  = status === 'on_track' ? onTrackLabel : needsLabel;

  return (
    <div
      style={S.wrap}
      data-testid="home-progress-bar"
      data-status={status}
      role="group"
      aria-label={statusLabel}
    >
      <span style={S.todayLabel}>{todayLabel}</span>
      <div style={S.track} aria-hidden="true">
        <div
          style={{
            ...S.fill,
            width: pct + '%',
            background: status === 'on_track' ? '#22C55E' : '#F59E0B',
          }}
        />
      </div>
      <span style={S.count} data-testid="home-progress-count">
        {done}/{total}
      </span>
      <span
        style={{
          ...S.statusPill,
          color: status === 'on_track' ? '#86EFAC' : '#FCD34D',
          background: status === 'on_track' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
          borderColor: status === 'on_track' ? 'rgba(34,197,94,0.35)' : 'rgba(245,158,11,0.35)',
        }}
      >
        {statusLabel}
      </span>
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    margin: '6px 0 12px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    flexWrap: 'wrap',
  },
  todayLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  track: {
    flex: 1,
    minWidth: 90,
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    transition: 'width 240ms ease, background 240ms ease',
  },
  count: {
    fontWeight: 700,
    color: '#fff',
    minWidth: 36,
    textAlign: 'right',
  },
  statusPill: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '3px 10px',
    borderRadius: 999,
    border: '1px solid',
  },
};
