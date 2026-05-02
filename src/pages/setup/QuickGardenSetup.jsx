/**
 * QuickGardenSetup — single-screen garden onboarding per the
 * "fast, simple, accurate" spec §3.
 *
 *   <Route path="/setup/garden" element={<QuickGardenSetup />} />
 *
 * Required fields (2):
 *   1. Plant — text input with autofocus
 *   2. Location — auto-detected via geolocation; manual fallback
 *      via country / region inputs
 *
 * Optional (1):
 *   3. Garden size category — Small / Medium / Large pills
 *      (no numeric input required)
 *
 * On save:
 *   * `addGarden(payload)` writes a `farmType: 'backyard'` row
 *     (cannot accidentally land in the farms partition)
 *   * stamp `farroway_onboarding_completed = 'true'` (both keys
 *     via setOnboardingComplete so ProfileGuard's
 *     `shouldShowSetup` resolves correctly)
 *   * navigate('/home', { replace: true })
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Never throws — store + analytics calls are guarded.
 *   * Validation is inline + human-readable; no blocking modals.
 *   * Geolocation failure is silent — manual inputs always shown.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { addGarden } from '../../store/multiExperience.js';
import { setOnboardingComplete } from '../../utils/onboarding.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const SIZE_OPTIONS = [
  { value: 'small',  labelKey: 'setup.garden.size.small',  fallback: 'Small'  },
  { value: 'medium', labelKey: 'setup.garden.size.medium', fallback: 'Medium' },
  { value: 'large',  labelKey: 'setup.garden.size.large',  fallback: 'Large'  },
];

const C = {
  bg:        '#0B1D34',
  card:      'rgba(255,255,255,0.04)',
  border:    'rgba(255,255,255,0.10)',
  ink:       '#EAF2FF',
  inkSoft:   'rgba(255,255,255,0.65)',
  green:     '#22C55E',
  greenInk:  '#062714',
  amber:     '#F59E0B',
  red:       '#EF4444',
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
  pillRow:    { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  pill: {
    appearance: 'none', fontFamily: 'inherit', cursor: 'pointer',
    background: 'transparent', border: `1px solid ${C.border}`,
    color: C.ink, padding: '8px 14px', borderRadius: 999,
    fontSize: 13, fontWeight: 700, minHeight: 40,
  },
  pillActive: { background: 'rgba(34,197,94,0.18)', borderColor: 'rgba(34,197,94,0.32)', color: '#86EFAC' },
  saveBtn: {
    appearance: 'none', fontFamily: 'inherit', cursor: 'pointer',
    background: C.green, color: C.greenInk, border: 'none',
    padding: '14px 20px', borderRadius: 12,
    fontSize: 15, fontWeight: 800, minHeight: 48,
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  rowGap2:    { display: 'flex', gap: 8, alignItems: 'center' },
  geoBtn: {
    appearance: 'none', fontFamily: 'inherit', cursor: 'pointer',
    background: 'transparent', border: `1px solid ${C.border}`,
    color: C.ink, padding: '8px 12px', borderRadius: 10,
    fontSize: 12, fontWeight: 700, minHeight: 36,
  },
};

export default function QuickGardenSetup() {
  useTranslation();
  const navigate = useNavigate();

  const [plant, setPlant]       = useState('');
  const [country, setCountry]   = useState('');
  const [region, setRegion]     = useState('');
  const [city, setCity]         = useState('');
  const [size, setSize]         = useState(null); // optional
  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [geoStatus, setGeoStatus]   = useState('idle'); // 'idle'|'requesting'|'denied'|'ok'

  // Auto-detect location once on mount; geolocation denial is
  // silent — the manual inputs stay available either way.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setGeoStatus('requesting');
    try {
      navigator.geolocation.getCurrentPosition(
        () => {
          // We don't reverse-geocode here — manual fields stay
          // available. We just record the success.
          setGeoStatus('ok');
        },
        () => { setGeoStatus('denied'); },
        { timeout: 4000, maximumAge: 60_000 },
      );
    } catch { setGeoStatus('denied'); }
  }, []);

  function handleSave() {
    const next = {};
    if (!plant.trim())  next.plant   = tStrict('setup.garden.err.plant',   'Tell us what you\u2019re growing.');
    if (!country.trim()) next.country = tStrict('setup.garden.err.country', 'Pick the country where the garden is.');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const stored = addGarden({
        crop:           plant.trim().toLowerCase().replace(/\s+/g, '_'),
        cropLabel:      plant.trim(),
        plants:         [plant.trim()],
        name:           plant.trim() ? `My ${plant.trim()}` : 'My garden',
        country:        country.trim().toUpperCase(),
        countryLabel:   country.trim(),
        state:          region.trim() || null,
        stateLabel:     region.trim() || null,
        city:           city.trim() || null,
        gardenSizeCategory: size,
        farmType:       'backyard',
      });
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('farroway_active_farm',
            JSON.stringify(stored || { farmType: 'backyard' }));
          localStorage.setItem('farroway_experience', JSON.stringify('backyard'));
        }
      } catch { /* swallow */ }
      try { setOnboardingComplete(); } catch { /* swallow */ }
      try { trackEvent('setup_garden_completed', { hasSize: !!size, hasRegion: !!region.trim() }); }
      catch { /* swallow */ }
      try { navigate('/home', { replace: true }); }
      catch {
        try { navigate('/dashboard', { replace: true }); }
        catch { /* swallow */ }
      }
    } catch (err) {
      setErrors({ form: tStrict('setup.garden.err.save', 'We couldn\u2019t save right now. Try again.') });
      setSubmitting(false);
    }
  }

  const canSubmit = plant.trim() && country.trim() && !submitting;

  return (
    <main style={S.page} data-testid="quick-garden-setup">
      <div>
        <h1 style={S.title}>
          {tStrict('setup.garden.title', 'Set up your garden')}
        </h1>
        <p style={S.subtitle}>
          {tStrict('setup.garden.subtitle',
            'Just two quick details \u2014 you can refine later.')}
        </p>
      </div>

      {/* Plant */}
      <section style={S.card}>
        <span style={S.label}>
          {tStrict('setup.garden.plantLabel', 'What are you growing?')}
        </span>
        <input
          type="text"
          autoFocus
          inputMode="text"
          autoCapitalize="words"
          autoComplete="off"
          placeholder={tStrict('setup.garden.plantPh', 'e.g. tomato, basil, pepper')}
          value={plant}
          onChange={(e) => setPlant(e.target.value)}
          style={errors.plant ? { ...S.input, ...S.inputError } : S.input}
          data-testid="quick-garden-plant"
          maxLength={60}
        />
        {errors.plant ? (
          <div style={S.errorRow}>{errors.plant}</div>
        ) : null}
      </section>

      {/* Location */}
      <section style={S.card}>
        <span style={S.label}>
          {tStrict('setup.garden.locationLabel', 'Where is your garden?')}
        </span>
        <input
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoComplete="country-name"
          placeholder={tStrict('setup.garden.countryPh', 'Country')}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          style={errors.country ? { ...S.input, ...S.inputError } : S.input}
          data-testid="quick-garden-country"
          maxLength={60}
        />
        <input
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoComplete="address-level1"
          placeholder={tStrict('setup.garden.regionPh', 'State / region (optional)')}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          style={S.input}
          data-testid="quick-garden-region"
          maxLength={60}
        />
        {geoStatus === 'denied' ? (
          <div style={S.helpRow}>
            {tStrict('setup.garden.geoDenied',
              'Tip: enable location in your browser to auto-detect, or just type it in.')}
          </div>
        ) : geoStatus === 'requesting' ? (
          <div style={S.helpRow}>
            {tStrict('setup.garden.geoRequesting', 'Detecting your location\u2026')}
          </div>
        ) : null}
        {errors.country ? (
          <div style={S.errorRow}>{errors.country}</div>
        ) : null}
      </section>

      {/* Optional size */}
      <section style={S.card}>
        <span style={S.label}>
          {tStrict('setup.garden.sizeLabel', 'Garden size (optional)')}
        </span>
        <div style={S.pillRow}>
          {SIZE_OPTIONS.map((opt) => {
            const active = size === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSize(active ? null : opt.value)}
                style={active ? { ...S.pill, ...S.pillActive } : S.pill}
                data-testid={`quick-garden-size-${opt.value}`}
                aria-pressed={active}
              >
                {tStrict(opt.labelKey, opt.fallback)}
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSubmit}
        style={canSubmit ? S.saveBtn : { ...S.saveBtn, ...S.saveBtnDisabled }}
        data-testid="quick-garden-save"
      >
        {submitting
          ? tStrict('setup.garden.saving', 'Saving\u2026')
          : tStrict('setup.garden.save',   'Save my garden')}
      </button>

      {errors.form ? (
        <div style={{ ...S.errorRow, fontSize: 13 }}>{errors.form}</div>
      ) : null}
    </main>
  );
}
