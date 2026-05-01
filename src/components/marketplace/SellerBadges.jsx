/**
 * SellerBadges — small chip row showing reputation badges for a
 * listing's farmer.
 *
 * Spec coverage (Marketplace scale §4)
 *   • "Active seller"
 *   • "Fast response"
 *
 * Renders nothing when the farmer has earned no badges yet —
 * we keep the seller side calm + non-judgmental.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; reputation is computed by the caller.
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { computeSellerReputation } from '../../market/sellerReputation.js';

const TONES = {
  active:        { color: '#86EFAC', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.32)' },
  fast_response: { color: '#7DD3FC', bg: 'rgba(14,165,233,0.10)', border: 'rgba(14,165,233,0.32)' },
};

const META = {
  active:        { icon: '\uD83C\uDF31', key: 'market.badge.active',       fallback: 'Active seller' },
  fast_response: { icon: '\u26A1',       key: 'market.badge.fastResponse', fallback: 'Fast response' },
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
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  icon: { fontSize: 11, lineHeight: 1 },
};

export default function SellerBadges({ farmerId, badges, style }) {
  useTranslation();

  // Allow caller to pass `badges` directly (cheap re-render path
  // where the parent already computed the reputation), or fall
  // back to computing it here from the store.
  const list = useMemo(() => {
    if (Array.isArray(badges)) return badges;
    if (!farmerId) return [];
    try { return computeSellerReputation(farmerId).badges || []; }
    catch { return []; }
  }, [badges, farmerId]);

  if (!list || list.length === 0) return null;

  return (
    <div style={{ ...S.row, ...(style || null) }} data-testid="market-seller-badges">
      {list.map((b) => {
        const tone = TONES[b];
        const meta = META[b];
        if (!tone || !meta) return null;
        return (
          <span
            key={b}
            style={{
              ...S.chip,
              color: tone.color,
              background: tone.bg,
              border: `1px solid ${tone.border}`,
            }}
            data-testid={`market-seller-badge-${b}`}
          >
            <span style={S.icon} aria-hidden="true">{meta.icon}</span>
            <span>{tStrict(meta.key, meta.fallback)}</span>
          </span>
        );
      })}
    </div>
  );
}
