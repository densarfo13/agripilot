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
import { setOnboardingComplete, isOnboardingComplete } from '../../utils/onboarding.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
// Farm/garden separation spec \u00a76 \u2014 persist Quick setup
// snapshots so a back/forward navigation doesn't lose
// in-flight form data.
import { loadData, saveData, removeData } from '../../store/localStore.js';
// Shared progress bar \u2014 leaf module so importing it doesn't
// pull the whole FastFlow tree (locale banner, recommendation
// engine, etc.) along with it. Render-crash hardening.
import OnboardingProgressBar from '../../components/onboarding/OnboardingProgressBar.jsx';

// localStore key for the garden-setup draft. Cleared after a
// successful save so a future visit starts blank.
const GARDEN_DRAFT_KEY = 'setup_garden_draft';

// Spec \u00a76 \u2014 garden size buckets. Garden flow MUST NOT show
// acres; this is a kitchen-plot screen. "I don't know" lets the
// user proceed without making up an answer.
const SIZE_OPTIONS = [
  { value: 'small',   labelKey: 'onboarding.gardenSize.small',   fallback: 'Small' },
  { value: 'medium',  labelKey: 'onboarding.gardenSize.medium',  fallback: 'Medium' },
  { value: 'large',   labelKey: 'onboarding.gardenSize.large',   fallback: 'Large' },
  { value: 'unknown', labelKey: 'onboarding.gardenSize.unknown', fallback: 'I don\u2019t know' },
];

// Backyard growing-setup spec \u00a71\u2013\u00a72 \u2014 garden-only step
// captured AFTER the plant pick. The 4 buckets compress the
// many real-world possibilities into something every grower
// recognises; the caller persists the value verbatim onto the
// garden record where downstream surfaces (dailyIntelligence
// engine, hybrid scan engine) read it to personalise guidance.
const GROWING_SETUP_OPTIONS = [
  { value: 'container', icon: '\uD83E\uDEB4', labelKey: 'garden.growingSetup.container', fallback: 'Pot / Container'  },
  { value: 'bed',       icon: '\uD83C\uDF3F', labelKey: 'garden.growingSetup.bed',       fallback: 'Garden bed'       },
  { value: 'ground',    icon: '\uD83C\uDFE1', labelKey: 'garden.growingSetup.ground',    fallback: 'Backyard soil'    },
  { value: 'unknown',   icon: '\u2754',       labelKey: 'garden.growingSetup.unknown',   fallback: 'I\u2019m not sure' },
];

// Spec \u00a77 \u2014 garden plant tiles. 5 common picks + Other (free
// input fallback). The first 5 cover the launch crop set; the
// caller normalises the selected label into the existing
// addGarden({ crop }) shape so downstream surfaces (scan,
// treatment, daily plan) get the same crop key as a manually
// typed plant.
const PLANT_OPTIONS = [
  { value: 'tomato',   labelKey: 'onboarding.plant.tomato',   fallback: 'Tomato'   },
  { value: 'pepper',   labelKey: 'onboarding.plant.pepper',   fallback: 'Pepper'   },
  { value: 'herbs',    labelKey: 'onboarding.plant.herbs',    fallback: 'Herbs'    },
  { value: 'lettuce',  labelKey: 'onboarding.plant.lettuce',  fallback: 'Lettuce'  },
  { value: 'cucumber', labelKey: 'onboarding.plant.cucumber', fallback: 'Cucumber' },
  { value: 'other',    labelKey: 'onboarding.plant.other',    fallback: 'Other'    },
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

  // Farm/garden separation spec \u00a76 \u2014 hydrate local form state
  // from the persisted draft so a back-navigation back into this
  // form preserves what the user had typed. Lazy useState
  // initialiser so the draft is read ONCE on mount (an IIFE in
  // the function body would re-read localStorage on every
  // render). Defensive try/catch \u2014 a malformed draft from a
  // prior deploy must NOT crash the form. We also defend each
  // field against unexpected types so a string \u2192 object swap
  // upstream can never poison a useState init.
  const [_draft] = useState(() => {
    try {
      const raw = loadData(GARDEN_DRAFT_KEY, null);
      return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    } catch { return {}; }
  });
  const _str = (v) => (typeof v === 'string' ? v : '');
  const _strOrNull = (v) => (typeof v === 'string' && v ? v : null);

  const [plant, setPlant]       = useState(_str(_draft.plant));
  // Spec \u00a77 \u2014 selected plant tile ('tomato'\u2026'other'). When
  // set to 'other' we expand a free-text input below; otherwise
  // the tile label is the plant.
  const [plantPick, setPlantPick] = useState(_strOrNull(_draft.plantPick));
  const [country, setCountry]   = useState(_str(_draft.country));
  const [region, setRegion]     = useState(_str(_draft.region));
  const [city, setCity]         = useState(_str(_draft.city));
  const [size, setSize]         = useState(_strOrNull(_draft.size)); // optional
  // Backyard growing-setup spec \u00a71 \u2014 'container' | 'bed' |
  // 'ground' | 'unknown'. Always nullable (the user can save
  // without picking) so onboarding stays fast; downstream
  // surfaces fall through to generic garden guidance when null.
  const [growingSetup, setGrowingSetup] = useState(_strOrNull(_draft.growingSetup));
  // High-trust onboarding spec \u00a72 \u2014 ask experience level AFTER
  // the user has chosen the garden experience. Non-blocking
  // guidance only; saved to the garden record so downstream
  // surfaces can soften copy ("first time?" hints) but never
  // gate the flow.
  const [skillLevel, setSkillLevel] = useState(_strOrNull(_draft.skillLevel));
  // Farm/garden separation spec \u00a74 \u2014 free-text search above
  // the plant tiles so users with longer lists can filter
  // instead of scrolling. Filtering is case-insensitive against
  // the resolved tile label OR the canonical id; an empty query
  // shows every tile (the default).
  const [plantQuery, setPlantQuery] = useState('');
  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [geoStatus, setGeoStatus]   = useState('idle'); // 'idle'|'requesting'|'denied'|'ok'

  // Final-gap stability \u00a78 \u2014 returning users land on /home,
  // not in setup. A completed flag means the user already
  // owns at least one garden/farm; re-entry to /setup/garden
  // would otherwise let them create a duplicate row.
  useEffect(() => {
    try {
      if (isOnboardingComplete()) {
        navigate('/home', { replace: true });
      }
    } catch { /* swallow */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Farm/garden separation spec \u00a76 \u2014 snapshot the form state
  // on every change so a back-navigation back into this form
  // restores what the user had typed. The save handler clears
  // the draft (saveData on success path \u2192 removeData) so the
  // next setup attempt starts blank.
  useEffect(() => {
    try {
      saveData(GARDEN_DRAFT_KEY, {
        plant, plantPick, country, region, city,
        size, growingSetup, skillLevel,
      });
    } catch { /* swallow */ }
  }, [plant, plantPick, country, region, city, size, growingSetup, skillLevel]);

  // Spec \u00a78 \u2014 "Use my location" is now an explicit user action,
  // not a silent on-mount probe (which made some browsers prompt
  // for permission before the user knew why). The manual fields
  // are always usable; geolocation failure NEVER blocks setup.
  function requestLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('requesting');
    try {
      navigator.geolocation.getCurrentPosition(
        () => {
          // We don't reverse-geocode here \u2014 manual fields stay
          // available. We just record the success so the helper
          // copy can encourage the user that detection worked.
          setGeoStatus('ok');
        },
        () => { setGeoStatus('denied'); },
        { timeout: 4000, maximumAge: 60_000 },
      );
    } catch { setGeoStatus('denied'); }
  }
  // Initialise to 'idle' \u2014 we no longer auto-probe on mount.
  useEffect(() => { /* no-op, kept for future */ }, []);

  // Plant tile selection \u2014 either set the canonical label from
  // the tile (sync to `plant` text state) or open the "Other"
  // free-text input (clears `plant` so the user types their own).
  function handlePickPlant(value) {
    setPlantPick(value);
    if (value !== 'other') {
      const tile = PLANT_OPTIONS.find((p) => p.value === value);
      const label = tile ? tStrict(tile.labelKey, tile.fallback) : '';
      setPlant(label);
      setErrors((cur) => ({ ...cur, plant: undefined }));
    } else {
      // Wipe the plant string so the user types their own; keeps
      // the validator honest if they pick Other but never type.
      setPlant('');
    }
  }

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
        // Backyard growing-setup spec \u00a72\u2013\u00a73 + final-gap
        // stability \u00a76 \u2014 persisted verbatim so
        // dailyIntelligenceEngine + hybridScanEngine can
        // personalise tasks + scan results without an extra
        // lookup. Garden experience MUST always have a value,
        // so a skipped pick is coerced to 'unknown' (the safest
        // fallback) instead of null \u2014 downstream consumers can
        // then branch on the value without a null-check.
        growingSetup: growingSetup || 'unknown',
        // Non-blocking guidance hint per onboarding spec \u00a72 \u2014
        // stored on the garden record so future surfaces can
        // soften copy for first-time growers without changing
        // the flow.
        skillLevel,
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
      // Farm/garden separation \u00a76 \u2014 wipe the draft so the
      // next setup attempt (e.g. user resets onboarding later)
      // starts blank instead of restoring stale fields.
      try { removeData(GARDEN_DRAFT_KEY); } catch { /* swallow */ }
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
    <main style={S.page} data-testid="quick-garden-setup" data-screen="setup-garden">
      <div>
        {/* Spec \u00a75 \u2014 progress bar instead of "Step 1 of 6". The
            garden flow is 4 steps total (Step 0 lang \u2192 Step 1
            pick \u2192 Step 2\u20133 setup); we sit at \u224875% on this screen. */}
        <OnboardingProgressBar value={3} total={4} />
        <h1 style={S.title}>
          {tStrict('setup.garden.title', 'Set up your garden')}
        </h1>
        <p style={S.subtitle}>
          {tStrict('setup.garden.subtitle',
            'Just two quick details \u2014 you can refine later.')}
        </p>
      </div>

      {/* Plant tiles (spec \u00a77 + farm/garden separation \u00a74).
          Tomato/Pepper/Herbs/Lettuce/Cucumber + Other (free
          input fallback). A search input above the grid filters
          visible tiles for users with longer real-world plant
          lists; "Other" is always shown so the user can fall
          through to a free-text entry even when nothing matches. */}
      <section style={S.card} data-testid="setup-garden-plant-tiles">
        <span style={S.label}>
          {tStrict('onboarding.pickPlant.title', 'Pick your plant')}
        </span>
        <input
          type="search"
          inputMode="search"
          autoCapitalize="none"
          autoComplete="off"
          placeholder={tStrict('onboarding.searchPlant', 'Search plant\u2026')}
          value={plantQuery}
          onChange={(e) => setPlantQuery(e.target.value)}
          style={S.input}
          data-testid="quick-garden-plant-search"
          maxLength={40}
        />
        <div style={S.pillRow}>
          {PLANT_OPTIONS.filter((opt) => {
            // Empty query \u2192 show every tile. Otherwise match
            // case-insensitively against either the canonical
            // id or the resolved label. "Other" is always
            // visible so the user can still type a custom plant
            // when nothing matches the query.
            if (opt.value === 'other') return true;
            const q = plantQuery.trim().toLowerCase();
            if (!q) return true;
            const label = String(tStrict(opt.labelKey, opt.fallback) || '').toLowerCase();
            return opt.value.toLowerCase().includes(q) || label.includes(q);
          }).map((opt) => {
            const active = plantPick === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePickPlant(opt.value)}
                style={active ? { ...S.pill, ...S.pillActive } : S.pill}
                data-testid={`quick-garden-plant-${opt.value}`}
                aria-pressed={active}
              >
                {tStrict(opt.labelKey, opt.fallback)}
              </button>
            );
          })}
        </div>
        {/* Other \u2192 reveal the free-text fallback so the user can
            type any plant. Also shown when the user wants to
            override the tile label. */}
        {plantPick === 'other' ? (
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
        ) : null}
        {errors.plant ? (
          <div style={S.errorRow}>{errors.plant}</div>
        ) : null}
      </section>

      {/* Location (spec \u00a78). "Use my location" is the primary
          CTA; manual country + region inputs always available. */}
      <section style={S.card}>
        <span style={S.label}>
          {tStrict('onboarding.gardenLocation', 'Where is your garden?')}
        </span>
        <button
          type="button"
          onClick={requestLocation}
          disabled={geoStatus === 'requesting'}
          style={{
            appearance: 'none', fontFamily: 'inherit', cursor: 'pointer',
            background: 'rgba(34,197,94,0.18)',
            border: `1px solid rgba(34,197,94,0.32)`,
            color: '#86EFAC',
            padding: '10px 14px', borderRadius: 10,
            fontSize: 14, fontWeight: 700, minHeight: 40,
            opacity: geoStatus === 'requesting' ? 0.7 : 1,
            alignSelf: 'flex-start',
          }}
          data-testid="quick-garden-use-location"
        >
          {geoStatus === 'requesting'
            ? tStrict('setup.garden.geoRequesting', 'Detecting your location\u2026')
            : tStrict('onboarding.useMyLocation', 'Use my location')}
        </button>
        <span style={{ ...S.helpRow, marginTop: 4 }}>
          {tStrict('onboarding.locationManual', 'Or enter manually')}
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

      {/* Optional skill level (spec \u00a72) \u2014 garden wording. The
          choice is non-blocking guidance only \u2014 we never gate
          the Save button on it. */}
      <section style={S.card} data-testid="setup-garden-skill">
        <span style={S.label}>
          {tStrict('onboarding.newToGrowing', 'Are you new to growing?')}
        </span>
        <div style={S.pillRow}>
          {[
            { value: 'new',      labelKey: 'onboarding.yesNew',           fallback: 'Yes, I\u2019m new' },
            { value: 'existing', labelKey: 'onboarding.alreadyGrowPlants', fallback: 'I already grow plants' },
          ].map((opt) => {
            const active = skillLevel === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSkillLevel(active ? null : opt.value)}
                style={active ? { ...S.pill, ...S.pillActive } : S.pill}
                data-testid={`setup-garden-skill-${opt.value}`}
                aria-pressed={active}
              >
                {tStrict(opt.labelKey, opt.fallback)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Growing setup (Backyard growing-setup spec \u00a71). Garden-
          only step \u2014 captures whether the user grows in a pot,
          a garden bed, the backyard soil, or doesn't know. Drives
          task personalisation downstream (dailyIntelligenceEngine
          \u00a75) + scan action enrichment (hybridScanEngine \u00a76). */}
      <section style={S.card} data-testid="setup-garden-growing-setup">
        <span style={S.label}>
          {tStrict('garden.growingSetup.title', 'How are you growing this?')}
        </span>
        <div style={S.pillRow}>
          {GROWING_SETUP_OPTIONS.map((opt) => {
            const active = growingSetup === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGrowingSetup(active ? null : opt.value)}
                style={active ? { ...S.pill, ...S.pillActive } : S.pill}
                data-testid={`quick-garden-growing-${opt.value}`}
                aria-pressed={active}
              >
                <span aria-hidden="true" style={{ marginRight: 6 }}>{opt.icon}</span>
                {tStrict(opt.labelKey, opt.fallback)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Garden size (onboarding spec \u00a76) \u2014 4 fixed buckets,
          NEVER acres. "I don't know" is selectable so the user
          can proceed without making up an answer. */}
      <section style={S.card}>
        <span style={S.label}>
          {tStrict('onboarding.gardenSize.title', 'Garden size')}
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
          : tStrict('onboarding.saveGarden', 'Save Garden')}
      </button>

      {errors.form ? (
        <div style={{ ...S.errorRow, fontSize: 13 }}>{errors.form}</div>
      ) : null}
    </main>
  );
}
