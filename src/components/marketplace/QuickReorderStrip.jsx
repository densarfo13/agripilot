/**
 * QuickReorderStrip — horizontal chip strip on /buy that lets a
 * returning buyer one-tap filter to a previously preferred crop.
 *
 * Spec coverage (Marketplace revenue scale §5)
 *   • Save preferences
 *   • Quick reorder
 *
 * Sources
 *   • `getBuyerPreferences(buyerId).crops` — newest-first
 *   • `getRecurringOrdersForBuyer(buyerId)` — if the buyer set
 *     up weekly supply for a crop, that crop is also surfaced
 *     so they can quickly check fresh listings.
 *
 * Behaviour
 *   • Tap a chip → calls `onCropPick(crop)` which the parent
 *     uses to filter the visible listings.
 *   • A small × on each chip removes it from preferences
 *     without affecting recurring orders.
 *   • Self-hides when the buyer has no preferences AND no
 *     recurring orders.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws — all storage reads in the helper modules
 *     are try/catch wrapped.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import {
  getBuyerPreferences,
  removeCropPreference,
  PREFS_CHANGED_EVENT,
} from '../../market/buyerPreferences.js';
import {
  getRecurringOrdersForBuyer,
  RECURRING_CHANGED_EVENT,
} from '../../market/recurringOrders.js';

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '10px 12px',
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    appearance: 'none',
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
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  chipActive: {
    background: '#22C55E',
    color: '#0B1D34',
    border: '1px solid #22C55E',
  },
  remove: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: 0,
    lineHeight: 1,
  },
  recurringTag: {
    fontSize: 9,
    fontWeight: 800,
    color: '#0B1D34',
    background: '#FCD34D',
    padding: '1px 5px',
    borderRadius: 999,
    marginLeft: 4,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
};

function _capitalize(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/**
 * @param {object} props
 * @param {string} props.buyerId
 * @param {string} [props.activeCrop]   currently filtered crop, or ''
 * @param {(crop: string) => void} props.onCropPick  '' clears the filter
 * @param {object} [props.style]
 */
export default function QuickReorderStrip({
  buyerId,
  activeCrop = '',
  onCropPick,
  style,
}) {
  useTranslation();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    try {
      window.addEventListener(PREFS_CHANGED_EVENT, handler);
      window.addEventListener(RECURRING_CHANGED_EVENT, handler);
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(PREFS_CHANGED_EVENT, handler);
        window.removeEventListener(RECURRING_CHANGED_EVENT, handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, []);

  const chips = useMemo(() => {
    if (!buyerId) return [];
    let prefs = { crops: [] };
    let recurring = [];
    try { prefs = getBuyerPreferences(buyerId) || prefs; } catch { /* swallow */ }
    try { recurring = getRecurringOrdersForBuyer(buyerId) || []; } catch { /* swallow */ }

    const recurringSet = new Set(
      (recurring || []).map((r) => String(r.crop || '').trim().toLowerCase()),
    );

    // Merge: preferences first (newest-first), then any recurring
    // crops not already in the prefs list. Cap at 8 chips so the
    // strip never overflows the screen.
    const seen = new Set();
    const out = [];
    for (const c of (prefs.crops || [])) {
      const k = String(c || '').trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({ crop: k, recurring: recurringSet.has(k) });
    }
    for (const c of recurringSet) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push({ crop: c, recurring: true });
    }
    return out.slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerId, tick]);

  const handlePick = (crop) => {
    const next = activeCrop === crop ? '' : crop;
    try {
      trackEvent('marketplace_quick_reorder_pick', { crop, cleared: next === '' });
    } catch { /* swallow */ }
    if (typeof onCropPick === 'function') {
      try { onCropPick(next); } catch { /* swallow */ }
    }
  };

  const handleRemove = (e, crop) => {
    e.stopPropagation();
    try { removeCropPreference(buyerId, crop); } catch { /* swallow */ }
  };

  if (!buyerId || chips.length === 0) return null;

  return (
    <section
      style={{ ...S.wrap, ...(style || null) }}
      data-testid="market-quick-reorder-strip"
    >
      <span style={S.label}>
        {tStrict('market.reorder.label', 'Quick reorder')}
      </span>
      <div style={S.row}>
        {chips.map(({ crop, recurring }) => {
          const active = activeCrop === crop;
          return (
            <button
              key={crop}
              type="button"
              onClick={() => handlePick(crop)}
              style={{ ...S.chip, ...(active ? S.chipActive : null) }}
              data-testid={`market-reorder-chip-${crop}`}
              data-active={active ? 'true' : 'false'}
            >
              <span>{_capitalize(crop)}</span>
              {recurring ? (
                <span style={S.recurringTag}>
                  {tStrict('market.reorder.weeklyTag', 'Weekly')}
                </span>
              ) : null}
              <span
                onClick={(e) => handleRemove(e, crop)}
                role="button"
                aria-label={tStrict('common.remove', 'Remove')}
                style={S.remove}
                data-testid={`market-reorder-remove-${crop}`}
              >
                {'\u2715'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
