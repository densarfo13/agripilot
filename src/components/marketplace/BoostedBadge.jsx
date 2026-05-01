/**
 * BoostedBadge — small "Boosted" chip for highlighted listings.
 *
 * Spec coverage (Marketplace monetization §1)
 *   • Boosted listing — show badge "Boosted".
 *
 * Reads `isBoosted(listingId)` and re-renders on
 * `farroway:boost_changed`. Returns null when the listing has no
 * active boost so the surrounding card stays calm.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isBoosted, BOOST_CHANGED_EVENT } from '../../market/boostStore.js';

const S = {
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 9px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, rgba(252,211,77,0.20), rgba(245,158,11,0.18))',
    border: '1px solid rgba(252,211,77,0.55)',
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  icon: { fontSize: 11, lineHeight: 1 },
};

export default function BoostedBadge({ listingId, style }) {
  useTranslation();
  const [active, setActive] = useState(() => {
    try { return isBoosted(listingId); } catch { return false; }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => {
      try { setActive(isBoosted(listingId)); } catch { /* swallow */ }
    };
    try {
      window.addEventListener(BOOST_CHANGED_EVENT, handler);
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(BOOST_CHANGED_EVENT, handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, [listingId]);

  if (!active) return null;

  return (
    <span
      style={{ ...S.chip, ...(style || null) }}
      data-testid={`market-boosted-badge-${listingId}`}
    >
      <span style={S.icon} aria-hidden="true">{'\u2728'}</span>
      <span>{tStrict('market.boost.badge', 'Boosted')}</span>
    </span>
  );
}
