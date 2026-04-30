/**
 * MinimalOnboarding — fast, action-first onboarding entry point.
 *
 * Goal: a brand-new farmer reaches their first actionable task in
 * under 60 seconds. The flow is exactly 2 screens:
 *
 *   Screen 1 — entry      ("Are you new to farming?" + 2 buttons)
 *   Screen 2 — setup      (Location + Farm size + Crop, all on one card)
 *
 * Plus an optional inline confirmation strip when the user taps
 * "Recommend for me" (no extra page — replaces the crop dropdown
 * with a small "Recommended: <crop>" banner).
 *
 * On submit we save through the existing ProfileContext API and
 * route straight to /dashboard. Any field the farmer skipped is
 * stored as-is — the My Farm page renders a Setup card for the
 * incomplete fields so the farmer can refine later. No blocking
 * validations, no multi-step wizard, no extra pages.
 *
 * Routing
 *   ProfileGuard sends first-time farmers here (route
 *   /onboarding/minimal). Returning farmers with completed profiles
 *   short-circuit to /dashboard.
 *
 * Persistence
 *   - useProfile().saveProfile (saveProfileOfflineAware) — writes
 *     the profile via the existing local-first sync layer.
 *   - setOnboardingComplete() — flips the client flag the
 *     ProfileGuard reads so we never bounce the farmer back here.
 *
 * Reuses (no duplication):
 *   - productionDetectFn for GPS auto-detection
 *   - recommendCropsForScreen for "Recommend for me"
 *   - saveProfileOfflineAware for profile persistence
 */

import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useProfile } from '../../context/ProfileContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import {
  isFirstTimeFarmer,
} from '../../utils/fastOnboarding/index.js';
import { setOnboardingComplete } from '../../utils/onboarding.js';
import { productionDetectFn } from '../../lib/location/productionDetectFn.js';
import { recommendCropsForScreen } from '../../lib/recommendations/cropRecommendationEngine.js';
import {
  Sprout, MapPin, Ruler, Wheat, ArrowRight, RefreshCw,
} from '../../components/icons/lucide.jsx';

// ── Country list — built once from i18n-iso-countries (the same
//    package the legacy ProfileSetup uses), so the dropdown stays
//    in sync with the rest of the app without duplicating data.
import isoCountries from 'i18n-iso-countries';
import isoEn from 'i18n-iso-countries/langs/en.json';
isoCountries.registerLocale(isoEn);
function buildCountryList() {
  try {
    const map = isoCountries.getNames('en', { select: 'official' });
    return Object.entries(map)
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

// ── Farm-size presets per spec (Small / Medium / Large).
//    Acres are persisted so existing analytics + reco rules keep
//    working unchanged — the labels are just farmer-friendly
//    facades over the canonical numeric value.
const FARM_SIZES = Object.freeze([
  { id: 'small',  acres: 0.25, label: 'Small (backyard)' },
  { id: 'medium', acres: 1,    label: 'Medium' },
  { id: 'large',  acres: 5,    label: 'Large' },
]);

// ── Default crop dropdown list when no country is detected yet.
//    Once the country lands the recommender takes over (top 5
//    crops for the country/state). Codes match the canonical
//    crop-id format used by the recommendation engine.
const DEFAULT_CROPS = Object.freeze([
  'MAIZE', 'CASSAVA', 'RICE', 'SORGHUM', 'TOMATO', 'BEAN',
]);

function _farmerNameFromAuth(authUser) {
  if (!authUser) return 'Farmer';
  return authUser.displayName
      || authUser.name
      || (authUser.email && String(authUser.email).split('@')[0])
      || 'Farmer';
}

export default function MinimalOnboarding() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile, farms, saveProfile } = useProfile();
  const { user: authUser } = useAuth();

  // Step 0 guard — already-onboarded farmers never see this page.
  // Same check ProfileGuard runs; we re-run here so a deep link
  // to /onboarding/minimal also short-circuits cleanly.
  const firstTime = useMemo(
    () => isFirstTimeFarmer({ profile, farms }),
    [profile, farms],
  );
  if (!firstTime) return <Navigate to="/dashboard" replace />;

  // ── Local state ────────────────────────────────────────────
  // 'entry' renders the two-button entry; 'setup' renders the
  // single-screen form. We never push a route between them — a
  // single setState keeps the back-button working sanely.
  const [phase, setPhase]           = useState('entry');     // 'entry' | 'setup'
  const [isNew, setIsNew]           = useState(true);
  const [country, setCountry]       = useState('');
  const [city, setCity]             = useState('');
  const [stateCode, setStateCode]   = useState(null);
  const [coords, setCoords]         = useState({ lat: null, lng: null });
  const [farmSize, setFarmSize]     = useState('medium');
  const [crop, setCrop]             = useState('');
  const [recommendedCrop, setRec]   = useState(null); // {code, label, reason}
  const [detecting, setDetecting]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const countries = useMemo(buildCountryList, []);

  // Crop dropdown options — top recommendations once we have a
  // country, otherwise a sane default list. The user can always
  // pick "Recommend for me" to let the engine decide.
  const cropOptions = useMemo(() => {
    if (!country) return DEFAULT_CROPS;
    try {
      const items = recommendCropsForScreen({
        country, state: stateCode, farmerType: isNew ? 'new' : 'existing',
        limit: 6,
      });
      const codes = (items || [])
        .map((it) => String(it.crop || it.code || '').toUpperCase())
        .filter(Boolean);
      return codes.length ? codes : DEFAULT_CROPS;
    } catch { return DEFAULT_CROPS; }
  }, [country, stateCode, isNew]);

  // ── Handlers ───────────────────────────────────────────────

  function handleEntryNew() {
    setIsNew(true);
    setPhase('setup');
  }
  function handleEntryExisting() {
    setIsNew(false);
    setPhase('setup');
  }

  async function handleDetectLocation() {
    if (detecting) return;
    setError('');
    setDetecting(true);
    try {
      const r = await productionDetectFn();
      if (r) {
        if (r.country)   setCountry(r.country);
        if (r.stateCode) setStateCode(r.stateCode);
        if (r.city)      setCity(r.city);
        if (Number.isFinite(r.latitude) && Number.isFinite(r.longitude)) {
          setCoords({ lat: r.latitude, lng: r.longitude });
        }
      }
    } catch (e) {
      // Spec rule: no blocking validations. We surface a calm
      // hint and let the farmer pick a country from the dropdown.
      setError(tSafe('onboarding.location.fallback',
        'Tap your country below if location is off.'));
    } finally {
      setDetecting(false);
    }
  }

  function handleRecommendCrop() {
    setError('');
    try {
      const items = recommendCropsForScreen({
        country: country || 'GLOBAL',
        state: stateCode,
        farmerType: isNew ? 'new' : 'existing',
        limit: 1,
      });
      const top = items && items[0];
      if (top) {
        const code = String(top.crop || top.code || '').toUpperCase();
        setCrop(code);
        setRec({
          code,
          label: top.label || code,
          reason: top.reason
               || tSafe('onboarding.reco.basedOn',
                    'Based on your location and season'),
        });
        return;
      }
      setRec(null);
    } catch { setRec(null); }
  }

  async function handleSubmit() {
    if (saving) return;
    setError('');

    // Spec: max 3 inputs, no blocking validations. We do soft
    // defaulting so an incomplete submit still lands the farmer
    // on Home with something to act on.
    const sizePreset = FARM_SIZES.find((s) => s.id === farmSize)
                    || FARM_SIZES[1];
    const cropCode = String(crop || (recommendedCrop && recommendedCrop.code) || '').toUpperCase();

    setSaving(true);
    try {
      const payload = {
        farmerName:   _farmerNameFromAuth(authUser),
        farmName:     'My Farm',
        country:      country || '',
        location:     city || stateCode || country || '',
        size:         sizePreset.acres,
        sizeUnit:     'ACRE',
        // ── Canonical crop field. The codebase has a strict
        //    crop-drift baseline (must use `crop`, not `cropType`)
        //    so we save under both keys ONLY if we have a value
        //    — recommendations engine + downstream readers all
        //    accept the canonical `crop` field.
        crop:         cropCode || undefined,
        cropType:     cropCode || undefined,
        gpsLat:       coords.lat || undefined,
        gpsLng:       coords.lng || undefined,
        isNewFarmer:  isNew,
        farmSizeBand: sizePreset.id,
        onboardingPath: 'minimal',
      };
      await saveProfile(payload);
    } catch (e) {
      // Save failures don't block — the local-first layer kept
      // a draft and progressive setup will retry.
      // eslint-disable-next-line no-console
      console.warn('[onboarding.minimal] save failed:', e?.message || e);
    } finally {
      // Always flip the flag + send the farmer to Home. ProfileGuard
      // reads the flag so they never get bounced back here.
      try { setOnboardingComplete(); } catch { /* never block */ }
      setSaving(false);
      navigate('/dashboard', { replace: true });
    }
  }

  // ── Render ─────────────────────────────────────────────────

  if (phase === 'entry') {
    return (
      <main style={S.page} data-testid="onboarding-minimal-entry">
        <div style={S.entryWrap}>
          <span style={S.entryIcon} aria-hidden="true">
            <Sprout size={28} />
          </span>
          <h1 style={S.entryTitle}>
            {tSafe('onboarding.entry.title', 'Are you new to farming?')}
          </h1>
          <p style={S.entrySub}>
            {tSafe('onboarding.entry.sub',
              'We\u2019ll set you up with the right next step.')}
          </p>
          <button
            type="button"
            onClick={handleEntryNew}
            style={S.entryPrimary}
            data-testid="onboarding-entry-new"
          >
            <span style={S.entryEmoji} aria-hidden="true">{'\uD83C\uDF31'}</span>
            <span>{tSafe('onboarding.entry.new', 'Yes, I\u2019m new')}</span>
          </button>
          <button
            type="button"
            onClick={handleEntryExisting}
            style={S.entrySecondary}
            data-testid="onboarding-entry-existing"
          >
            <span style={S.entryEmoji} aria-hidden="true">{'\uD83D\uDC69\u200D\uD83C\uDF3E'}</span>
            <span>{tSafe('onboarding.entry.existing', 'I already farm')}</span>
          </button>
        </div>
      </main>
    );
  }

  // ── Setup phase (single-screen form) ──────────────────────
  return (
    <main style={S.page} data-testid="onboarding-minimal-setup">
      <div style={S.setupWrap}>
        <header style={S.setupHeader}>
          <span aria-hidden="true" style={S.setupHeaderIcon}>
            <Sprout size={20} />
          </span>
          <h1 style={S.setupTitle}>
            {tSafe('onboarding.setup.title', 'Quick farm setup')}
          </h1>
          <p style={S.setupSub}>
            {tSafe('onboarding.setup.sub',
              'Three quick details to start. You can change them later.')}
          </p>
        </header>

        {/* ── Field 1: Location ─────────────────────────── */}
        <section style={S.field}>
          <label style={S.fieldLabel}>
            <span style={S.fieldIcon} aria-hidden="true"><MapPin size={14} /></span>
            {tSafe('onboarding.location', 'Location')}
          </label>
          <div style={S.locationRow}>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={S.select}
              data-testid="onboarding-country"
              aria-label={tSafe('onboarding.country', 'Country')}
            >
              <option value="">
                {tSafe('onboarding.country.placeholder', 'Select country')}
              </option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleDetectLocation}
              style={S.detectBtn}
              disabled={detecting}
              data-testid="onboarding-detect"
              aria-label={tSafe('onboarding.detect', 'Use my location')}
            >
              <span aria-hidden="true" style={S.detectIcon}>
                <RefreshCw size={14} />
              </span>
              <span>
                {detecting
                  ? tSafe('onboarding.detecting', 'Detecting\u2026')
                  : tSafe('onboarding.useGps', 'Use my location')}
              </span>
            </button>
          </div>
          {city ? (
            <div style={S.fieldHint} data-testid="onboarding-city-hint">
              {tSafe('onboarding.cityDetected',
                'Detected: {city}').replace('{city}', city)}
            </div>
          ) : null}
        </section>

        {/* ── Field 2: Farm size ────────────────────────── */}
        <section style={S.field}>
          <label style={S.fieldLabel}>
            <span style={S.fieldIcon} aria-hidden="true"><Ruler size={14} /></span>
            {tSafe('onboarding.farmSize', 'Farm size')}
          </label>
          <div style={S.sizeRow}>
            {FARM_SIZES.map((sz) => (
              <button
                key={sz.id}
                type="button"
                onClick={() => setFarmSize(sz.id)}
                style={{
                  ...S.sizeBtn,
                  ...(farmSize === sz.id ? S.sizeBtnActive : null),
                }}
                data-testid={`onboarding-size-${sz.id}`}
                aria-pressed={farmSize === sz.id ? 'true' : 'false'}
              >
                {tSafe(`onboarding.size.${sz.id}`, sz.label)}
              </button>
            ))}
          </div>
        </section>

        {/* ── Field 3: Crop (dropdown OR Recommend) ─────── */}
        <section style={S.field}>
          <label style={S.fieldLabel}>
            <span style={S.fieldIcon} aria-hidden="true"><Wheat size={14} /></span>
            {tSafe('onboarding.crop', 'Crop')}
          </label>
          {recommendedCrop ? (
            <div style={S.recoCard} data-testid="onboarding-reco">
              <div style={S.recoTop}>
                <span style={S.recoLabel}>
                  {tSafe('onboarding.reco.title', 'Recommended crop')}
                </span>
                <button
                  type="button"
                  onClick={() => { setRec(null); setCrop(''); }}
                  style={S.recoChange}
                  data-testid="onboarding-reco-change"
                >
                  {tSafe('onboarding.reco.change', 'Change')}
                </button>
              </div>
              <div style={S.recoCrop}>{recommendedCrop.label}</div>
              <div style={S.recoReason}>
                {recommendedCrop.reason}
              </div>
            </div>
          ) : (
            <div style={S.cropRow}>
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                style={S.select}
                data-testid="onboarding-crop"
                aria-label={tSafe('onboarding.crop', 'Crop')}
              >
                <option value="">
                  {tSafe('onboarding.crop.placeholder', 'Select crop')}
                </option>
                {cropOptions.map((code) => (
                  <option key={code} value={code}>
                    {code.charAt(0) + code.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleRecommendCrop}
                style={S.recoBtn}
                data-testid="onboarding-recommend"
              >
                {tSafe('onboarding.recommend', 'Recommend for me')}
              </button>
            </div>
          )}
        </section>

        {error ? (
          <div style={S.errorLine} data-testid="onboarding-error">{error}</div>
        ) : null}

        {/* ── Submit (single primary CTA) ─────────────── */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          style={S.submitBtn}
          data-testid="onboarding-submit"
        >
          <span>
            {saving
              ? tSafe('onboarding.saving', 'Setting up\u2026')
              : tSafe('onboarding.continue', 'Continue')}
          </span>
          <span aria-hidden="true" style={{ display: 'inline-flex', marginLeft: 8 }}>
            <ArrowRight size={16} />
          </span>
        </button>
      </div>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#FFFFFF',
    padding: '1.5rem 1rem 3rem',
    boxSizing: 'border-box',
  },

  // Entry screen ─────────────────────────────────
  entryWrap: {
    maxWidth: 420,
    margin: '0 auto',
    padding: '2rem 0.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  entryIcon: {
    color: '#22C55E',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.32)',
    borderRadius: 999,
    padding: 14,
    display: 'inline-flex',
    marginBottom: 4,
  },
  entryTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  entrySub: {
    margin: '0 0 1rem',
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  entryPrimary: {
    width: '100%',
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#FFFFFF',
    borderRadius: 14,
    padding: '0.95rem 1rem',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 56,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  entrySecondary: {
    width: '100%',
    appearance: 'none',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    color: '#FFFFFF',
    borderRadius: 14,
    padding: '0.95rem 1rem',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 56,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  entryEmoji: {
    fontSize: '1.25rem',
    lineHeight: 1,
  },

  // Setup screen ─────────────────────────────────
  setupWrap: {
    maxWidth: 480,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  setupHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 4,
  },
  setupHeaderIcon: { color: '#22C55E' },
  setupTitle: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#FFFFFF',
  },
  setupSub: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  fieldLabel: {
    fontSize: '0.75rem',
    fontWeight: 800,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  fieldIcon: { color: '#86EFAC', display: 'inline-flex' },
  fieldHint: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
  },

  // Location row ───────────────────────────────
  locationRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  select: {
    flex: '1 1 auto',
    minWidth: 0,
    appearance: 'none',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    color: '#FFFFFF',
    borderRadius: 12,
    padding: '0.7rem 0.85rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    minHeight: 48,
    colorScheme: 'dark',
  },
  detectBtn: {
    flex: '0 0 auto',
    appearance: 'none',
    background: 'transparent',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    borderRadius: 12,
    padding: '0.55rem 0.85rem',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  detectIcon: { display: 'inline-flex' },

  // Farm size row ──────────────────────────────
  sizeRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  sizeBtn: {
    appearance: 'none',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    color: 'rgba(255,255,255,0.78)',
    borderRadius: 12,
    padding: '0.7rem 0.5rem',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
    textAlign: 'center',
  },
  sizeBtnActive: {
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.55)',
    color: '#86EFAC',
  },

  // Crop row + recommendation card ─────────────
  cropRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  recoBtn: {
    flex: '0 0 auto',
    appearance: 'none',
    background: 'transparent',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    borderRadius: 12,
    padding: '0.55rem 0.85rem',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
  },
  recoCard: {
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.32)',
    borderRadius: 12,
    padding: '0.85rem 0.95rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  recoTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recoLabel: {
    fontSize: '0.6875rem',
    fontWeight: 800,
    color: '#86EFAC',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  recoChange: {
    appearance: 'none',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.65)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
  },
  recoCrop: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#FFFFFF',
  },
  recoReason: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.4,
  },

  // Submit + error ─────────────────────────────
  errorLine: {
    fontSize: '0.8125rem',
    color: '#FCA5A5',
    fontWeight: 600,
  },
  submitBtn: {
    width: '100%',
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#FFFFFF',
    borderRadius: 14,
    padding: '0.9rem 1rem',
    marginTop: 8,
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 52,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(34,197,94,0.22)',
  },
};
