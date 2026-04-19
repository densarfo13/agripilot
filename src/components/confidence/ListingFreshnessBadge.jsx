/**
 * ListingFreshnessBadge — shows "Fresh / Recent / May be out of
 * date" on marketplace listing cards based on the listing
 * confidence object. Uses existing i18n keys if provided,
 * otherwise falls back to English defaults.
 *
 * Usage:
 *   import { getListingConfidence } from '@/utils/getListingConfidence';
 *   <ListingFreshnessBadge
 *     listing={listing}
 *     t={t}
 *   />
 */

import { useMemo } from 'react';
import { getListingConfidence } from '../../utils/getListingConfidence.js';
import { listingFreshnessKey }  from '../../utils/confidenceWording.js';

function resolve(t, { key, fallback }) {
  if (typeof t !== 'function') return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
}

const LEVEL_STYLES = {
  high:   { background: '#1b5e20', color: '#e8f5e9' },
  medium: { background: '#424242', color: '#eeeeee' },
  low:    { background: '#b71c1c', color: '#ffebee' },
};

export default function ListingFreshnessBadge({ listing, t = null, now = Date.now() }) {
  const confidence = useMemo(() => getListingConfidence(listing || {}, now),
                              [listing, now]);
  const { key, fallback } = listingFreshnessKey(confidence);
  const text = resolve(t, { key, fallback });
  const style = LEVEL_STYLES[confidence.level] || LEVEL_STYLES.medium;

  return (
    <span
      className={`listing-freshness-badge listing-freshness-badge--${confidence.level}`}
      data-confidence-level={confidence.level}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        ...style,
      }}
    >
      {text}
    </span>
  );
}
