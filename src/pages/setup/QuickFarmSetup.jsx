/**
 * QuickFarmSetup — single-screen farm onboarding per the
 * "fast, simple, accurate" spec §4.
 *
 *   <Route path="/setup/farm" element={<QuickFarmSetup />} />
 *
 * Required fields (4):
 *   1. Crop — text input
 *   2. Location — country + region (auto-detect via geolocation,
 *      manual fallback)
 *   3. Land size — numeric input
 *   4. Unit — defaults to acres for US, hectares for everywhere
 *      else; user can override (acres / sqft / hectares / sqm)
 *
 * On save:
 *   * `addFarm(payload)` rejects backyard cross-writes — falls
 *     back to `'small_farm'` farmType.
 *   * `farrowayLocal.saveFarm` writes both the legacy partition
 *     and the post-migration `farroway_farms` array (dual-write).
 *     `landSizeSqFt` is computed once from (size, unit) and
 *     stored as the canonical base; `displayUnit` captures the
 *     user's chosen unit so display surfaces convert ONCE on
 *     render.
 *   * stamp `farroway_onboarding_completed = 'true'`
 *   * navigate('/home', { replace: true })
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Never throws.
 *   * Validation is inline + human-readable.
 *   * Number input ships `inputMode="decimal"` so iOS shows the
 *     numeric keypad (guard:ios-quirks #1 — already at baseline).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { addFarm } from '../../store/multiExperience.js';
import { setOnboardingComplete, isOnboardingComplete } from '../../utils/onboarding.js';
import { getDefaultUnit, getAllowedUnits } from '../../lib/units/areaConversion.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
// Production-hardening spec \u00a72\u2013\u00a73 \u2014 versioned + sanitised
// draft I/O.
import {
  loadFarmDraft,
  saveFarmDraft,
  clearFarmDraft,
} from '../../core/onboardingDraft.js';
// Shared progress bar \u2014 leaf module so importing it doesn't
// pull the whole FastFlow tree along with it.
import OnboardingProgressBar from '../../components/onboarding/OnboardingProgressBar.jsx';
// Review panel \u2014 final-merged onboarding spec \u00a75. Mounts
// above the Save button so the user sees the polished
// "Review your first plan" framing before committing.
import OnboardingReviewPanel from '../../components/onboarding/OnboardingReviewPanel.jsx';
// First-plan engine \u2014 stage + weather-aware action list.
import { generateFirstPlan } from '../../core/firstPlanEngine.js';

// Spec \u00a76 \u2014 farm size buckets. Farm flow MUST NOT show
// "Small backyard"; this is a working-acre screen. The bucket
// values map to a canonical acre figure for downstream
// land-intelligence calculations; "I don't know" stores null.
const FARM_SIZE_BUCKETS = [
  { value: 'lt1',     acres: 0.5, labelKey: 'onboarding.farmSize.lt1',     fallback: 'Less than 1 acre' },
  { value: '1to5',    acres: 3,   labelKey: 'onboarding.farmSize.1to5',    fallback: '1 to 5 acres' },
  { value: 'gt5',     acres: 10,  labelKey: 'onboarding.farmSize.gt5',     fallback: '5+ acres' },
  { value: 'unknown', acres: null,labelKey: 'onboarding.farmSize.unknown', fallback: 'I don\u2019t know' },
];

// Spec \u00a77 \u2014 farm crop tiles. 5 launch crops + Other (free
// input). Coexists with the existing free input for users who
// type something not in the list.
const CROP_OPTIONS = [
  { value: 'maize',   labelKey: 'onboarding.crop.maize',   fallback: 'Maize'   },
  { value: 'rice',    labelKey: 'onboarding.crop.rice',    fallback: 'Rice'    },
  { value: 'pepper',  labelKey: 'onboarding.crop.pepper',  fallback: 'Pepper'  },
  { value: 'tomato',  labelKey: 'onboarding.crop.tomato',  fallback: 'Tomato'  },
  { value: 'cassava', labelKey: 'onboarding.crop.cassava', fallback: 'Cassava' },
  { value: 'other',   labelKey: 'onboarding.crop.other',   fallback: 'Other'   },
];

const C = {
  card:     'rgba(255,255,255,0.04)',
  border:   'rgba(255,255,255,0.10)',
  ink:      '#EAF2FF',
  inkSoft:  'rgba(255,255,255,0.65)',
  green:    '#22C55E',
  greenInk: '#062714',
  red:      '#EF4444',
};

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: C.ink,
    padding: '32px 16px 96px',
    boxSizing: 'border-box',
    maxWidth: 520,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title:    { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: 0, fontSize: 14, color: C.inkSoft, lineHeight: 1.5 },
  card: {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  label:    { fontSize: 13, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase' },
  input: {
    background: 'rgba(0,0,0,0.32)', border: `1px solid ${C.border}`,
    color: C.ink, padding: '12px 14px', borderRadius: 10,
    fontSize: 15, fontFamily: 'inherit', minHeight: 44,
  },
  inputError: { borderColor: C.red },
  errorRow:   { fontSize: 12, color: '#FCA5A5', marginTop: 2 },
  helpRow:    { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  twoCol:     { display: 'flex', gap: 8 },
  selectWrap: { display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 38%' },
  saveBtn: {
    appearance: 'none', fontFamily: 'inherit', cursor: 'pointer',
    background: C.green, color: C.greenInk, border: 'none',
    padding: '14px 20px', borderRadius: 12,
    fontSize: 15, fontWeight: 800, minHeight: 48,
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
};

const UNIT_LABEL = {
  acres:    'acres',
  hectares: 'hectares',
  sqft:     'sq ft',
  sqm:      'sq m',
};

export default function QuickFarmSetup() {
  useTranslation();
  const navigate = useNavigate();

  // Hydrate from the versioned + sanitised draft. Lazy useState
  // init so the read runs once on mount. Returns null on
  // version mismatch / malformed payload \u2014 the form starts
  // blank instead of crashing.
  const [_draft] = useState(() => loadFarmDraft() || {});
  const _str = (v) => (typeof v === 'string' ? v : '');
  const _strOrNull = (v) => (typeof v === 'string' && v ? v : null);

  const [crop, setCrop]         = useState(_str(_draft.crop));
  const [cropPick, setCropPick] = useState(_strOrNull(_draft.cropPick));
  const [country, setCountry]   = useState(_str(_draft.country));
  const [region, setRegion]     = useState(_str(_draft.region));
  // Spec \u00a76 \u2014 farm size has TWO inputs: a 4-pill bucket and an
  // optional custom row. We track the bucket separately so the
  // canonical farmSize/sizeUnit fall through cleanly: bucket
  // selected \u2192 bucket acres + 'acres'; custom typed \u2192 numeric
  // size + chosen unit.
  const [sizeBucket, setSizeBucket] = useState(_strOrNull(_draft.sizeBucket));
  const [size, setSize]         = useState(_str(_draft.size));
  const [unit, setUnit]         = useState(_strOrNull(_draft.unit));
  // High-trust onboarding spec \u00a72 \u2014 ask experience level AFTER
  // the user has chosen the farm experience. Non-blocking
  // guidance only.
  const [skillLevel, setSkillLevel] = useState(_strOrNull(_draft.skillLevel));
  // Farm/garden separation spec \u00a74 \u2014 search input above the
  // crop tiles so users with longer lists can filter.
  const [cropQuery, setCropQuery] = useState('');

  // Stability-patch \u00a74 \u2014 multi-step state machine. Sub-steps:
  //   0  Location          (spec item 3)
  //   1  Crop              (spec item 4)
  //   2  Farm size         (spec item 6, farm-only)
  //   3  Review + Save     (spec item 7)
  const [subStep, setSubStep] = useState(0);
  const TOTAL_SUB_STEPS = 4;
  function canAdvance(s) {
    // Location step: country OR geolocation succeeded.
    if (s === 0) return !!country.trim() || geoStatus === 'ok';
    if (s === 1) {
      if (cropPick === 'other' && !crop.trim()) return false;
      return !!crop.trim();
    }
    if (s === 2) return !!sizeBucket || !!size.trim();
    return true;
  }
  function handleBack() {
    if (subStep > 0) setSubStep(subStep - 1);
    else { try { navigate('/onboarding/start'); } catch { /* swallow */ } }
  }
  function handleContinue() {
    if (!canAdvance(subStep)) return;
    if (subStep < TOTAL_SUB_STEPS - 1) setSubStep(subStep + 1);
  }
  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [geoStatus, setGeoStatus]   = useState('idle');

  // Final-gap stability \u00a78 \u2014 returning users land on /home,
  // not in setup. A completed flag means the user already
  // owns at least one garden/farm.
  useEffect(() => {
    try {
      if (isOnboardingComplete()) {
        navigate('/home', { replace: true });
      }
    } catch { /* swallow */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshot via the sanitiser so anything malformed gets
  // caught BEFORE landing in localStorage.
  useEffect(() => {
    saveFarmDraft({
      crop, cropPick, country, region,
      sizeBucket, size, unit, skillLevel,
    });
  }, [crop, cropPick, country, region, sizeBucket, size, unit, skillLevel]);

  // Spec \u00a78 \u2014 "Use my location" is now an explicit user
  // action, not a silent on-mount probe. Failure NEVER blocks
  // setup; the manual fields stay usable.
  function requestLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('requesting');
    try {
      navigator.geolocation.getCurrentPosition(
        () => { setGeoStatus('ok'); },
        () => { setGeoStatus('denied'); },
        { timeout: 4000, maximumAge: 60_000 },
      );
    } catch { setGeoStatus('denied'); }
  }
  useEffect(() => { /* no-op, kept for future */ }, []);

  function handlePickCrop(value) {
    setCropPick(value);
    if (value !== 'other') {
      const tile = CROP_OPTIONS.find((c) => c.value === value);
      const label = tile ? tStrict(tile.labelKey, tile.fallback) : '';
      setCrop(label);
      setErrors((cur) => ({ ...cur, crop: undefined }));
    } else {
      setCrop('');
    }
  }

  // Bucket pick. When the user picks a bucket the canonical
  // size/unit get set so a Save without ever opening the custom
  // row still produces a usable land-size record.
  function handlePickBucket(bucket) {
    setSizeBucket(bucket.value);
    if (bucket.acres == null) {
      setSize('');
      // Keep unit at its current value so the custom row still
      // works if the user opens it.
    } else {
      setSize(String(bucket.acres));
      setUnit('acres');
    }
    setErrors((cur) => ({ ...cur, size: undefined, unit: undefined }));
  }

  // Default unit reactively when the country is typed.
  const defaultUnit = useMemo(() => {
    return getDefaultUnit({
      farmType:    'small_farm',
      countryCode: country.trim().toUpperCase(),
    });
  }, [country]);

  // Sync the unit state with the regional default — only when
  // the user hasn't explicitly picked one yet.
  useEffect(() => {
    if (!unit && defaultUnit) setUnit(defaultUnit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUnit]);

  // Allowed unit list for the active country.
  const allowedUnits = useMemo(() => {
    return getAllowedUnits({
      farmType:    'small_farm',
      countryCode: country.trim().toUpperCase(),
    });
  }, [country]);

  function handleSave() {
    const next = {};
    if (!crop.trim())    next.crop    = tStrict('setup.farm.err.crop',    'Tell us what crop you grow.');
    if (!country.trim()) next.country = tStrict('setup.farm.err.country', 'Pick the country where the farm is.');
    // Spec \u00a76 \u2014 size is OPTIONAL when the user picks the
    // "I don't know" bucket OR any non-unknown bucket (which
    // already populates a canonical acres value). The strict
    // numeric+unit check only fires when the user opened the
    // custom row and typed garbage.
    const hasBucket = !!sizeBucket;
    const hasCustom = !!size.trim();
    if (hasCustom && (!Number.isFinite(Number(size)) || Number(size) <= 0)) {
      next.size = tStrict('setup.farm.err.size', 'Enter a land size larger than 0.');
    }
    if (hasCustom && !unit) {
      next.unit = tStrict('setup.farm.err.unit', 'Pick a unit.');
    }
    if (!hasBucket && !hasCustom) {
      next.size = tStrict('setup.farm.err.size', 'Enter a land size larger than 0.');
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      // For "I don't know" bucket, persist null so the
      // land-intelligence engine can fall through to its small/
      // medium/large heuristics on country only.
      const numericSize = (sizeBucket === 'unknown' && !size.trim())
        ? null
        : Number(size);
      const stored = addFarm({
        crop:         crop.trim().toLowerCase().replace(/\s+/g, '_'),
        cropLabel:    crop.trim(),
        crops:        [crop.trim()],
        name:         crop.trim() ? `My ${crop.trim()} farm` : 'My farm',
        country:      country.trim().toUpperCase(),
        countryLabel: country.trim(),
        region:       region.trim() || null,
        state:        region.trim() || null,
        stateLabel:   region.trim() || null,
        farmSize:     numericSize,
        sizeUnit:     unit,
        // Non-blocking guidance hint per spec \u00a72.
        skillLevel,
        farmType:     'small_farm',
      });
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('farroway_active_farm',
            JSON.stringify(stored || { farmType: 'small_farm' }));
          localStorage.setItem('farroway_experience', JSON.stringify('farm'));
        }
      } catch { /* swallow */ }
      try { setOnboardingComplete(); } catch { /* swallow */ }
      // Wipe the versioned draft after a successful save.
      try { clearFarmDraft(); } catch { /* swallow */ }
      try {
        trackEvent('setup_farm_completed', {
          country: country.trim().toUpperCase(),
          unit,
          sizeSqFt: stored?.landSizeSqFt || null,
        });
      } catch { /* swallow */ }
      // Production-hardening spec \u00a71 \u2014 canonical onboarding
      // completion event for day-1 funnel attribution.
      try {
        trackEvent('onboarding_completed', {
          activeExperience: 'farm',
          draftVersion:     2,
        });
      } catch { /* swallow */ }
      try { navigate('/home', { replace: true }); }
      catch {
        try { navigate('/dashboard', { replace: true }); }
        catch { /* swallow */ }
      }
    } catch (err) {
      setErrors({ form: tStrict('setup.farm.err.save', 'We couldn\u2019t save right now. Try again.') });
      setSubmitting(false);
    }
  }

  const canSubmit = crop.trim() && country.trim()
                 && size.trim() && Number(size) > 0
                 && unit && !submitting;

  return (
    <main style={S.page} data-testid="quick-farm-setup" data-screen="setup-farm">
      {/* Progress bar only \u2014 the form-level "Set up your farm"
          title was removed (each sub-step ships its own title;
          a global header was redundant noise above the
          step-specific question). */}
      <OnboardingProgressBar value={3 + subStep} total={6} />

      {/* Crop tiles (spec \u00a77 + farm/garden separation \u00a74).
          Maize/Rice/Pepper/Tomato/Cassava + Other (free input
          fallback). A search input above the grid filters
          visible tiles; "Other" stays visible so users with a
          crop not on the launch list can still type it in. */}
      {/* SubStep 1 \u2014 Crop pick. */}
      {subStep === 1 && (
      <section style={S.card} data-testid="setup-farm-crop-tiles" id="review-crop">
        <span style={S.label}>
          {tStrict('onboarding.pickCrop.title', 'Pick your crop')}
        </span>
        <input
          type="search"
          inputMode="search"
          autoCapitalize="none"
          autoComplete="off"
          placeholder={tStrict('onboarding.searchCrop', 'Search crop\u2026')}
          value={cropQuery}
          onChange={(e) => setCropQuery(e.target.value)}
          style={S.input}
          data-testid="quick-farm-crop-search"
          maxLength={40}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {CROP_OPTIONS.filter((opt) => {
            if (opt.value === 'other') return true;
            const q = cropQuery.trim().toLowerCase();
            if (!q) return true;
            const label = String(tStrict(opt.labelKey, opt.fallback) || '').toLowerCase();
            return opt.value.toLowerCase().includes(q) || label.includes(q);
          }).map((opt) => {
            const active = cropPick === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePickCrop(opt.value)}
                style={{
                  appearance: 'none',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  background: active ? 'rgba(34,197,94,0.18)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(34,197,94,0.32)' : C.border}`,
                  color: active ? '#86EFAC' : C.ink,
                  padding: '8px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  minHeight: 40,
                }}
                data-testid={`quick-farm-crop-${opt.value}`}
                aria-pressed={active}
              >
                {tStrict(opt.labelKey, opt.fallback)}
              </button>
            );
          })}
        </div>
        {cropPick === 'other' ? (
          <input
            type="text"
            autoFocus
            inputMode="text"
            autoCapitalize="words"
            autoComplete="off"
            placeholder={tStrict('setup.farm.cropPh', 'e.g. maize, cassava, tomato')}
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            style={errors.crop ? { ...S.input, ...S.inputError } : S.input}
            data-testid="quick-farm-crop"
            maxLength={60}
          />
        ) : null}
        {errors.crop ? <div style={S.errorRow}>{errors.crop}</div> : null}
      </section>
      )}

      {/* SubStep 0 \u2014 Location (spec item 3). */}
      {subStep === 0 && (
      <section style={S.card} id="review-location">
        <h1 style={{ ...S.title, fontSize: 22, marginBottom: 4 }}>
          {tStrict('onboarding.farmLocation', 'Where is your farm?')}
        </h1>
        <p style={S.subtitle}>
          {tStrict('onboarding.locationSubtitle',
            'We use this to give weather-aware guidance for your area.')}
        </p>
        <button
          type="button"
          onClick={requestLocation}
          disabled={geoStatus === 'requesting'}
          style={{
            appearance: 'none', fontFamily: 'inherit', cursor: 'pointer',
            background: 'rgba(34,197,94,0.18)',
            border: `1px solid rgba(34,197,94,0.32)`,
            color: '#86EFAC',
            padding: '12px 16px', borderRadius: 10,
            fontSize: 14, fontWeight: 700, minHeight: 44,
            opacity: geoStatus === 'requesting' ? 0.7 : 1,
            alignSelf: 'stretch',
            textAlign: 'center',
          }}
          data-testid="quick-farm-use-location"
        >
          {geoStatus === 'requesting'
            ? tStrict('onboarding.detectingLocation', 'Detecting location\u2026')
            : tStrict('onboarding.useMyCurrentLocation', '\uD83D\uDCCD Use my current location')}
        </button>
        <span style={{ ...S.helpRow, marginTop: 4 }}>
          {tStrict('onboarding.locationManual', 'Or enter manually')}
        </span>
        <input
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoComplete="country-name"
          placeholder={tStrict('onboarding.selectCountry', 'Select country')}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          style={errors.country ? { ...S.input, ...S.inputError } : S.input}
          data-testid="quick-farm-country"
          maxLength={60}
        />
        <input
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoComplete="address-level1"
          placeholder={tStrict('onboarding.enterRegion', 'Enter region or state')}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          style={S.input}
          data-testid="quick-farm-region"
          maxLength={60}
        />
        {geoStatus === 'denied' ? (
          <div style={S.helpRow} data-testid="quick-farm-geo-failed">
            {tStrict('onboarding.locationFailed',
              'We couldn\u2019t access your location. Please enter it manually.')}
          </div>
        ) : null}
        {errors.country ? <div style={S.errorRow}>{errors.country}</div> : null}
      </section>
      )}

      {/* Stability-patch \u00a74 \u2014 the optional skill-level pill
          ("Are you new to farming?") is no longer rendered.
          Spec \u00a74 forbids "experience level" in the stacked
          form; the field stays in state for any downstream
          surface that wants to read it but is not collected
          during onboarding. */}

      {/* SubStep 2 \u2014 Farm size (spec item 6, farm-only).
          4 acre buckets + optional custom row. NEVER shows
          "Small backyard". */}
      {subStep === 2 && (
      <section style={S.card} data-testid="setup-farm-size-buckets" id="review-farm-size">
        <span style={S.label}>
          {tStrict('onboarding.farmSize.title', 'Farm size')}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {FARM_SIZE_BUCKETS.map((bucket) => {
            const active = sizeBucket === bucket.value;
            return (
              <button
                key={bucket.value}
                type="button"
                onClick={() => handlePickBucket(bucket)}
                style={{
                  appearance: 'none',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  background: active ? 'rgba(34,197,94,0.18)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(34,197,94,0.32)' : C.border}`,
                  color: active ? '#86EFAC' : C.ink,
                  padding: '8px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  minHeight: 40,
                }}
                data-testid={`quick-farm-size-${bucket.value}`}
                aria-pressed={active}
              >
                {tStrict(bucket.labelKey, bucket.fallback)}
              </button>
            );
          })}
        </div>
        {/* Custom row \u2014 exact size + unit. Optional; when the
            user picks a bucket the canonical size+unit are
            already populated, so this row is for refinement. */}
        <div style={{ ...S.helpRow, marginTop: 8 }}>
          {tStrict('onboarding.farmSize.customLabel', 'Or enter exact size (optional)')}
        </div>
        <div style={S.twoCol}>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder={tStrict('setup.farm.sizePh', 'e.g. 2')}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            style={{
              ...(errors.size ? { ...S.input, ...S.inputError } : S.input),
              flex: 1,
            }}
            data-testid="quick-farm-size"
            maxLength={10}
          />
          <div style={S.selectWrap}>
            <select
              className="form-select"
              value={unit || ''}
              onChange={(e) => setUnit(e.target.value || null)}
              style={{
                ...(errors.unit ? { ...S.input, ...S.inputError } : S.input),
                paddingRight: 8,
              }}
              data-testid="quick-farm-unit"
              aria-label="Land size unit"
            >
              {allowedUnits.map((u) => (
                <option key={u} value={u}>{UNIT_LABEL[u] || u}</option>
              ))}
            </select>
          </div>
        </div>
        {errors.size ? <div style={S.errorRow}>{errors.size}</div> : null}
        {errors.unit ? <div style={S.errorRow}>{errors.unit}</div> : null}
      </section>
      )}

      {/* SubStep 3 \u2014 Review + Save. Farm renders Crop +
          Location + Farm size with Change buttons that jump
          back via setSubStep (state-based, not scroll). */}
      {subStep === 3 && (
        <>
          <OnboardingReviewPanel
            experience="farm"
            summary={{
              crop:     crop.trim() || null,
              location: [region, country].filter((s) => s && s.trim()).join(', ') || null,
              farmSize: sizeBucket
                ? tStrict(`onboarding.farmSize.${sizeBucket}`, sizeBucket)
                : (size ? `${size} ${unit || ''}`.trim() : null),
            }}
            actions={generateFirstPlan({
              crop:      crop.trim() || null,
              isGarden:  false,
              location:  { country: country.trim(), region: region.trim() },
              plantedAt: null,
              weather: (() => {
                try {
                  if (typeof window === 'undefined') return null;
                  const raw = window.localStorage?.getItem('farroway_weather_cache');
                  return raw ? JSON.parse(raw) : null;
                } catch { return null; }
              })(),
            })}
            onChangeStep={(key) => {
              if (key === 'location')      setSubStep(0);
              else if (key === 'crop')     setSubStep(1);
              else if (key === 'farmSize') setSubStep(2);
            }}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit}
            style={canSubmit ? S.saveBtn : { ...S.saveBtn, ...S.saveBtnDisabled }}
            data-testid="quick-farm-save"
          >
            {submitting
              ? tStrict('setup.farm.saving', 'Saving\u2026')
              : tStrict('onboarding.saveFarm', 'Save Farm')}
          </button>

          {errors.form ? (
            <div style={{ ...S.errorRow, fontSize: 13 }}>{errors.form}</div>
          ) : null}
        </>
      )}

      {/* Continue / Back navigation. Save sub-step (3) has its
          own primary CTA (Save Farm) so we hide Continue
          there. Back is always shown. */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={handleBack}
          style={{
            appearance: 'none', fontFamily: 'inherit', cursor: 'pointer',
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.ink, padding: '12px 16px', borderRadius: 12,
            fontSize: 14, fontWeight: 700, minHeight: 44,
            flex: '0 0 auto',
          }}
          data-testid="quick-farm-back"
        >
          {tStrict('onboarding.back', 'Back')}
        </button>
        {subStep < TOTAL_SUB_STEPS - 1 ? (
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canAdvance(subStep)}
            style={canAdvance(subStep)
              ? { ...S.saveBtn, marginTop: 0, flex: 1 }
              : { ...S.saveBtn, ...S.saveBtnDisabled, marginTop: 0, flex: 1 }}
            data-testid="quick-farm-continue"
          >
            {tStrict('onboarding.continue', 'Continue')}
          </button>
        ) : null}
      </div>
    </main>
  );
}
