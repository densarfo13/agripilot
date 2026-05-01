/**
 * BackyardOnboarding — dedicated 6-step setup flow for U.S.
 * backyard / home-garden users at /onboarding/backyard.
 *
 * Position in the codebase
 * ────────────────────────
 * Coexists with the existing onboarding entry points
 * (`OnboardingV3`, `FarmerOnboardingPage`, `FastFlow`,
 * `MinimalOnboarding`, `QuickStart`). Those handle the
 * commercial-farm + small-farm cases. This page is the simple,
 * garden-shaped version triggered by:
 *
 *     country === 'United States'
 *     AND farmType ∈ {'backyard', 'home_garden'}
 *
 * The trigger detection itself can live in any of the existing
 * onboarding flows; this file is just the destination + the
 * persistence pass.
 *
 * Steps (per spec §2)
 * ───────────────────
 *   1. Welcome                    "Great — let's set up your garden 🌱"
 *   2. Location                   auto-detect / manual city + state
 *   3. What are you growing?      6 visual cards + Other
 *   4. Where are you growing?     5 location-type options
 *   5. Are you new to growing?    Yes / Some experience
 *   6. Done                       "Go to Home" CTA
 *
 * Persistence (per spec §3)
 * ─────────────────────────
 *   farroway_active_farm        whole garden object
 *   farroway_experience         'backyard'
 *   farroway_onboarding_completed  'true'
 *   farroway_user_profile       merged in (kept compatible with
 *                                the spec keys repairSession.js
 *                                already knows about)
 *
 * Strict-rule audit
 *   • Self-redirects to /dashboard when the feature flag is off.
 *   • Never blocks on geolocation — denial proceeds with manual.
 *   • All visible text via tStrict.
 *   • On completion: navigate('/dashboard', { replace: true })
 *     so the back button doesn't return the user to setup.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const STEPS = ['welcome', 'location', 'plant', 'where', 'experience', 'done'];

const PLANT_OPTIONS = [
  { id: 'tomato',   icon: '\uD83C\uDF45', labelKey: 'backyard.plant.tomato',   fallback: 'Tomatoes' },
  { id: 'pepper',   icon: '\uD83C\uDF36', labelKey: 'backyard.plant.pepper',   fallback: 'Peppers' },
  { id: 'herbs',    icon: '\uD83C\uDF3F', labelKey: 'backyard.plant.herbs',    fallback: 'Herbs' },
  { id: 'lettuce',  icon: '\uD83E\uDD6C', labelKey: 'backyard.plant.lettuce',  fallback: 'Lettuce' },
  { id: 'cucumber', icon: '\uD83E\uDD52', labelKey: 'backyard.plant.cucumber', fallback: 'Cucumber' },
  { id: 'corn',     icon: '\uD83C\uDF3D', labelKey: 'backyard.plant.corn',     fallback: 'Corn' },
  { id: 'other',    icon: '\u2795',       labelKey: 'backyard.plant.other',    fallback: 'Other' },
];

const WHERE_OPTIONS = [
  { id: 'soil',       labelKey: 'backyard.where.soil',       fallback: 'Backyard soil' },
  { id: 'raised_bed', labelKey: 'backyard.where.raisedBed',  fallback: 'Raised bed' },
  { id: 'pots',       labelKey: 'backyard.where.pots',       fallback: 'Pots / containers' },
  { id: 'indoor',     labelKey: 'backyard.where.indoor',     fallback: 'Indoor' },
  { id: 'greenhouse', labelKey: 'backyard.where.greenhouse', fallback: 'Greenhouse' },
];

const EXPERIENCE_OPTIONS = [
  { id: 'new',     labelKey: 'backyard.exp.new',     fallback: 'Yes, I\u2019m new' },
  { id: 'some',    labelKey: 'backyard.exp.some',    fallback: 'I have some experience' },
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
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressFill: { height: '100%', background: '#22C55E', transition: 'width 220ms ease' },
  h1: { margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em' },
  h2: { margin: '0 0 16px', fontSize: 20, fontWeight: 800 },
  subtitle: { margin: '6px 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 10,
    marginBottom: 16,
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
    marginBottom: 16,
  },
  optionBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    padding: '14px 16px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
  },
  optionBtnActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.14)',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
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
  helper: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  navRow: { display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 24 },
  primary: {
    padding: '12px 18px',
    borderRadius: 12,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 15,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
  },
  primaryDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  secondary: {
    padding: '12px 18px',
    borderRadius: 12,
    background: 'transparent',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.18)',
    cursor: 'pointer',
  },
  errorBlock: {
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(239,68,68,0.14)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#FCA5A5',
    fontSize: 13,
    marginBottom: 12,
  },
};

// Persist the spec keys + a couple of legacy ones so existing
// surfaces (sessionBootstrap, repairSession, ProfileGuard) see the
// same answer. Kept defensive — every storage write try/catches.
function _persistGarden(garden) {
  if (typeof localStorage === 'undefined') return;
  const writes = [
    ['farroway_experience',            JSON.stringify('backyard')],
    ['farroway_onboarding_completed',  'true'],
    ['farroway_active_farm',           JSON.stringify(garden)],
    // The user-profile slot is shared with the commercial-farm
    // flow. Merge rather than overwrite: read-then-write so we
    // don't drop unrelated profile fields if any are present.
    ['farroway_user_profile', (() => {
      try {
        const prev = localStorage.getItem('farroway_user_profile');
        const parsed = prev ? JSON.parse(prev) : {};
        const next = { ...(parsed && typeof parsed === 'object' ? parsed : {}), ...garden };
        return JSON.stringify(next);
      } catch { return JSON.stringify(garden); }
    })()],
    // Mirror the active farm into the existing single-farm
    // profile slot so legacy ProfileContext consumers see it.
    ['farroway_farms', JSON.stringify([garden])],
  ];
  for (const [k, v] of writes) {
    try { localStorage.setItem(k, v); } catch { /* quota / private mode */ }
  }
}

export default function BackyardOnboarding() {
  // Subscribe to language change.
  useTranslation();
  const navigate = useNavigate();

  const flagOn = isFeatureEnabled('usBackyardFlow');

  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState('');

  // Step 2 — location
  const [city, setCity] = useState('');
  const [state, setStateName] = useState('');
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | requesting | denied | granted

  // Step 3 — plant
  const [plantId, setPlantId] = useState('');
  const [plantNameOther, setPlantNameOther] = useState('');

  // Step 4 — growing location
  const [growingLocation, setGrowingLocation] = useState('');

  // Step 5 — experience level
  const [experienceLevel, setExperienceLevel] = useState('');

  // Try once on the location step. Geolocation denial is silent —
  // the manual fields are always available.
  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocationStatus('requesting');
    try {
      navigator.geolocation.getCurrentPosition(
        () => {
          // We don't reverse-geocode here; the manual fields stay
          // editable so the user confirms city/state. Setting
          // status to granted just relaxes the "we'll ask once"
          // affordance.
          setLocationStatus('granted');
        },
        () => { setLocationStatus('denied'); },
        { timeout: 6000, maximumAge: 60_000 },
      );
    } catch { setLocationStatus('denied'); }
  }, []);

  // Fire one entry analytics event when the page mounts.
  useEffect(() => {
    if (!flagOn) return;
    try { trackEvent('backyard_onboarding_started', {}); } catch { /* ignore */ }
  }, [flagOn]);

  // Flag-off: send the user back to the existing dashboard so they
  // never see a half-built screen.
  useEffect(() => {
    if (!flagOn) {
      try { navigate('/dashboard', { replace: true }); } catch { /* ignore */ }
    }
  }, [flagOn, navigate]);

  if (!flagOn) return null;

  const stepKey = STEPS[stepIdx];

  const goNext = useCallback(() => {
    setError('');
    // Per-step gates — keep generous defaults so the user isn't
    // trapped if a field looks optional.
    if (stepKey === 'plant') {
      if (!plantId) { setError(tStrict('backyard.error.pickPlant', 'Pick what you are growing.')); return; }
      if (plantId === 'other' && !plantNameOther.trim()) {
        setError(tStrict('backyard.error.otherPlant', 'Enter the plant you are growing.'));
        return;
      }
    }
    if (stepKey === 'where' && !growingLocation) {
      setError(tStrict('backyard.error.where', 'Pick where your plants live.'));
      return;
    }
    if (stepKey === 'experience' && !experienceLevel) {
      setError(tStrict('backyard.error.experience', 'Pick the option that fits you.'));
      return;
    }
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  }, [stepKey, plantId, plantNameOther, growingLocation, experienceLevel]);

  const goBack = useCallback(() => {
    setError('');
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  const finish = useCallback(() => {
    setError('');
    // Build the garden record per spec §3.
    const plantOption = PLANT_OPTIONS.find((p) => p.id === plantId);
    const plantLabel = plantOption?.fallback || plantId;
    const garden = {
      id:           'backyard_' + Date.now().toString(36),
      country:      'United States',
      experience:   'backyard',
      farmType:     'backyard',
      gardenName:   tStrict('backyard.defaultGardenName', 'My garden'),
      plantId:      plantId === 'other' ? 'other' : plantId,
      plantName:    plantId === 'other' ? plantNameOther.trim() : plantLabel,
      // Reuse the canonical `crop` field so existing engines that
      // read `farm.crop` see the picked plant. The legacy field
      // is intentionally NOT written here — server v2's payload
      // canonicaliser strips it on writes anyway.
      crop:         plantId === 'other' ? plantNameOther.trim().toLowerCase() : plantId,
      growingLocation,
      experienceLevel,
      city:         city.trim(),
      state:        state.trim(),
      onboardingCompleted: true,
      createdAt:    new Date().toISOString(),
    };
    try { _persistGarden(garden); }
    catch (err) {
      setError(tStrict('backyard.error.save', 'We could not save your garden. Please try again.'));
      try { console.warn('[backyard onboarding] save failed:', err && err.message); } catch { /* ignore */ }
      return;
    }
    try { trackEvent('onboarding_completed', { source: 'backyard' }); } catch { /* ignore */ }
    try { navigate('/dashboard', { replace: true }); } catch { /* ignore */ }
  }, [plantId, plantNameOther, growingLocation, experienceLevel, city, state, navigate]);

  const progressPct = Math.round(((stepIdx + 1) / STEPS.length) * 100);

  return (
    <main style={STYLES.page} data-screen="backyard-onboarding" data-step={stepKey}>
      <div style={STYLES.progressBar} role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ ...STYLES.progressFill, width: `${progressPct}%` }} />
      </div>

      {error ? <div style={STYLES.errorBlock}>{error}</div> : null}

      {stepKey === 'welcome' ? (
        <>
          <h1 style={STYLES.h1}>
            {tStrict('backyard.step.welcome.title', 'Great \u2014 let\u2019s set up your garden \uD83C\uDF31')}
          </h1>
          <p style={STYLES.subtitle}>
            {tStrict(
              'backyard.step.welcome.subtitle',
              'Six quick questions and you\u2019re done. Under a minute.'
            )}
          </p>
        </>
      ) : null}

      {stepKey === 'location' ? (
        <>
          <h2 style={STYLES.h2}>{tStrict('backyard.step.location.title', 'Where is your garden?')}</h2>
          <p style={STYLES.subtitle}>
            {tStrict(
              'backyard.step.location.subtitle',
              'You can let your phone detect it, or type your city and state.'
            )}
          </p>
          {locationStatus === 'idle' ? (
            <button type="button" onClick={requestLocation} style={STYLES.optionBtn}>
              {tStrict('backyard.location.detect', 'Detect my location')}
            </button>
          ) : null}
          {locationStatus === 'denied' ? (
            <p style={STYLES.helper}>
              {tStrict(
                'backyard.location.denied',
                'No problem \u2014 enter your city and state below.'
              )}
            </p>
          ) : null}
          <div style={STYLES.field}>
            <label style={STYLES.label} htmlFor="bk-city">
              {tStrict('backyard.location.city', 'City')}
            </label>
            <input
              id="bk-city"
              type="text"
              style={STYLES.input}
              value={city}
              onChange={(e) => setCity(e.target?.value || '')}
              autoComplete="address-level2"
            />
          </div>
          <div style={STYLES.field}>
            <label style={STYLES.label} htmlFor="bk-state">
              {tStrict('backyard.location.state', 'State')}
            </label>
            <input
              id="bk-state"
              type="text"
              style={STYLES.input}
              value={state}
              onChange={(e) => setStateName(e.target?.value || '')}
              autoComplete="address-level1"
            />
          </div>
        </>
      ) : null}

      {stepKey === 'plant' ? (
        <>
          <h2 style={STYLES.h2}>{tStrict('backyard.step.plant.title', 'What are you growing?')}</h2>
          <div style={STYLES.cardsGrid}>
            {PLANT_OPTIONS.map((opt) => {
              const active = plantId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPlantId(opt.id)}
                  style={{ ...STYLES.card, ...(active ? STYLES.cardActive : null) }}
                  data-testid={`plant-card-${opt.id}`}
                >
                  <span style={STYLES.cardIcon} aria-hidden="true">{opt.icon}</span>
                  <span>{tStrict(opt.labelKey, opt.fallback)}</span>
                </button>
              );
            })}
          </div>
          {plantId === 'other' ? (
            <div style={STYLES.field}>
              <label style={STYLES.label} htmlFor="bk-other">
                {tStrict('backyard.plant.otherLabel', 'Plant name')}
              </label>
              <input
                id="bk-other"
                type="text"
                style={STYLES.input}
                value={plantNameOther}
                onChange={(e) => setPlantNameOther(e.target?.value || '')}
                placeholder={tStrict('backyard.plant.otherPlaceholder', 'e.g. strawberries')}
                autoFocus
              />
            </div>
          ) : null}
        </>
      ) : null}

      {stepKey === 'where' ? (
        <>
          <h2 style={STYLES.h2}>{tStrict('backyard.step.where.title', 'Where are you growing?')}</h2>
          <div style={STYLES.optionRow}>
            {WHERE_OPTIONS.map((opt) => {
              const active = growingLocation === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGrowingLocation(opt.id)}
                  style={{ ...STYLES.optionBtn, ...(active ? STYLES.optionBtnActive : null) }}
                  data-testid={`where-option-${opt.id}`}
                >
                  {tStrict(opt.labelKey, opt.fallback)}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {stepKey === 'experience' ? (
        <>
          <h2 style={STYLES.h2}>{tStrict('backyard.step.experience.title', 'Are you new to growing?')}</h2>
          <div style={STYLES.optionRow}>
            {EXPERIENCE_OPTIONS.map((opt) => {
              const active = experienceLevel === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setExperienceLevel(opt.id)}
                  style={{ ...STYLES.optionBtn, ...(active ? STYLES.optionBtnActive : null) }}
                  data-testid={`exp-option-${opt.id}`}
                >
                  {tStrict(opt.labelKey, opt.fallback)}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {stepKey === 'done' ? (
        <>
          <h1 style={STYLES.h1}>
            {tStrict('backyard.step.done.title', 'You\u2019re all set.')}
          </h1>
          <p style={STYLES.subtitle}>
            {tStrict(
              'backyard.step.done.subtitle',
              'Let\u2019s start your garden plan.'
            )}
          </p>
        </>
      ) : null}

      <div style={STYLES.navRow}>
        {stepIdx > 0 && stepKey !== 'done' ? (
          <button type="button" onClick={goBack} style={STYLES.secondary}>
            {tStrict('common.back', 'Back')}
          </button>
        ) : <span />}
        {stepKey === 'done' ? (
          <button type="button" onClick={finish} style={STYLES.primary} data-testid="backyard-go-home">
            {tStrict('backyard.cta.goHome', 'Go to Home')}
          </button>
        ) : (
          <button type="button" onClick={goNext} style={STYLES.primary} data-testid="backyard-next">
            {tStrict('common.continue', 'Continue')}
          </button>
        )}
      </div>
    </main>
  );
}
