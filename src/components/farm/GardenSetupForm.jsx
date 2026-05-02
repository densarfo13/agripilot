/**
 * GardenSetupForm — single-page garden profile form for the
 * adaptive `/farm/new` flow.
 *
 * Position
 * ────────
 * Coexists with `BackyardOnboarding.jsx` (the 6-step **first-time**
 * onboarding flow at `/onboarding/backyard`). This file is the
 * "add another garden" form — same data shape, simpler one-page
 * layout, no welcome / done steps. The two share the persistence
 * helper at the bottom so the saved object shape stays identical
 * between initial onboarding and add-more.
 *
 * Spec rules applied (Adaptive setup §2 / §3 / §6 / §9)
 *   • Title: "Set up your garden", not "Add New Farm".
 *   • Garden name optional with placeholder "My Home Garden".
 *   • "What are you growing?" plant cards (6 + Other).
 *   • Garden size = button category (Small / Medium / Large /
 *     Not sure) — NOT the numeric field commercial farms use.
 *   • Growing location (Backyard soil / Raised bed / Pots /
 *     Indoor / Greenhouse).
 *   • Hidden: commercial-farm option, unit, crop stage, sell
 *     fields, funding CTA. Internally: cropStage='land_prep',
 *     unit derived from country (sq ft for US, sq m elsewhere),
 *     farmType='backyard', experience='backyard'.
 *   • Required: plantName, country, growingLocation.
 *   • Save → set active garden + onboardingCompleted=true →
 *     navigate('/home', { replace: true }) (caller does the
 *     replace; this component just calls onSaved).
 *
 * All visible text via tStrict so non-English UIs render the
 * right localized copy.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const PLANT_OPTIONS = [
  { id: 'tomato',   icon: '\uD83C\uDF45', labelKey: 'backyard.plant.tomato',   fallback: 'Tomatoes' },
  { id: 'pepper',   icon: '\uD83C\uDF36', labelKey: 'backyard.plant.pepper',   fallback: 'Peppers' },
  { id: 'herbs',    icon: '\uD83C\uDF3F', labelKey: 'backyard.plant.herbs',    fallback: 'Herbs' },
  { id: 'lettuce',  icon: '\uD83E\uDD6C', labelKey: 'backyard.plant.lettuce',  fallback: 'Lettuce' },
  { id: 'cucumber', icon: '\uD83E\uDD52', labelKey: 'backyard.plant.cucumber', fallback: 'Cucumber' },
  { id: 'corn',     icon: '\uD83C\uDF3D', labelKey: 'backyard.plant.corn',     fallback: 'Corn' },
  { id: 'other',    icon: '\u2795',       labelKey: 'backyard.plant.other',    fallback: 'Other' },
];

const SIZE_OPTIONS = [
  { id: 'small',   labelKey: 'gardenSetup.size.small',   fallback: 'Small \u2014 pots or indoor plants' },
  { id: 'medium',  labelKey: 'gardenSetup.size.medium',  fallback: 'Medium \u2014 backyard or raised bed' },
  { id: 'large',   labelKey: 'gardenSetup.size.large',   fallback: 'Large \u2014 large home garden' },
  { id: 'unsure',  labelKey: 'gardenSetup.size.unsure',  fallback: 'I\u2019m not sure' },
];

const WHERE_OPTIONS = [
  { id: 'soil',       labelKey: 'backyard.where.soil',       fallback: 'Backyard soil' },
  { id: 'raised_bed', labelKey: 'backyard.where.raisedBed',  fallback: 'Raised bed' },
  { id: 'pots',       labelKey: 'backyard.where.pots',       fallback: 'Pots / containers' },
  { id: 'indoor',     labelKey: 'backyard.where.indoor',     fallback: 'Indoor' },
  { id: 'greenhouse', labelKey: 'backyard.where.greenhouse', fallback: 'Greenhouse' },
];

// Canonical growing-setup buckets (final-gap stability \u00a76).
// First-class field shown alongside the legacy growingLocation
// row so this surface can serve as the edit-garden form too.
// Pre-populated from `initialProfile.growingSetup` when the
// caller passes an existing garden's record in.
const GROWING_SETUP_OPTIONS = [
  { id: 'container',      icon: '\uD83E\uDEB4', labelKey: 'garden.growingSetup.container',     fallback: 'Pots / containers' },
  { id: 'raised_bed',     icon: '\uD83C\uDF3F', labelKey: 'garden.growingSetup.raisedBed',     fallback: 'Raised bed'        },
  { id: 'ground',         icon: '\uD83C\uDFE1', labelKey: 'garden.growingSetup.ground',        fallback: 'Backyard soil'     },
  { id: 'indoor_balcony', icon: '\uD83E\uDE9F', labelKey: 'garden.growingSetup.indoorBalcony', fallback: 'Indoor / balcony'  },
  { id: 'unknown',        icon: '\u2754',       labelKey: 'garden.growingSetup.unknown',       fallback: 'Not sure' },
];

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '24px 16px 96px',
    maxWidth: 640,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  title: { margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  helper: { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 8,
  },
  card: {
    padding: '14px 12px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  cardActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.14)',
  },
  cardIcon: { fontSize: 28 },
  optionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  optionBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    padding: '12px 14px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  optionBtnActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.14)',
  },
  errorBlock: {
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(239,68,68,0.14)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#FCA5A5',
    fontSize: 13,
  },
  locationFailBlock: {
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 1.5,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  locationFailRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  primary: {
    appearance: 'none',
    border: 'none',
    padding: '12px 18px',
    borderRadius: 12,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  secondary: {
    appearance: 'none',
    padding: '12px 18px',
    borderRadius: 12,
    background: 'transparent',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.18)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

/**
 * @param {object} props
 * @param {object} [props.initialProfile]   read from localStorage profile
 * @param {(saved: object) => void} props.onSaved  called with the new garden
 * @param {() => void} [props.onCancel]
 */
export default function GardenSetupForm({ initialProfile = {}, onSaved, onCancel }) {
  // Subscribe to language change so labels refresh on flip.
  useTranslation();

  // ── Form state ───────────────────────────────────────────
  const [gardenName, setGardenName] = useState('');
  const [plantId, setPlantId] = useState('');
  const [plantNameOther, setPlantNameOther] = useState('');
  const [country, setCountry] = useState(initialProfile?.country || 'United States');
  const [region, setRegion] = useState(initialProfile?.region || '');
  const [gardenSizeCategory, setGardenSizeCategory] = useState('');
  const [growingLocation, setGrowingLocation] = useState('');
  // Canonical 4-bucket growing-setup. Pre-populated from the
  // record when this form is reused as the edit-garden surface.
  // When the user explicitly picks here, it WINS over the
  // growingLocation \u2192 bucket mapping at save time, so editing
  // the field actually flows through.
  const [growingSetup, setGrowingSetup] = useState(
    String(initialProfile?.growingSetup || '').toLowerCase() || ''
  );

  // ── Geolocation state ───────────────────────────────────
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | requesting | denied | granted
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requestLocation = useCallback(() => {
    setError('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    setLocationStatus('requesting');
    try {
      navigator.geolocation.getCurrentPosition(
        () => { setLocationStatus('granted'); },
        () => { setLocationStatus('denied'); },
        { timeout: 6000, maximumAge: 60_000 },
      );
    } catch { setLocationStatus('denied'); }
  }, []);

  // Per-experience unit default (used internally; not shown).
  const unit = useMemo(() => (
    String(country || '').toLowerCase() === 'united states' ? 'sq ft' : 'sq m'
  ), [country]);

  const plantName = useMemo(() => {
    if (plantId === 'other') return plantNameOther.trim();
    const opt = PLANT_OPTIONS.find((p) => p.id === plantId);
    return opt ? opt.fallback : '';
  }, [plantId, plantNameOther]);

  // Required-field validity (spec §9): plantName, country, growingLocation.
  const isValid = useMemo(() => {
    if (!plantName) return false;
    if (!country)   return false;
    if (!growingLocation) return false;
    return true;
  }, [plantName, country, growingLocation]);

  const onSubmit = useCallback(async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setError('');
    if (!isValid) {
      setError(tStrict(
        'gardenSetup.error.required',
        'Please pick a plant, confirm your country, and where you\u2019re growing.'
      ));
      return;
    }
    setSubmitting(true);
    try {
      // Backyard growing-setup spec \u00a72 + final-gap stability
      // \u00a76 + final-merged follow-up \u2014 the canonical growingSetup
      // field is the source of truth. When the user explicitly
      // picked it via the new bucket row, that wins. Otherwise
      // we fall back to the historical growingLocation \u2192 bucket
      // mapping. The 5-bucket canonical set (container / bed /
      // ground / indoor / unknown) means 'indoor' is now its
      // own first-class value rather than collapsing onto
      // 'container'.
      // Merge-spec canonical 5-bucket taxonomy.
      const GROWING_LOCATION_TO_SETUP = {
        soil:       'ground',
        raised_bed: 'raised_bed',
        pots:       'container',
        indoor:     'indoor_balcony',
        greenhouse: 'raised_bed',
      };
      const ALLOWED_SETUPS = new Set(['container', 'raised_bed', 'ground', 'indoor_balcony', 'unknown']);
      const explicitSetup = ALLOWED_SETUPS.has(growingSetup) ? growingSetup : '';
      const finalGrowingSetup = explicitSetup
        || GROWING_LOCATION_TO_SETUP[growingLocation]
        || 'unknown';

      const garden = {
        id:                   'garden_' + Date.now().toString(36),
        experience:           'backyard',
        farmType:             'backyard',
        gardenName:           (gardenName || '').trim(),
        plantId:              plantId === 'other' ? 'other' : plantId,
        plantName,
        // Reuse the canonical `crop` field so existing engines
        // that read `farm.crop` see the picked plant.
        crop:                 plantId === 'other' ? plantName.toLowerCase() : plantId,
        country,
        region:               (region || '').trim(),
        gardenSizeCategory:   gardenSizeCategory || 'unsure',
        growingLocation,
        // Canonical bucket (container/bed/ground/unknown) used
        // by tasks + scan engines.
        growingSetup: finalGrowingSetup,
        cropStage:            'land_prep',
        unit,
        onboardingCompleted:  true,
        createdAt:            new Date().toISOString(),
      };
      try { trackEvent('garden_setup_saved', { source: 'farm_new' }); }
      catch { /* never propagate */ }
      if (typeof onSaved === 'function') {
        await onSaved(garden);
      }
    } catch {
      setError(tStrict(
        'backyard.error.save',
        'We could not save your garden. Please try again.'
      ));
    } finally {
      setSubmitting(false);
    }
  }, [
    isValid, gardenName, plantId, plantName, country, region,
    gardenSizeCategory, growingLocation, unit, onSaved,
  ]);

  return (
    <main style={STYLES.page} data-screen="garden-setup-form">
      <div>
        <h1 style={STYLES.title}>
          {tStrict('gardenSetup.title', 'Set up your garden')}
        </h1>
        <p style={STYLES.subtitle}>
          {tStrict(
            'gardenSetup.subtitle',
            'Create a garden profile and get simple daily guidance.'
          )}
        </p>
      </div>

      {error ? <div style={STYLES.errorBlock}>{error}</div> : null}

      {/* Garden name (optional) */}
      <div style={STYLES.section}>
        <span style={STYLES.sectionLabel}>
          {tStrict('gardenSetup.gardenName.label', 'Garden name')}
        </span>
        <input
          type="text"
          value={gardenName}
          onChange={(e) => setGardenName(e.target?.value || '')}
          placeholder={tStrict('gardenSetup.gardenName.placeholder', 'My Home Garden')}
          style={STYLES.input}
          autoComplete="off"
          data-testid="garden-name-input"
        />
        <p style={STYLES.helper}>
          {tStrict('gardenSetup.gardenName.helper', 'Optional. You can change this later.')}
        </p>
      </div>

      {/* Plant cards */}
      <div style={STYLES.section}>
        <span style={STYLES.sectionLabel}>
          {tStrict('gardenSetup.plant.label', 'What are you growing?')}
        </span>
        <div style={STYLES.cardsGrid}>
          {PLANT_OPTIONS.map((opt) => {
            const active = plantId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPlantId(opt.id)}
                style={{ ...STYLES.card, ...(active ? STYLES.cardActive : null) }}
                data-testid={`garden-plant-${opt.id}`}
              >
                <span style={STYLES.cardIcon} aria-hidden="true">{opt.icon}</span>
                <span>{tStrict(opt.labelKey, opt.fallback)}</span>
              </button>
            );
          })}
        </div>
        {plantId === 'other' ? (
          <input
            type="text"
            value={plantNameOther}
            onChange={(e) => setPlantNameOther(e.target?.value || '')}
            placeholder={tStrict('backyard.plant.otherPlaceholder', 'e.g. strawberries')}
            style={{ ...STYLES.input, marginTop: 8 }}
            autoFocus
            data-testid="garden-plant-other-input"
          />
        ) : null}
      </div>

      {/* Location */}
      <div style={STYLES.section}>
        <span style={STYLES.sectionLabel}>
          {tStrict('gardenSetup.location.label', 'Where is your garden?')}
        </span>
        {locationStatus === 'idle' ? (
          <button type="button" onClick={requestLocation} style={STYLES.optionBtn} data-testid="garden-detect-location">
            {tStrict('gardenSetup.location.detect', 'Use my location')}
          </button>
        ) : null}
        {locationStatus === 'requesting' ? (
          <p style={STYLES.helper}>
            {tStrict('gardenSetup.location.requesting', 'Detecting your location\u2026')}
          </p>
        ) : null}
        {locationStatus === 'denied' ? (
          <div style={STYLES.locationFailBlock} data-testid="garden-location-fail">
            <span>
              {tStrict(
                'gardenSetup.location.failed',
                'We couldn\u2019t detect your location. Please select your country below.'
              )}
            </span>
            <div style={STYLES.locationFailRow}>
              <button type="button" onClick={requestLocation} style={STYLES.optionBtn}>
                {tStrict('common.tryAgain', 'Try again')}
              </button>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target?.value || '')}
            placeholder={tStrict('gardenSetup.location.country', 'Country')}
            style={STYLES.input}
            autoComplete="country-name"
            data-testid="garden-country-input"
          />
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target?.value || '')}
            placeholder={tStrict('gardenSetup.location.region', 'Region or state (optional)')}
            style={STYLES.input}
            autoComplete="address-level1"
            data-testid="garden-region-input"
          />
        </div>
      </div>

      {/* Garden size category */}
      <div style={STYLES.section}>
        <span style={STYLES.sectionLabel}>
          {tStrict('gardenSetup.size.label', 'Garden size')}
        </span>
        <div style={STYLES.optionRow}>
          {SIZE_OPTIONS.map((opt) => {
            const active = gardenSizeCategory === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGardenSizeCategory(opt.id)}
                style={{ ...STYLES.optionBtn, ...(active ? STYLES.optionBtnActive : null) }}
                data-testid={`garden-size-${opt.id}`}
              >
                {tStrict(opt.labelKey, opt.fallback)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Growing setup (final-gap stability \u00a76) \u2014 canonical
          4-bucket field. First-class so this surface can serve
          as the edit-garden form: pre-populated from
          initialProfile.growingSetup, an explicit pick wins
          over the legacy growingLocation \u2192 bucket mapping at
          save time. */}
      <div style={STYLES.section} data-testid="garden-setup-growing-setup">
        <span style={STYLES.sectionLabel}>
          {tStrict('garden.growingSetup.title', 'How are you growing this?')}
        </span>
        <div style={STYLES.optionRow}>
          {GROWING_SETUP_OPTIONS.map((opt) => {
            const active = growingSetup === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGrowingSetup(active ? '' : opt.id)}
                style={{ ...STYLES.optionBtn, ...(active ? STYLES.optionBtnActive : null) }}
                data-testid={`garden-setup-growing-${opt.id}`}
                aria-pressed={active}
              >
                <span aria-hidden="true" style={{ marginRight: 6 }}>{opt.icon}</span>
                {tStrict(opt.labelKey, opt.fallback)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Growing location \u2014 richer detail (soil / raised bed /
          pots / indoor / greenhouse). Optional now: when the
          canonical bucket above is picked, the save uses that
          explicit value; this row stays as a finer-grained
          informational field. */}
      <div style={STYLES.section}>
        <span style={STYLES.sectionLabel}>
          {tStrict('backyard.step.where.title', 'Where are you growing?')}
        </span>
        <div style={STYLES.optionRow}>
          {WHERE_OPTIONS.map((opt) => {
            const active = growingLocation === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGrowingLocation(opt.id)}
                style={{ ...STYLES.optionBtn, ...(active ? STYLES.optionBtnActive : null) }}
                data-testid={`garden-where-${opt.id}`}
              >
                {tStrict(opt.labelKey, opt.fallback)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={STYLES.navRow}>
        <button type="button" onClick={onCancel} style={STYLES.secondary} data-testid="garden-back">
          {tStrict('common.back', 'Back')}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          style={{ ...STYLES.primary, ...(isValid && !submitting ? null : STYLES.primaryDisabled) }}
          disabled={!isValid || submitting}
          data-testid="garden-save"
        >
          {submitting
            ? tStrict('common.submitting', 'Submitting\u2026')
            : tStrict('gardenSetup.cta.save', 'Save garden')}
        </button>
      </div>
    </main>
  );
}
