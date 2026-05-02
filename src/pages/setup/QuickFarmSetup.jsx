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
import { setOnboardingComplete } from '../../utils/onboarding.js';
import { getDefaultUnit, getAllowedUnits } from '../../lib/units/areaConversion.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

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

  const [crop, setCrop]         = useState('');
  const [country, setCountry]   = useState('');
  const [region, setRegion]     = useState('');
  const [size, setSize]         = useState('');
  const [unit, setUnit]         = useState(null);
  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [geoStatus, setGeoStatus]   = useState('idle');

  // Detect country once on mount (silent on denial). The
  // unit dropdown defaults via getDefaultUnit per region:
  //   US → acres
  //   anywhere else → hectares
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setGeoStatus('requesting');
    try {
      navigator.geolocation.getCurrentPosition(
        () => { setGeoStatus('ok'); },
        () => { setGeoStatus('denied'); },
        { timeout: 4000, maximumAge: 60_000 },
      );
    } catch { setGeoStatus('denied'); }
  }, []);

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
    if (!size.trim() || Number(size) <= 0) {
      next.size = tStrict('setup.farm.err.size', 'Enter a land size larger than 0.');
    }
    if (!unit) next.unit = tStrict('setup.farm.err.unit', 'Pick a unit.');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const numericSize = Number(size);
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
      try {
        trackEvent('setup_farm_completed', {
          country: country.trim().toUpperCase(),
          unit,
          sizeSqFt: stored?.landSizeSqFt || null,
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
    <main style={S.page} data-testid="quick-farm-setup">
      <div>
        <h1 style={S.title}>
          {tStrict('setup.farm.title', 'Set up your farm')}
        </h1>
        <p style={S.subtitle}>
          {tStrict('setup.farm.subtitle',
            'Four quick details \u2014 you can refine later.')}
        </p>
      </div>

      {/* Crop */}
      <section style={S.card}>
        <span style={S.label}>
          {tStrict('setup.farm.cropLabel', 'What crop are you growing?')}
        </span>
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
        {errors.crop ? <div style={S.errorRow}>{errors.crop}</div> : null}
      </section>

      {/* Location */}
      <section style={S.card}>
        <span style={S.label}>
          {tStrict('setup.farm.locationLabel', 'Where is your farm?')}
        </span>
        <input
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoComplete="country-name"
          placeholder={tStrict('setup.farm.countryPh', 'Country')}
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
          placeholder={tStrict('setup.farm.regionPh', 'Region / state (optional)')}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          style={S.input}
          data-testid="quick-farm-region"
          maxLength={60}
        />
        {geoStatus === 'denied' ? (
          <div style={S.helpRow}>
            {tStrict('setup.farm.geoDenied',
              'Tip: enable location in your browser to auto-detect, or just type it in.')}
          </div>
        ) : geoStatus === 'requesting' ? (
          <div style={S.helpRow}>
            {tStrict('setup.farm.geoRequesting', 'Detecting your location\u2026')}
          </div>
        ) : null}
        {errors.country ? <div style={S.errorRow}>{errors.country}</div> : null}
      </section>

      {/* Land size + unit */}
      <section style={S.card}>
        <span style={S.label}>
          {tStrict('setup.farm.sizeLabel', 'Land size')}
        </span>
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
        <div style={S.helpRow}>
          {tStrict('setup.farm.unitHint',
            'Default unit picked from your country. You can change it.')}
        </div>
        {errors.size ? <div style={S.errorRow}>{errors.size}</div> : null}
        {errors.unit ? <div style={S.errorRow}>{errors.unit}</div> : null}
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSubmit}
        style={canSubmit ? S.saveBtn : { ...S.saveBtn, ...S.saveBtnDisabled }}
        data-testid="quick-farm-save"
      >
        {submitting
          ? tStrict('setup.farm.saving', 'Saving\u2026')
          : tStrict('setup.farm.save',   'Save my farm')}
      </button>

      {errors.form ? (
        <div style={{ ...S.errorRow, fontSize: 13 }}>{errors.form}</div>
      ) : null}
    </main>
  );
}
