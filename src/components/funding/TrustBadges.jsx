/**
 * TrustBadges — verified / no-fee / trusted row.
 *
 * Spec coverage (Funding upgrade §7)
 *   • Verified program
 *   • No application fee
 *   • Trusted organization
 *
 * Per-card overrides
 *   The component reads `card.trust` when present so individual
 *   programs can opt out of any badge:
 *
 *     card.trust = { verified, noFee, trusted }   (all default true)
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; never reads storage.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const S = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.32)',
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  icon: { fontSize: 12, lineHeight: 1 },
};

const DEFAULT_TRUST = Object.freeze({ verified: true, noFee: true, trusted: true });

export default function TrustBadges({ card = {}, style }) {
  useTranslation();

  const t = { ...DEFAULT_TRUST, ...(card?.trust || {}) };

  // Render only enabled badges so a card that genuinely DOES carry
  // an application fee (we set noFee:false in the catalog) doesn't
  // get a misleading badge.
  const items = [];
  if (t.verified) {
    items.push({
      key:  'verified',
      icon: '\u2714',                      // check mark
      label: tStrict('funding.trust.verified', 'Verified program'),
    });
  }
  if (t.noFee) {
    items.push({
      key:  'noFee',
      icon: '\uD83D\uDCB8',                // money flying — cost-free
      label: tStrict('funding.trust.noFee', 'No application fee'),
    });
  }
  if (t.trusted) {
    items.push({
      key:  'trusted',
      icon: '\uD83E\uDD1D',                // handshake
      label: tStrict('funding.trust.trusted', 'Trusted organization'),
    });
  }

  if (items.length === 0) return null;

  return (
    <div style={{ ...S.row, ...(style || null) }} data-testid="funding-trust-badges">
      {items.map((it) => (
        <span key={it.key} style={S.badge} data-testid={`funding-trust-${it.key}`}>
          <span style={S.icon} aria-hidden="true">{it.icon}</span>
          <span>{it.label}</span>
        </span>
      ))}
    </div>
  );
}
