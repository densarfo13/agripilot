/**
 * MarketplaceNudgeCard — Home-tab nudge surfacing demand +
 * suggested price for the user's primary crop, with a one-tap
 * "List now" CTA.
 *
 * Spec coverage (Funnel optimisation §8)
 *   • Demand + suggested price + "List now" CTA on Home.
 *
 * Strategy
 *   • Read primary crop from active farm (already canonical).
 *   • Read demand via marketDemand.getDemandForCrop.
 *   • Read suggested price via priceEngine.getReferencePrice.
 *   • Fire `marketplace_nudge_view` once per non-empty mount,
 *     `marketplace_nudge_click` on tap.
 *   • Self-suppresses when:
 *      - flag off
 *      - no active farm or no primary crop
 *      - the user already has an active listing for this crop
 *        (don't double-pitch)
 *      - dismissed for the session
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure read; never throws.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import { getDemandForCrop } from '../../market/marketDemand.js';
import { getReferencePrice } from '../../lib/pricing/priceEngine.js';
import { getActiveListings } from '../../market/marketStore.js';

const DISMISS_KEY = 'farroway_marketplace_nudge_dismissed';

function _readActiveFarm() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_active_farm');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

const S = {
  card: {
    background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(14,165,233,0.10))',
    border: '1px solid #22C55E',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#fff',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    boxShadow: '0 4px 18px rgba(34,197,94,0.18)',
    margin: '0 0 12px',
  },
  icon: { fontSize: 26, lineHeight: 1, flex: '0 0 auto' },
  body: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
  },
  title: { fontSize: 15, fontWeight: 800, color: '#fff' },
  metaLine: { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.45 },
  metaStrong: { fontWeight: 800, color: '#fff' },
  rowBtns: { display: 'flex', gap: 8, marginTop: 6 },
  primary: {
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ghost: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.20)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    padding: '8px 12px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default function MarketplaceNudgeCard({ style }) {
  useTranslation();
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('funnelOptimization');
  const [dismissed, setDismissed] = useState(() => {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch { return false; }
  });
  const viewedRef = useRef(false);

  const farm    = useMemo(() => _readActiveFarm(), []);
  const crop    = String(farm?.crop || farm?.plantId || '').trim();
  const country = String(farm?.country || '').trim();
  const region  = String(farm?.region || '').trim();

  const demand = useMemo(() => {
    if (!crop) return null;
    try { return getDemandForCrop({ crop, country, region }); }
    catch { return null; }
  }, [crop, country, region]);

  const price = useMemo(() => {
    if (!crop || !country) return null;
    try { return getReferencePrice({ crop, country }); }
    catch { return null; }
  }, [crop, country]);

  // Suppress when the user already has an active listing for
  // this crop — don't nag a farmer who's already on it.
  const alreadyListed = useMemo(() => {
    if (!crop || !farm?.id) return false;
    let listings = [];
    try { listings = getActiveListings() || []; } catch { listings = []; }
    return listings.some((l) =>
      l && l.farmId === farm.id
        && String(l.crop || '').toLowerCase() === crop.toLowerCase()
        && String(l.status || '').toUpperCase() === 'ACTIVE');
  }, [crop, farm]);

  const eligible = flagOn
    && !dismissed
    && !!crop
    && !alreadyListed
    && !!demand
    && (demand.count || 0) > 0;

  useEffect(() => {
    if (!eligible) return;
    if (viewedRef.current) return;
    viewedRef.current = true;
    try {
      trackEvent('marketplace_nudge_view', {
        crop,
        country: country || null,
        demandCount: demand?.count || 0,
        hasPrice: !!price,
      });
    } catch { /* swallow */ }
  }, [eligible, crop, country, demand, price]);

  const handleList = useCallback(() => {
    try {
      trackEvent('marketplace_nudge_click', {
        crop,
        demandCount: demand?.count || 0,
      });
    } catch { /* swallow */ }
    try { navigate('/sell'); }
    catch { /* swallow */ }
  }, [navigate, crop, demand]);

  const handleDismiss = useCallback(() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(DISMISS_KEY, 'true');
      }
    } catch { /* swallow */ }
    try { trackEvent('marketplace_nudge_dismiss', { crop }); }
    catch { /* swallow */ }
    setDismissed(true);
  }, [crop]);

  if (!eligible) return null;

  const cropLabel = crop.charAt(0).toUpperCase() + crop.slice(1);
  const priceFormatted = price && Number.isFinite(Number(price.price))
    ? `${price.price} ${price.currency || ''}${price.unit ? ' / ' + price.unit : ''}`.trim()
    : '';

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="marketplace-nudge-card"
      data-crop={crop}
    >
      <span style={S.icon} aria-hidden="true">{'\uD83D\uDCB0'}</span>
      <div style={S.body}>
        <span style={S.eyebrow}>
          {tStrict('home.marketplaceNudge.eyebrow', 'Marketplace')}
        </span>
        <span style={S.title}>
          {tStrict(
            'home.marketplaceNudge.title',
            '{count} buyers looking for {crop}',
          )
            .replace('{count}', String(demand.count))
            .replace('{crop}',  cropLabel)}
        </span>
        {priceFormatted ? (
          <span style={S.metaLine}>
            {tStrict('home.marketplaceNudge.priceLine', 'Suggested price: ')}
            <strong style={S.metaStrong}>{priceFormatted}</strong>
          </span>
        ) : null}
        <div style={S.rowBtns}>
          <button
            type="button"
            onClick={handleList}
            style={S.primary}
            data-testid="marketplace-nudge-list"
          >
            {tStrict('home.marketplaceNudge.cta', 'List now')}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            style={S.ghost}
            data-testid="marketplace-nudge-dismiss"
          >
            {tStrict('common.notNow', 'Not now')}
          </button>
        </div>
      </div>
    </section>
  );
}
