/**
 * ScarcityBadges — "Limited" + "High demand" chips on a listing.
 *
 * Spec coverage (Marketplace revenue scale §4)
 *   • Limited quantity
 *   • High demand
 *
 * Self-suppresses when neither flag fires so calm listings stay
 * calm.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational. Caller passes `listing` once; demand
 *     lookup is delegated to `getScarcity` (which itself is a
 *     thin shim over the existing marketDemand store).
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getScarcity } from '../../market/scarcityIndicators.js';

const TONES = {
  limited:    { color: '#FCA5A5', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.32)' },
  highDemand: { color: '#FCD34D', bg: 'rgba(252,211,77,0.10)', border: 'rgba(252,211,77,0.32)' },
};

const S = {
  row: { display: 'flex', flexWrap: 'wrap', gap: 6 },
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

export default function ScarcityBadges({ listing, style }) {
  useTranslation();
  const flags = useMemo(() => getScarcity(listing), [listing]);

  if (!flags.limited && !flags.highDemand) return null;

  return (
    <div style={{ ...S.row, ...(style || null) }} data-testid="market-scarcity-badges">
      {flags.limited ? (
        <span
          style={{
            ...S.chip,
            color: TONES.limited.color,
            background: TONES.limited.bg,
            border: `1px solid ${TONES.limited.border}`,
          }}
          data-testid="market-scarcity-limited"
        >
          <span style={S.icon} aria-hidden="true">{'\u26A0'}</span>
          <span>{tStrict('market.scarcity.limited', 'Limited quantity')}</span>
        </span>
      ) : null}
      {flags.highDemand ? (
        <span
          style={{
            ...S.chip,
            color: TONES.highDemand.color,
            background: TONES.highDemand.bg,
            border: `1px solid ${TONES.highDemand.border}`,
          }}
          data-testid="market-scarcity-high-demand"
        >
          <span style={S.icon} aria-hidden="true">{'\uD83D\uDD25'}</span>
          <span>
            {tStrict('market.scarcity.highDemand', 'High demand')}
          </span>
        </span>
      ) : null}
    </div>
  );
}
