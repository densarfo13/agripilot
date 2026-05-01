/**
 * Sell — farmer-facing "list produce for sale" form.
 *
 *   <Route path="/sell" element={<Sell />} />
 *
 * Spec contract (Buyer + Funding/Impact merge, § 4):
 *   * Form: crop, quantity, unit (kg / bags / crates),
 *     ready date, optional price range, region (auto-filled
 *     from active farm).
 *   * Prefill `crop` + `region` from the active farm via
 *     ProfileContext.
 *   * Save listing locally via marketStore.saveListing.
 *   * Show success state with "Your produce is now visible
 *     to buyers."
 *   * If no farm exists, show empty-state pointing the
 *     farmer to set up their farm first.
 *
 * Strict-rule audit
 *   * Local-first — no backend requirement. Listings land in
 *     localStorage and surface in /marketplace immediately.
 *   * Offline-safe — saveListing never throws and the
 *     analytics layer queues `MARKET_LISTING_CREATED` for
 *     later sync.
 *   * Privacy — only farmerId / farmId are persisted.
 *     Phone / fullName / email NEVER touch the listing.
 *   * Calm UI — single-card layout, brand colours, mobile-
 *     first single column.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useAuth }    from '../context/AuthContext.jsx';
import {
  saveListing, getActiveListings, getBuyerInterests,
} from '../market/marketStore.js';
import { syncListing } from '../market/marketSync.js';
import { useTranslation } from '../i18n/index.js';
import { cropLabel } from '../utils/cropLabel.js';
import {
  saveVerification, tryReadGeolocation, ACTION_TYPES,
} from '../verification/verificationStore.js';
import { tSafe } from '../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import BrandLogo from '../components/BrandLogo.jsx';
import { ArrowRight } from '../components/icons/lucide.jsx';
import { isFeatureEnabled } from '../config/features.js';
import { trackEvent } from '../analytics/analyticsStore.js';
import useAutoPriceSuggestion from '../hooks/useAutoPriceSuggestion.js';
import MarketInsightCard from '../components/sell/MarketInsightCard.jsx';
import BuyerExplanation  from '../components/sell/BuyerExplanation.jsx';
import PostListingFlow   from '../components/sell/PostListingFlow.jsx';
import RegionDetectChip  from '../components/sell/RegionDetectChip.jsx';
import FarmerInterestPanel from '../components/marketplace/FarmerInterestPanel.jsx';

const C = FARROWAY_BRAND.colors;
const UNITS = ['kg', 'bags', 'crates'];

export default function Sell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, farms } = useProfile();
  // Subscribe to language change so the status card's localised
  // crop name + buyer-count line refresh on flip.
  const { lang } = useTranslation();

  // Pick the first active farm — every farmer starts with at
  // least one farm if they've completed onboarding. Caller
  // can swap this for a farm-picker in v2.
  const activeFarm = useMemo(() => {
    if (Array.isArray(farms) && farms.length) return farms[0];
    if (profile && profile.farmId) return profile;
    return null;
  }, [farms, profile]);

  // Active listings on this farm — read-only summary at the top
  // of the page. Filtered by farmId so multi-farm households only
  // see the relevant farm's listings. Buyer interests counted per
  // listing via marketStore. Both stores are localStorage-backed
  // so this is sync + offline-safe.
  const myActiveListings = useMemo(() => {
    const fid = activeFarm?.id || profile?.farmId || null;
    if (!fid) return [];
    let all;
    try { all = getActiveListings() || []; } catch { all = []; }
    return all.filter((l) => l && l.farmId === fid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFarm && activeFarm.id, profile && profile.farmId]);

  const interestsByListing = useMemo(() => {
    if (myActiveListings.length === 0) return {};
    let all;
    try { all = getBuyerInterests() || []; } catch { all = []; }
    const map = {};
    for (const i of all) {
      if (!i || !i.listingId) continue;
      map[i.listingId] = (map[i.listingId] || 0) + 1;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myActiveListings.length]);

  // Prefill from the active farm so the farmer just confirms
  // and adjusts the quantity / date.
  const [crop, setCrop]           = useState(
    activeFarm?.cropType || activeFarm?.crop || profile?.cropType || '',
  );
  const [quantity, setQuantity]   = useState('');
  const [unit, setUnit]           = useState('kg');
  const [readyDate, setReadyDate] = useState(() => {
    // Sensible default: 7 days out — most farmers list a few
    // days before harvest so buyers have time to plan.
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [priceRange, setPriceRange] = useState('');
  const [photoFile, setPhotoFile]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId]   = useState(null);
  // Sell screen V2 — flag-gated additions (default off).
  const v2On = isFeatureEnabled('sellScreenV2');
  // "Not sure yet" toggle for the quantity field. When on the
  // listing saves with `quantity: null` so buyers can still see
  // the offer and ask the farmer for a number directly.
  const [qtyUnknown, setQtyUnknown] = useState(false);
  // Track whether the user has manually edited the price input.
  // Auto-suggestion only writes when this stays false — once the
  // user types anything we never overwrite their value.
  const [priceTouched, setPriceTouched] = useState(false);
  // Detected region (filled in by RegionDetectChip on success).
  const [detectedRegion, setDetectedRegion]   = useState('');
  const [detectedCountry, setDetectedCountry] = useState('');
  const [errMsg, setErrMsg]         = useState('');

  // Effective region/country for insights + listing payload —
  // V2 prefers the freshly detected value, with the farm/profile
  // region as graceful fallback.
  const effectiveCountry = detectedCountry
    || activeFarm?.country
    || profile?.country
    || '';
  const effectiveRegion = detectedRegion
    || activeFarm?.region
    || profile?.region
    || '';

  // V2 auto price suggestion. Only prefills when the user has not
  // typed anything into the price field yet. We never overwrite a
  // human-typed value.
  const { formatted: pricePrefill } = useAutoPriceSuggestion({
    crop,
    country: effectiveCountry,
  });
  React.useEffect(() => {
    if (!v2On) return;
    if (priceTouched) return;
    if (!pricePrefill) return;
    setPriceRange(pricePrefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v2On, pricePrefill, priceTouched]);

  // Track `listing_viewed` once per page mount so analytics can
  // measure the form-funnel drop-off (view → submit → buyer).
  React.useEffect(() => {
    try { trackEvent('listing_viewed', { source: 'sell_page' }); }
    catch { /* swallow */ }
  }, []);

  // Empty-state: no farm yet → tell farmer where to go.
  if (!activeFarm && !profile?.farmId) {
    return (
      <main style={S.page}>
        <div style={S.card}>
          <BrandLogo variant="light" size="md" />
          <h1 style={S.title}>
            {tSafe('market.sellTitle', 'Sell your produce')}
          </h1>
          <p style={S.empty}>
            {tSafe('market.noFarmEmpty',
              'Add your farm before creating a listing.')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/profile/setup')}
            style={S.btnPrimary}
            data-testid="sell-no-farm-cta"
          >
            {tSafe('common.setUpFarm', 'Set up my farm')}
          </button>
        </div>
      </main>
    );
  }

  // Success state — listing saved.
  if (successId) {
    return (
      <main style={S.page}>
        <div style={S.card}>
          <span style={S.successIcon} aria-hidden="true">{'\u2705'}</span>
          <h1 style={S.title}>
            {tSafe('market.successTitle', 'Listing live')}
          </h1>
          <p style={S.lead}>
            {tSafe('market.success',
              'Your produce is now visible to buyers.')}
          </p>
          <div style={S.btnRow}>
            <button
              type="button"
              onClick={() => navigate('/marketplace')}
              style={S.btnPrimary}
              data-testid="sell-success-marketplace"
            >
              {tSafe('market.viewMarketplace', 'Open Marketplace')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSuccessId(null);
                setQuantity('');
                setPriceRange('');
                setQtyUnknown(false);
                setPriceTouched(false);
              }}
              style={S.btnGhost}
            >
              {tSafe('market.listAnother', 'List another crop')}
            </button>
          </div>
        </div>
        {/* V2: 3-step "what happens next" explainer below the
            existing success card. Self-suppresses when flag off. */}
        {v2On ? (
          <div style={{ marginTop: 12 }}>
            <PostListingFlow />
          </div>
        ) : null}
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrMsg('');
    if (submitting) return;

    const qty = Number(quantity);
    if (!crop.trim()) {
      setErrMsg(tSafe('market.error.cropRequired', 'Please enter a crop.'));
      return;
    }
    // V2: when "Not sure yet" is selected, skip the qty > 0 check
    // and persist null. Old flow keeps the strict qty validator.
    const qtyResolved = (v2On && qtyUnknown) ? null : qty;
    if (qtyResolved !== null && (!Number.isFinite(qty) || qty <= 0)) {
      setErrMsg(tSafe('market.error.qtyRequired',
        'Please enter a quantity greater than 0.'));
      return;
    }

    setSubmitting(true);
    try {
      const listing = saveListing({
        farmerId:   user?.sub || profile?.userId || null,
        farmId:     activeFarm?.id || profile?.farmId || null,
        crop:       crop.trim(),
        quantity:   qtyResolved,
        unit,
        readyDate,
        priceRange: priceRange.trim() || null,
        location: {
          lat:     activeFarm?.lat ?? activeFarm?.location?.lat ?? null,
          lng:     activeFarm?.lng ?? activeFarm?.location?.lng ?? null,
          region:  effectiveRegion,
          country: effectiveCountry,
        },
        status: 'ACTIVE',
      });
      // V2 spec §9: emit a canonical `listing_created` event with
      // the context buyers care about. The marketStore already
      // emits MARKET_LISTING_CREATED via safeTrackEvent — this is
      // the spec-name companion so dashboards can switch to either.
      try {
        trackEvent('listing_created', {
          listingId: listing?.id || null,
          crop:      crop.trim(),
          unit,
          quantity:  qtyResolved,
          region:    effectiveRegion,
          country:   effectiveCountry,
          priceSuggested: !priceTouched && !!pricePrefill,
        });
      } catch { /* swallow */ }
      // Fire-and-forget backend sync. Resolves true if the
      // v3 endpoint exists; on 404 / network blip the local
      // listing stays the source of truth and the user
      // never sees a failure.
      try { syncListing(listing); } catch { /* never block */ }

      // v3 Verification System: capture a best-effort
      // record alongside the listing. Photo + GPS are both
      // OPTIONAL — the listing succeeds at level 0 if the
      // farmer skipped them. Non-blocking: we surface the
      // success card after this resolves either way.
      //
      // Photo is passed as a raw File so IndexedDB can
      // store it at full resolution. The store falls back
      // to a 200 KB-capped data URL only when IDB is
      // unavailable (private-mode browsers).
      try {
        let lat = activeFarm?.lat ?? activeFarm?.location?.lat ?? null;
        let lng = activeFarm?.lng ?? activeFarm?.location?.lng ?? null;
        if (lat == null || lng == null) {
          const gps = await tryReadGeolocation(2500);
          if (gps) { lat = gps.lat; lng = gps.lng; }
        }
        // Don't await — verification persists in background;
        // the success card has already been queued below.
        saveVerification({
          farmerId:   user?.sub || profile?.userId || null,
          actionType: ACTION_TYPES.LISTING_CREATED,
          actionId:   listing.id,
          photoBlob:  photoFile || null,
          location: {
            lat, lng,
            region:  activeFarm?.region  || profile?.region  || '',
            country: activeFarm?.country || profile?.country || '',
          },
        });
      } catch { /* never block on verification */ }

      setSuccessId(listing.id);
    } catch (err) {
      setErrMsg(tSafe('market.error.saveFailed',
        'We could not save your listing. Try again in a moment.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={S.page}>
      {/* Spec §2: status overlay above the form. Renders one card
          per active listing on this farm (usually 0 or 1), with the
          buyer-interest count + a "View buyers" CTA. The form below
          stays as the create-listing surface — farmers can still
          add a NEW listing for a different crop / season. */}
      {myActiveListings.length > 0 && (
        <div
          style={S.statusWrap}
          data-testid="sell-active-listings-status"
        >
          {myActiveListings.map((l) => {
            const interestCount = interestsByListing[l.id] || 0;
            const cropText = cropLabel(l.crop, lang);
            const region = l.location?.region || '';
            const country = l.location?.country || '';
            const placeText = [region, country].filter(Boolean).join(', ');
            return (
              <article
                key={l.id}
                style={S.statusCard}
                data-testid={`sell-status-${l.id}`}
              >
                <h2 style={S.statusEyebrow}>
                  {tSafe('market.status.yourListing', 'Your listing')}
                </h2>
                {/* Title + meta on the left, inline buyer-count
                    chip on the right. The chip is the single tap
                    target — replaces the prior stacked "N buyers
                    interested" line + full-width "View buyers"
                    button. Buyer phone is never exposed; the chip
                    only shows the aggregate count and routes to
                    the marketplace detail (which itself respects
                    privacy). */}
                <div style={S.statusBody}>
                  <div style={S.statusInfo}>
                    <h3 style={S.statusTitle}>
                      {cropText || tSafe('market.unknownCrop', 'Crop')}
                      {' • '}
                      {l.quantity || 0} {l.unit || 'kg'}
                    </h3>
                    {placeText ? (
                      <p style={S.statusMeta}>{placeText}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    style={S.statusChip}
                    data-testid={`sell-status-view-buyers-${l.id}`}
                    onClick={() => {
                      // Route to the marketplace listing detail.
                      // Works for any role (no STAFF_ROLES gate).
                      try { navigate(`/marketplace?listing=${l.id}`); }
                      catch { /* ignore */ }
                    }}
                  >
                    <span>
                      {tSafe(
                        'market.status.viewBuyersChip',
                        `View buyers (${interestCount})`,
                      ).replace('{count}', String(interestCount))}
                    </span>
                    <ArrowRight size={14} />
                  </button>
                </div>
                {/* Marketplace transaction flow: inline interest
                    panel with status pills + Contact / Negotiate /
                    Accept actions + stale-interest nudge. The
                    legacy "View buyers" chip above stays for deep-
                    linking. Flag-off path: panel returns null. */}
                {isFeatureEnabled('marketTransactionFlow') ? (
                  <FarmerInterestPanel
                    listing={l}
                    farmerName={profile?.farmerName || profile?.fullName || ''}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <div style={S.card}>
        <BrandLogo variant="light" size="md" />
        <h1 style={S.title}>
          {tSafe('market.sellTitle', 'Sell your produce')}
        </h1>
        <p style={S.lead}>
          {tSafe('market.sellSubtitle',
            'Let buyers know when your crop is ready.')}
        </p>

        {errMsg && (
          <p style={S.formError} role="alert">{errMsg}</p>
        )}

        {/* F21 a11y fix: every input has explicit id + name +
            htmlFor on its label so the DevTools accessibility
            audit stops flagging "form field without id/name"
            and "no label associated with form field". The
            implicit label nesting also still works for screen
            readers — explicit htmlFor is just additionally
            robust. */}
        {/* V2: market insight (demand + avg price + nearby buyers).
            Mounts above the form so the farmer sees the signal
            before committing to a price. Returns null when crop
            is empty so we never render a half-card. */}
        {v2On ? (
          <div style={{ marginBottom: 12 }}>
            <MarketInsightCard
              crop={crop}
              country={effectiveCountry}
              region={effectiveRegion}
            />
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={S.form} noValidate>
          <label style={S.label} htmlFor="sell-crop">
            {tSafe('market.crop', 'Crop')}
            <input
              type="text"
              id="sell-crop"
              name="crop"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              placeholder="e.g. maize"
              style={S.input}
              data-testid="sell-crop"
              required
            />
          </label>

          <div style={S.row}>
            <label style={{ ...S.label, flex: 2 }} htmlFor="sell-qty">
              {tSafe('market.quantity', 'Quantity')}
              <input
                type="number"
                id="sell-qty"
                name="quantity"
                min="0"
                step="0.5"
                value={qtyUnknown ? '' : quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={qtyUnknown
                  ? tSafe('sell.qty.notSureYet', 'Not sure yet')
                  : '0'}
                style={{
                  ...S.input,
                  opacity: qtyUnknown ? 0.6 : 1,
                  cursor:  qtyUnknown ? 'not-allowed' : 'text',
                }}
                disabled={qtyUnknown}
                data-testid="sell-qty"
                required={!qtyUnknown}
              />
            </label>
            <label style={{ ...S.label, flex: 1 }} htmlFor="sell-unit">
              {tSafe('market.unit', 'Unit')}
              <select
                id="sell-unit"
                name="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={S.input}
                data-testid="sell-unit"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>

          {/* V2: "Not sure yet" toggle for the quantity field.
              When on, the listing saves with quantity:null so
              buyers can still see the offer. Off by default —
              farmers who know their tonnage continue as before. */}
          {v2On ? (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: 'rgba(255,255,255,0.78)',
                cursor: 'pointer',
                marginTop: -4,
              }}
              data-testid="sell-qty-unknown-toggle"
            >
              <input
                type="checkbox"
                checked={qtyUnknown}
                onChange={(e) => setQtyUnknown(e.target.checked)}
                style={{ accentColor: '#22C55E' }}
              />
              <span>
                {tSafe('sell.qty.notSureYet', 'Not sure yet \u2014 I\u2019ll confirm with the buyer')}
              </span>
            </label>
          ) : null}

          <label style={S.label} htmlFor="sell-ready-date">
            {tSafe('market.readyDate', 'Ready date')}
            <input
              type="date"
              id="sell-ready-date"
              name="readyDate"
              value={readyDate}
              onChange={(e) => setReadyDate(e.target.value)}
              style={S.input}
              data-testid="sell-ready-date"
            />
          </label>

          <label style={S.label} htmlFor="sell-price">
            {tSafe('market.priceRange', 'Price range (optional)')}
            <input
              type="text"
              id="sell-price"
              name="priceRange"
              value={priceRange}
              onChange={(e) => {
                setPriceRange(e.target.value);
                // Once the user edits the price field, the
                // auto-suggestion never overwrites again.
                setPriceTouched(true);
              }}
              placeholder="e.g. 250–300 GHS / kg"
              style={S.input}
              data-testid="sell-price"
            />
            {v2On && !priceTouched && pricePrefill ? (
              <span
                style={{
                  fontSize: 12,
                  color: '#86EFAC',
                  fontWeight: 600,
                  marginTop: 4,
                }}
                data-testid="sell-price-suggested"
              >
                {tSafe('sell.price.suggested', 'Suggested from market data')}
              </span>
            ) : null}
          </label>

          {/* Optional photo — boosts verification level
              from 2 → 3 when paired with location. The
              listing still succeeds without one. */}
          <label style={S.label} htmlFor="sell-photo">
            {tSafe('market.photoOptional', 'Photo of produce (optional)')}
            <input
              type="file"
              id="sell-photo"
              name="photo"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              style={S.input}
              data-testid="sell-photo"
            />
            {photoFile && (
              <span style={{
                color: '#86EFAC', fontSize: '0.8125rem',
                fontWeight: 700,
              }}>
                ✓ {tSafe('market.photoAttached', 'Photo attached')}
              </span>
            )}
          </label>

          {/* V2: smart region chip — shows detected city/state with
              a "Detected" tag, falls back to a "Set your location"
              button when detection fails. Flag-off path keeps the
              static pill rendering whatever the farm/profile has. */}
          {v2On ? (
            <RegionDetectChip
              initialRegion={activeFarm?.region  || profile?.region  || ''}
              initialCountry={activeFarm?.country || profile?.country || ''}
              onSetLocation={() => navigate('/profile/setup')}
              onDetected={(reg, ctry) => {
                if (reg)  setDetectedRegion(reg);
                if (ctry) setDetectedCountry(ctry);
              }}
            />
          ) : (
            <div style={S.regionPill} data-testid="sell-region">
              <span style={S.regionLabel}>
                {tSafe('market.region', 'Region')}
              </span>
              <span style={S.regionVal}>
                {(activeFarm?.region || profile?.region || '—')
                  + (activeFarm?.country ? `, ${activeFarm.country}` : '')}
              </span>
            </div>
          )}

          {/* V2: trust line just above the submit button so the
              farmer reads it at the moment of commitment. */}
          {v2On ? <BuyerExplanation /> : null}

          <button
            type="submit"
            disabled={submitting}
            style={{ ...S.btnPrimary, opacity: submitting ? 0.7 : 1 }}
            data-testid="sell-submit"
          >
            {submitting
              ? tSafe('market.creating', 'Creating…')
              : tSafe('market.createListing', 'Create Listing')}
          </button>
        </form>

        <p style={S.privacy}>
          {tSafe('market.privacyNote',
            'We never share your phone or email. Buyer interest goes through Farroway first.')}
        </p>
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.navy} 0%, ${C.darkPanel} 100%)`,
    color: C.white,
    display: 'flex',
    // Switched from row to column so the status overlay can stack
    // ABOVE the existing form card without being pushed sideways.
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1.5rem 1rem 4rem',
  },
  // Status overlay container — sits above the form card, same
  // 32rem max-width so the visual rhythm matches.
  statusWrap: {
    width: '100%',
    maxWidth: '32rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },
  statusCard: {
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 12,
    padding: '14px 16px',
    color: C.white,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statusEyebrow: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#86EFAC',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  statusTitle: {
    margin: 0,
    fontSize: '1.0625rem',
    fontWeight: 700,
    color: C.white,
  },
  statusMeta: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.65)',
  },
  // Body row carries the title block on the left and the buyer
  // chip on the right. `flexWrap: 'wrap'` keeps the chip from
  // overflowing on narrow phones — it falls below the title
  // block instead.
  statusBody: {
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  statusInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: '1 1 auto',
  },
  // Inline pill chip — green ghost so it reads as a tappable
  // affordance without competing with the primary "Create
  // Listing" CTA below the form. `minHeight: 36` keeps the
  // tap target comfortable on mobile.
  statusChip: {
    appearance: 'none',
    border: '1px solid rgba(34,197,94,0.55)',
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    flex: '0 0 auto',
  },
  // Visual restyle: card surface aligned with the rest of the
  // farmer-facing pages (#102C47 panel, #1F3B5C border) and a
  // tighter title cadence per the visual reference. No layout
  // changes — the form stays in the same column with the same
  // spacing and the same fields.
  card: {
    width: '100%',
    maxWidth: '32rem',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: '14px',
    padding: '1.25rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  title: {
    margin: '0.4rem 0 0',
    fontSize: '1.25rem',
    fontWeight: 700,
    color: C.white,
    letterSpacing: '-0.005em',
  },
  lead:    { margin: 0, color: 'rgba(255,255,255,0.6)',
             fontSize: '0.875rem', lineHeight: 1.5 },
  successIcon: { fontSize: '2.25rem' },
  empty:   { margin: 0, color: 'rgba(255,255,255,0.78)',
             fontSize: '0.9375rem', lineHeight: 1.55 },
  form:    { display: 'flex', flexDirection: 'column', gap: '0.85rem',
             marginTop: '0.5rem' },
  row:     { display: 'flex', gap: '0.65rem' },
  label:   { display: 'flex', flexDirection: 'column', gap: '0.35rem',
             color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' },
  // Inputs use the snippet's `#1A3B5D` filled surface so the
  // focusable controls read as a single clear group inside the
  // card. Native `<select>` and `<input type="date">` inherit
  // the same styling.
  input:   {
    background: '#1A3B5D',
    border: '1px solid #1F3B5C',
    borderRadius: '8px',
    padding: '0.7rem 0.85rem',
    color: C.white,
    fontSize: '0.9375rem',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
  },
  formError: {
    margin: 0,
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.30)',
    color: '#FCA5A5',
    padding: '0.6rem 0.85rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
  },
  regionPill: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: '999px',
    color: C.lightGreen,
    fontSize: '0.8125rem',
    alignSelf: 'flex-start',
  },
  regionLabel: { textTransform: 'uppercase', letterSpacing: '0.06em',
                 fontWeight: 700, opacity: 0.85 },
  regionVal:   { color: C.white, fontWeight: 700 },
  btnRow:      { display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
                 marginTop: '0.5rem' },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '0.875rem 1.25rem', borderRadius: '10px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(34,197,94,0.22)',
    minHeight: '48px',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center',
    padding: '0.85rem 1.25rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: C.white,
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
    minHeight: '46px',
  },
  privacy: {
    margin: '0.75rem 0 0',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.8125rem',
    lineHeight: 1.5,
  },
};
