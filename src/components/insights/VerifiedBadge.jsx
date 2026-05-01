/**
 * VerifiedBadge — surfaces the existing `verificationStore`'s
 * level on a per-listing basis.
 *
 * Spec coverage (Long-term moat §5)
 *   • verified users
 *
 * Levels (computed by verificationStore.computeVerificationLevel):
 *   3 photo + GPS + timestamp  → "Verified" (green)
 *   2 GPS + timestamp           → "Verified" (green, lower opacity)
 *   1 timestamp only            → "Logged" (neutral)
 *   0 nothing                   → null (no badge)
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; never throws.
 *   • Reads via `getMaxLevelForAction` (lazy) so the import
 *     graph stays light for surfaces that never render this.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const TONES = {
  high:  { color: '#86EFAC', bg: 'rgba(34,197,94,0.14)',  border: 'rgba(34,197,94,0.45)' },
  mid:   { color: '#86EFAC', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.28)' },
  low:   { color: 'rgba(255,255,255,0.78)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.18)' },
};

const S = {
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  icon: { fontSize: 11, lineHeight: 1 },
};

/**
 * @param {object} props
 * @param {string} props.listingId    actionId in verificationStore
 * @param {object} [props.style]
 */
export default function VerifiedBadge({ listingId, style }) {
  useTranslation();
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!listingId) return undefined;
    (async () => {
      try {
        const mod = await import('../../verification/verificationStore.js');
        if (!mod || typeof mod.getMaxLevelForAction !== 'function') return;
        const lvl = Number(mod.getMaxLevelForAction(listingId)) || 0;
        if (!cancelled) setLevel(Math.max(0, Math.min(3, lvl)));
      } catch { /* swallow */ }
    })();
    return () => { cancelled = true; };
  }, [listingId]);

  if (level <= 0) return null;

  const tone = level >= 3 ? TONES.high : level >= 2 ? TONES.mid : TONES.low;
  const labelKey = level >= 2
    ? 'market.verified.badge'
    : 'market.verified.logged';
  const labelFallback = level >= 2 ? 'Verified' : 'Logged';

  return (
    <span
      style={{
        ...S.chip,
        color: tone.color,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        ...(style || null),
      }}
      data-testid={`market-verified-badge-${listingId}`}
      data-level={level}
    >
      <span style={S.icon} aria-hidden="true">{'\u2714'}</span>
      <span>{tStrict(labelKey, labelFallback)}</span>
    </span>
  );
}
