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

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { addGarden } from '../../store/multiExperience.js';
import { setOnboardingComplete, isOnboardingComplete } from '../../utils/onboarding.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
// Production-hardening spec \u00a72\u2013\u00a73 \u2014 versioned + sanitised
// draft I/O. Replaces direct loadData/saveData calls so a
// malformed draft (manual DevTools tweak, schema swap, partial
// write) auto-clears instead of crashing useState during
// hydration.
import {
  loadGardenDraft,
  saveGardenDraft,
  clearGardenDraft,
} from '../../core/onboardingDraft.js';
// Shared progress bar \u2014 leaf module so importing it doesn't
// pull the whole FastFlow tree (locale banner, recommendation
// engine, etc.) along with it. Render-crash hardening.
import OnboardingProgressBar from '../../components/onboarding/OnboardingProgressBar.jsx';
// Final-merged onboarding fix \u00a75 follow-up: the review-screen
// polish ("Review your first plan" + tightened action tiles)
// now mounts above the Save button on this canonical setup
// form. Brings the legacy StepDailyPlanPreview wording into
// the user-facing path without requiring a separate route.
import OnboardingReviewPanel from '../../components/onboarding/OnboardingReviewPanel.jsx';
// First-plan engine \u2014 generates a stage + weather-aware action
// list inline on the review screen so the user's first plan
// is personalised to what they just told us.
import { generateFirstPlan } from '../../core/firstPlanEngine.js';

// Spec \u00a76 \u2014 garden size buckets. Garden flow MUST NOT show
// acres; this is a kitchen-plot screen. "I don't know" lets the
// user proceed without making up an answer.
const SIZE_OPTIONS = [
  { value: 'small',   labelKey: 'onboarding.gardenSize.small',   fallback: 'Small' },
  { value: 'medium',  labelKey: 'onboarding.gardenSize.medium',  fallback: 'Medium' },
  { value: 'large',   labelKey: 'onboarding.gardenSize.large',   fallback: 'Large' },
  { value: 'unknown', labelKey: 'onboarding.gardenSize.unknown', fallback: 'Not sure' },
];

// Backyard growing-setup spec \u00a71\u2013\u00a72 \u2014 garden-only step
// captured AFTER the plant pick. 5 buckets cover the realistic
// home-growing surfaces: pots, raised bed, backyard soil,
// indoor / balcony, or "I don't know" for users who don't want
// to commit. The value is persisted verbatim onto the garden
// record where downstream surfaces (dailyIntelligenceEngine,
// hybridScanEngine) read it to personalise guidance.
// Canonical 5-bucket value taxonomy (merge-spec values):
//   container | raised_bed | ground | indoor_balcony | unknown
// The values are persisted onto the garden record as
// `growingSetup` and read by the dailyIntelligenceEngine +
// hybridScanEngine to personalise tasks + scan actions. Legacy
// shorter values ('bed', 'indoor') from previous deploys are
// migrated by the engines via a one-line alias map so old
// saved gardens don't lose their personalisation.
const GROWING_SETUP_OPTIONS = [
  { value: 'container',      icon: '\uD83E\uDEB4', labelKey: 'garden.growingSetup.container',     fallback: 'Pots / containers' },
  { value: 'raised_bed',     icon: '\uD83C\uDF3F', labelKey: 'garden.growingSetup.raisedBed',     fallback: 'Raised bed'        },
  { value: 'ground',         icon: '\uD83C\uDFE1', labelKey: 'garden.growingSetup.ground',        fallback: 'Backyard soil'     },
  { value: 'indoor_balcony', icon: '\uD83E\uDE9F', labelKey: 'garden.growingSetup.indoorBalcony', fallback: 'Indoor / balcony'  },
  { value: 'unknown',        icon: '\u2754',       labelKey: 'garden.growingSetup.unknown',       fallback: 'Not sure' },
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

  // Hydrate from the versioned + sanitised draft. The helper
  // returns null when:
  //   \u2022 no draft is stored,
  //   \u2022 the stored version doesn't match
  //     CURRENT_ONBOARDING_DRAFT_VERSION (legacy / future drafts
  //     auto-clear), or
  //   \u2022 the payload fails sanitisation.
  // In every "no draft" case we just start the form blank \u2014
  // never crash. Lazy useState init so the read runs ONCE on
  // mount.
  const [_draft] = useState(() => loadGardenDraft() || {});
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

  // Stability-patch \u00a74 + onboarding-polish patch \u00a72 \u2014
  // multi-step state machine. One decision per screen. Sub-steps:
  //   0  Location          (spec item 3)
  //   1  Plant             (spec item 4)
  //   2  Growing setup     (spec item 5, garden-only)
  //   3  Garden size       (spec item 5, garden-only \u2014 split
  //                         OUT of the growing-setup screen so
  //                         the user makes one decision per
  //                         screen, per onboarding-polish \u00a72)
  //   4  Review + Save     (spec item 7)
  // Each sub-step renders its own card; Next at the bottom
  // advances; Back at the top decrements (sub-step 0 \u2192 routes
  // back out to FastFlow's experience picker).
  const [subStep, setSubStep] = useState(0);
  const TOTAL_SUB_STEPS = 5;

  // Per-sub-step required-field gate. Continue stays disabled
  // until the gate passes. Sub-steps 2 (growing setup) and 3
  // (garden size) are optional and Next is always enabled \u2014
  // the user can skip both screens by tapping Next without
  // selecting a tile.
  function canAdvance(s) {
    // Location step: country typed manually OR geolocation
    // succeeded \u2014 either path is enough to advance per spec
    // (location screen UX cleanup \u00a75).
    if (s === 0) return !!country.trim() || geoStatus === 'ok';
    if (s === 1) {
      // 'other' tile requires the free-text input to be filled.
      if (plantPick === 'other' && !plant.trim()) return false;
      return !!plant.trim();
    }
    return true;
  }

  function handleBack() {
    if (subStep > 0) {
      setSubStep(subStep - 1);
    } else {
      // Sub-step 0 back \u2192 out to the experience picker so the
      // user can switch from garden to farm without restarting.
      try { navigate('/onboarding/start'); } catch { /* swallow */ }
    }
  }
  function handleContinue() {
    if (!canAdvance(subStep)) return;
    if (subStep < TOTAL_SUB_STEPS - 1) setSubStep(subStep + 1);
  }
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

  // Snapshot the form state on every change so a back-navigation
  // restores what the user had typed. The sanitised save helper
  // narrows every field + stamps the canonical version, so
  // anything malformed gets caught here BEFORE landing in
  // localStorage. The save handler clears the draft after a
  // successful persist so the next setup attempt starts blank.
  useEffect(() => {
    saveGardenDraft({
      plant, plantPick, country, region, city,
      size, growingSetup, skillLevel,
    });
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
      // Wipe the versioned draft after a successful save so the
      // next setup attempt starts blank instead of restoring
      // stale fields.
      try { clearGardenDraft(); } catch { /* swallow */ }
      try { trackEvent('setup_garden_completed', { hasSize: !!size, hasRegion: !!region.trim() }); }
      catch { /* swallow */ }
      // Production-hardening spec \u00a71 \u2014 canonical onboarding
      // completion event so day-1 telemetry can attribute the
      // funnel finish without joining the experience-specific
      // setup_*_completed events.
      try {
        trackEvent('onboarding_completed', {
          activeExperience: 'garden',
          draftVersion:     2,
        });
      } catch { /* swallow */ }
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
      {/* Progress bar only \u2014 the form-level "Set up your garden"
          title was removed. Each sub-step now ships its own
          title + subtitle that focuses the user on the current
          decision; the global header was redundant noise above
          a step-specific question. */}
      {/* Progress bar total bumps from 6 to 7 because
          onboarding-polish patch \u00a72 split garden growing-setup
          and garden-size onto separate sub-steps (each "about
          your garden" decision now gets its own screen). */}
      <OnboardingProgressBar value={3 + subStep} total={7} />

      {/* SubStep 1 \u2014 Plant tiles. Pick the plant the user is
          growing. "Other" reveals a free-text fallback so any
          plant outside the launch list still works. */}
      {subStep === 1 && (
      <section style={S.card} data-testid="setup-garden-plant-tiles" id="review-plant">
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
      )}

      {/* SubStep 0 \u2014 Location. Title + subtitle focus the user
          on this single decision. "Use my current location"
          is the primary CTA; the manual inputs are always
          available. Location failure NEVER blocks setup. */}
      {subStep === 0 && (
      <section style={S.card} id="review-location">
        <h1 style={{ ...S.title, fontSize: 22, marginBottom: 4 }}>
          {tStrict('onboarding.gardenLocation', 'Where is your garden?')}
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
          data-testid="quick-garden-use-location"
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
          data-testid="quick-garden-country"
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
          data-testid="quick-garden-region"
          maxLength={60}
        />
        {geoStatus === 'denied' ? (
          <div style={S.helpRow} data-testid="quick-garden-geo-failed">
            {tStrict('onboarding.locationFailed',
              'We couldn\u2019t access your location. Please enter it manually.')}
          </div>
        ) : null}
        {errors.country ? (
          <div style={S.errorRow}>{errors.country}</div>
        ) : null}
      </section>
      )}

      {/* Stability-patch \u00a74 \u2014 the optional skill-level pill
          ("Are you new to growing?") is no longer rendered.
          Spec \u00a74 explicitly forbids "experience level" in the
          stacked form; the field stays in state for any
          downstream surface that wants to read it but is not
          collected during onboarding. */}

      {/* SubStep 2 \u2014 Growing setup (garden-only). Drives
          task personalisation downstream (dailyIntelligenceEngine
          + hybridScanEngine). Per onboarding-polish patch \u00a72,
          this is now a single-decision screen \u2014 garden size
          moved to sub-step 3. */}
      {subStep === 2 && (
      <section style={S.card} data-testid="setup-garden-growing-setup" id="review-growing-setup">
        <h1 style={{ ...S.title, fontSize: 22, marginBottom: 4 }}>
          {tStrict('garden.growingSetup.title', 'How are you growing your plants?')}
        </h1>
        <span style={S.label}>
          {tStrict('garden.growingSetup.label', 'Growing setup')}
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
      )}

      {/* SubStep 3 \u2014 Garden size. Onboarding-polish patch \u00a72
          splits this OUT of the growing-setup screen so each
          screen has a single decision. Spec \u00a75 size options;
          NEVER acres. */}
      {subStep === 3 && (
      <section style={S.card} data-testid="setup-garden-size" id="review-garden-size">
        <h1 style={{ ...S.title, fontSize: 22, marginBottom: 4 }}>
          {tStrict('onboarding.gardenSize.title', 'How big is your garden?')}
        </h1>
        <span style={S.label}>
          {tStrict('onboarding.gardenSize.label', 'Garden size')}
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
      )}

      {/* SubStep 4 \u2014 Review + Save. The user sees their picks
          (Plant / Location / Growing setup / Garden size) with
          Change buttons that jump back to the relevant sub-step
          (state-based, NOT scroll). Below the panel sits the
          Save Garden CTA which persists the record + routes to
          /home. The firstPlanEngine generates the action list
          from the user's actual entries (plant, location,
          isGarden) and the cached weather snapshot if available. */}
      {subStep === 4 && (
        <>
          <OnboardingReviewPanel
            experience="garden"
            summary={{
              plant:        plant.trim() || null,
              location:     [city, region, country].filter((s) => s && s.trim()).join(', ') || null,
              growingSetup: growingSetup
                ? tStrict(`garden.growingSetup.${growingSetup === 'raised_bed' ? 'raisedBed'
                                                : growingSetup === 'indoor_balcony' ? 'indoorBalcony'
                                                : growingSetup}`,
                    growingSetup)
                : null,
              // Onboarding-polish patch \u00a72 \u2014 garden size is now
              // a standalone sub-step; surface it on the review
              // panel so the user can confirm OR edit it before
              // saving. Falls through to the localized bucket
              // label (Small / Medium / Large / Not sure).
              gardenSize:   size
                ? tStrict(`onboarding.gardenSize.${size}`, size)
                : null,
            }}
            actions={generateFirstPlan({
              crop:     plant.trim() || null,
              isGarden: true,
              location: { country: country.trim(), region: region.trim(), city: city.trim() },
              // No plantedAt yet \u2014 the user just set up; the
              // engine returns the unknown-stage path which
              // skips the growth action.
              plantedAt: null,
              // Best-effort cached weather. ScanPage already
              // populates this slot when /scan runs; on first
              // boot the slot is empty and the engine falls
              // through to the no-weather branch.
              weather: (() => {
                try {
                  if (typeof window === 'undefined') return null;
                  const raw = window.localStorage?.getItem('farroway_weather_cache');
                  return raw ? JSON.parse(raw) : null;
                } catch { return null; }
              })(),
            })}
            onChangeStep={(key) => {
              // Stability-patch \u00a74 + onboarding-polish \u00a72 \u2014
              // state-based jump-back. Each Change button maps
              // to the sub-step that owns that field; profile
              // state is preserved because we only flip the
              // subStep pointer (no remount, no draft reload).
              // Garden size now lives on its own sub-step (3)
              // separate from growing setup (2).
              if (key === 'location')          setSubStep(0);
              else if (key === 'plant')        setSubStep(1);
              else if (key === 'growingSetup') setSubStep(2);
              else if (key === 'gardenSize')   setSubStep(3);
            }}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit}
            style={canSubmit ? S.saveBtn : { ...S.saveBtn, ...S.saveBtnDisabled }}
            data-testid="quick-garden-save"
          >
            {submitting
              ? tStrict('setup.garden.saving', 'Saving\u2026')
              : tStrict('onboarding.review.startUsing', 'Start using Farroway')}
          </button>

          {errors.form ? (
            <div style={{ ...S.errorRow, fontSize: 13 }}>{errors.form}</div>
          ) : null}
        </>
      )}

      {/* Continue / Back navigation. Save sub-step (4) has its
          own primary CTA (Save Garden) so we hide Continue
          there. Back is always shown so the user can step back
          through the flow without losing data. */}
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
          data-testid="quick-garden-back"
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
            data-testid="quick-garden-continue"
          >
            {tStrict('onboarding.next', 'Next')}
          </button>
        ) : null}
      </div>
    </main>
  );
}
