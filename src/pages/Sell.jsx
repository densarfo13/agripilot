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
import { saveListing } from '../market/marketStore.js';
import { syncListing } from '../market/marketSync.js';
import {
  saveVerification, tryReadGeolocation, ACTION_TYPES,
} from '../verification/verificationStore.js';
import { tSafe } from '../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import BrandLogo from '../components/BrandLogo.jsx';

const C = FARROWAY_BRAND.colors;
const UNITS = ['kg', 'bags', 'crates'];

export default function Sell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, farms } = useProfile();

  // Pick the first active farm — every farmer starts with at
  // least one farm if they've completed onboarding. Caller
  // can swap this for a farm-picker in v2.
  const activeFarm = useMemo(() => {
    if (Array.isArray(farms) && farms.length) return farms[0];
    if (profile && profile.farmId) return profile;
    return null;
  }, [farms, profile]);

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
  const [errMsg, setErrMsg]         = useState('');

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
              }}
              style={S.btnGhost}
            >
              {tSafe('market.listAnother', 'List another crop')}
            </button>
          </div>
        </div>
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
    if (!Number.isFinite(qty) || qty <= 0) {
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
        quantity:   qty,
        unit,
        readyDate,
        priceRange: priceRange.trim() || null,
        location: {
          lat:     activeFarm?.lat ?? activeFarm?.location?.lat ?? null,
          lng:     activeFarm?.lng ?? activeFarm?.location?.lng ?? null,
          region:  activeFarm?.region  || profile?.region  || '',
          country: activeFarm?.country || profile?.country || '',
        },
        status: 'ACTIVE',
      });
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

        <form onSubmit={handleSubmit} style={S.form} noValidate>
          <label style={S.label}>
            {tSafe('market.crop', 'Crop')}
            <input
              type="text"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              placeholder="e.g. maize"
              style={S.input}
              data-testid="sell-crop"
              required
            />
          </label>

          <div style={S.row}>
            <label style={{ ...S.label, flex: 2 }}>
              {tSafe('market.quantity', 'Quantity')}
              <input
                type="number"
                min="0"
                step="0.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                style={S.input}
                data-testid="sell-qty"
                required
              />
            </label>
            <label style={{ ...S.label, flex: 1 }}>
              {tSafe('market.unit', 'Unit')}
              <select
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

          <label style={S.label}>
            {tSafe('market.readyDate', 'Ready date')}
            <input
              type="date"
              value={readyDate}
              onChange={(e) => setReadyDate(e.target.value)}
              style={S.input}
              data-testid="sell-ready-date"
            />
          </label>

          <label style={S.label}>
            {tSafe('market.priceRange', 'Price range (optional)')}
            <input
              type="text"
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              placeholder="e.g. 250–300 GHS / kg"
              style={S.input}
              data-testid="sell-price"
            />
          </label>

          {/* Optional photo — boosts verification level
              from 2 → 3 when paired with location. The
              listing still succeeds without one. */}
          <label style={S.label}>
            {tSafe('market.photoOptional', 'Photo of produce (optional)')}
            <input
              type="file"
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

          <div style={S.regionPill} data-testid="sell-region">
            <span style={S.regionLabel}>
              {tSafe('market.region', 'Region')}
            </span>
            <span style={S.regionVal}>
              {(activeFarm?.region || profile?.region || '—')
                + (activeFarm?.country ? `, ${activeFarm.country}` : '')}
            </span>
          </div>

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
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '1.5rem 1rem 4rem',
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
