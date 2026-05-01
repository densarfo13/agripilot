/**
 * BoostListingButton — farmer-side "Boost listing" CTA + confirm
 * sheet.
 *
 * Spec coverage (Marketplace monetization §1, §5)
 *   • optional paid feature; emits `boost_click`
 *   • after confirmation, stamps a 24h boost on the listing
 *
 * Behaviour
 *   • If the listing is already boosted, renders a calm "Boosted
 *     · Xh left" pill instead of the CTA.
 *   • Tap on the CTA opens a confirm sheet that previews the
 *     benefit + an explicit "Boost for 24 hours" button.
 *   • Confirmation calls `boostListing(id)` which emits
 *     `boost_click` + writes the local boost record.
 *   • Production drop-in: pass `onConfirm` to wire the confirm
 *     button to a real billing surface.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws.
 *   • No-op when `marketMonetization` is off (returns null).
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import {
  boostListing,
  isBoosted,
  BOOST_CHANGED_EVENT,
} from '../../market/boostStore.js';
import { getBoostPrice } from '../../market/pricingVariants.js';

const S = {
  cta: {
    appearance: 'none',
    border: '1px solid rgba(252,211,77,0.55)',
    background: 'rgba(252,211,77,0.10)',
    color: '#FCD34D',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  },
  activePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, rgba(252,211,77,0.20), rgba(245,158,11,0.18))',
    border: '1px solid rgba(252,211,77,0.55)',
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
  },
  sheet: {
    background: '#0F1B2D',
    color: '#fff',
    width: '100%',
    maxWidth: 520,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    boxShadow: '0 -8px 30px rgba(0,0,0,0.45)',
    padding: '20px 18px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxSizing: 'border-box',
  },
  title: { margin: 0, fontSize: 18, fontWeight: 800 },
  copy:  { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  bullets: { margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55 },
  rowBtns: { display: 'flex', gap: 8, marginTop: 4 },
  primary: {
    appearance: 'none',
    flex: '2 1 0',
    border: 'none',
    background: '#FCD34D',
    color: '#0B1D34',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ghost: {
    appearance: 'none',
    flex: '1 1 0',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

const BENEFIT_KEYS = [
  { key: 'market.boost.benefit.top',     fallback: 'Top of buyer feed for 24 hours' },
  { key: 'market.boost.benefit.badge',   fallback: 'Eye-catching "Boosted" badge'   },
  { key: 'market.boost.benefit.density', fallback: 'Wins same-crop tie-breakers'     },
];

export default function BoostListingButton({ listing, onConfirm, style }) {
  useTranslation();
  const flagOn = isFeatureEnabled('marketMonetization');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => {
    try { return listing?.id ? isBoosted(listing.id) : false; }
    catch { return false; }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => {
      try { setActive(listing?.id ? isBoosted(listing.id) : false); }
      catch { /* swallow */ }
    };
    try { window.addEventListener(BOOST_CHANGED_EVENT, handler); }
    catch { /* swallow */ }
    return () => {
      try { window.removeEventListener(BOOST_CHANGED_EVENT, handler); }
      catch { /* swallow */ }
    };
  }, [listing && listing.id]);

  const handleConfirm = useCallback(() => {
    if (!listing || !listing.id) return;
    if (typeof onConfirm === 'function') {
      try { onConfirm(listing); } catch { /* swallow */ }
      setOpen(false);
      return;
    }
    // Local-first demo path: stamp the boost. Production drop-in
    // is the `onConfirm` handler above (which navigates to /billing
    // before stamping).
    try { boostListing(listing.id, { source: 'farmer_panel' }); }
    catch { /* swallow */ }
    setOpen(false);
  }, [listing, onConfirm]);

  if (!flagOn || !listing || !listing.id) return null;

  if (active) {
    return (
      <span
        style={{ ...S.activePill, ...(style || null) }}
        data-testid={`market-boost-active-${listing.id}`}
      >
        <span aria-hidden="true">{'\u2728'}</span>
        <span>{tStrict('market.boost.badge', 'Boosted')}</span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...S.cta, ...(style || null) }}
        data-testid={`market-boost-cta-${listing.id}`}
      >
        <span aria-hidden="true">{'\u2728'}</span>
        <span>{tStrict('market.boost.cta', 'Boost listing')}</span>
      </button>

      {open ? (
        <div
          style={S.overlay}
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          data-testid="market-boost-sheet"
        >
          <div
            style={S.sheet}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={S.title}>
              {tStrict('market.boost.title', 'Boost this listing')}
            </h2>
            <p style={S.copy}>
              {tStrict('market.boost.copy',
                'Reach more buyers for 24 hours. We surface boosted listings at the top of the buyer feed.')}
            </p>
            {isFeatureEnabled('marketRevenueScale') && listing?.farmerId ? (() => {
              const variant = getBoostPrice(listing.farmerId);
              if (!variant.price) return null;
              return (
                <p
                  style={{ ...S.copy, color: '#FCD34D', fontWeight: 700 }}
                  data-testid="market-boost-price"
                  data-variant={variant.variant}
                >
                  {tStrict('market.boost.price',
                    '{price} {currency} for 24 hours')
                    .replace('{price}',    String(variant.price))
                    .replace('{currency}', variant.currency)}
                </p>
              );
            })() : null}
            <ul style={S.bullets}>
              {BENEFIT_KEYS.map((b) => (
                <li key={b.key}>{tStrict(b.key, b.fallback)}</li>
              ))}
            </ul>
            <div style={S.rowBtns}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={S.ghost}
                data-testid="market-boost-cancel"
              >
                {tStrict('common.notNow', 'Not now')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={S.primary}
                data-testid="market-boost-confirm"
              >
                {tStrict('market.boost.confirmCta', 'Boost for 24 hours')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
