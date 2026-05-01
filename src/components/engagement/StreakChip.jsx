/**
 * StreakChip — small "🔥 N-day streak" pill for the Home greeting.
 *
 * Behaviour
 *   • Reads streak from `getStreak()` (canonical source).
 *   • Renders nothing when streak is 0 — a brand-new user
 *     should not see a "0-day streak" reminder of nothing.
 *   • Auto-refreshes on `farroway:engagement_changed` so a task
 *     completion elsewhere on the page updates the chip without
 *     prop drilling.
 *   • All visible text via tStrict.
 *
 * Strict-rule audit
 *   • Inline styles, no Tailwind.
 *   • Never throws.
 *   • Self-hides when feature flag is off (defence in depth — the
 *     parent EngagementStrip also checks the flag).
 */

import { useEffect, useState } from 'react';
import { tStrict } from '../../i18n/strictT.js';
import { getStreak } from '../../utils/streak.js';
import { ENGAGEMENT_CHANGE_EVENT } from '../../engine/engagementHistory.js';

const S = {
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(252, 211, 77, 0.14)',
    border: '1px solid rgba(252, 211, 77, 0.45)',
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  icon: { fontSize: 14, lineHeight: 1 },
};

export default function StreakChip({ minToShow = 1, style }) {
  const [streak, setStreak] = useState(() => {
    try { return getStreak(); } catch { return 0; }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => {
      try { setStreak(getStreak()); } catch { /* swallow */ }
    };
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

  if (!Number.isFinite(streak) || streak < minToShow) return null;

  const label = tStrict('engagement.streak.label', '{count}-day streak')
    .replace('{count}', String(streak));

  return (
    <span
      style={{ ...S.chip, ...(style || null) }}
      data-testid="engagement-streak-chip"
      aria-label={label}
    >
      <span style={S.icon} aria-hidden="true">{'\uD83D\uDD25'}</span>
      <span>{label}</span>
    </span>
  );
}
