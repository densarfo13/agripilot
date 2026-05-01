/**
 * RecurringOrderToggle — "Make this a weekly supply" toggle that
 * appears in the InterestForm success state.
 *
 * Spec coverage (Marketplace revenue scale §2)
 *   • Allow buyers to request weekly supply.
 *
 * Behaviour
 *   • Lives next to the "Thanks — the seller will be notified"
 *     confirmation. Tapping it saves a recurring-order record
 *     for (buyerId, crop) at weekly frequency.
 *   • Idempotent — the marketStore will update an existing record
 *     instead of duplicating, so a double-tap is safe.
 *   • Shows a tiny success state once saved so the buyer knows
 *     it stuck.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Self-hides when the buyer has no resolvable id or no crop
 *     on the listing — saving without context is meaningless.
 */

import { useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import {
  saveRecurringOrder,
  isCropOnRecurring,
} from '../../market/recurringOrders.js';

const S = {
  panel: {
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.32)',
    borderRadius: 12,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#E5F4EC',
  },
  body: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: 700, color: '#fff' },
  copy:  { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.45 },
  cta: {
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flex: '0 0 auto',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: 800,
    flex: '0 0 auto',
  },
};

export default function RecurringOrderToggle({
  listing,
  buyerId,
  buyerName = '',
  style,
}) {
  useTranslation();
  const [saved, setSaved] = useState(() => {
    try { return isCropOnRecurring(buyerId, listing?.crop); }
    catch { return false; }
  });

  if (!listing || !listing.crop || !buyerId) return null;

  const handleSave = () => {
    try {
      saveRecurringOrder({
        buyerId,
        buyerName,
        crop:    listing.crop,
        frequency: 'weekly',
        region:  listing.location?.region  || null,
        country: listing.location?.country || null,
      });
      setSaved(true);
    } catch { /* swallow */ }
  };

  return (
    <div style={{ ...S.panel, ...(style || null) }} data-testid="market-recurring-toggle">
      <span style={S.body}>
        <span style={S.title}>
          {tStrict('market.recurring.title',
            'Want this every week?')}
        </span>
        <span style={S.copy}>
          {tStrict('market.recurring.copy',
            'Save a weekly supply request and we\u2019ll match you to fresh listings.')}
        </span>
      </span>
      {saved ? (
        <span style={S.pill} data-testid="market-recurring-saved">
          <span aria-hidden="true">{'\u2714'}</span>
          <span>{tStrict('market.recurring.savedPill', 'Weekly')}</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          style={S.cta}
          data-testid="market-recurring-cta"
        >
          {tStrict('market.recurring.cta', 'Set weekly')}
        </button>
      )}
    </div>
  );
}
