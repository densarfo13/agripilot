/**
 * FastFlow — 3-step onboarding per the high-trust onboarding
 * spec (post-fix).
 *
 *   1. CHOOSE         "What are you growing?"  (Garden / Farm)
 *   2. QUICK SETUP    Hand off to /setup/garden OR /setup/farm
 *                     (single-screen forms that already exist)
 *   3. SAVE \u2192 Home   QuickGardenSetup / QuickFarmSetup persist
 *                     and route to /home themselves.
 *
 * Why the rewrite
 * ───────────────
 * The legacy 4-screen FastFlow asked "Are you new to farming?"
 * FIRST \u2014 a skill-level question before the user had even told
 * us whether they grow at home or on a farm. Two consequences:
 *   \u2022 Backyard users got farm-shaped guidance they couldn't act on.
 *   \u2022 The 6-question count drove drop-off.
 *
 * This rewrite:
 *   \u2022 Picks experience FIRST so every downstream surface (tasks,
 *     scan, treatment) has the right context from minute one.
 *   \u2022 Routes out to the existing single-screen QuickGardenSetup /
 *     QuickFarmSetup so the flow is 3 steps, not 4. The "Are you
 *     new to growing?" question moves to the setup screens as a
 *     non-blocking guidance toggle.
 *
 * Strict rules
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 *   \u2022 Every visible string via tStrict (no English bleed when
 *     active language is fr/sw/ha/hi/tw).
 *   \u2022 Inline styles only.
 *   \u2022 Never throws \u2014 navigate failures are swallowed.
 *   \u2022 Bottom nav, mic, scan, funding/sell are all suppressed
 *     during onboarding by extending BottomTabNav.HIDE_NAV_PATHS
 *     and by FastFlow not mounting any of those surfaces itself.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';
import { loadData, saveData, removeData } from '../../store/localStore.js';
import { recommendTopCrops } from '../../lib/recommendations/topCropEngine.js';
import { cropLabel } from '../../utils/cropLabel.js';
import LanguageSuggestionBanner from '../../components/locale/LanguageSuggestionBanner.jsx';
// Final-gap stability \u00a78 \u2014 onboarding-completed flag must
// block re-entry into onboarding routes so a returning user
// can never accidentally land in setup mid-flow.
import { isOnboardingComplete } from '../../utils/onboarding.js';
// Spec \u00a72 \u2014 Step 0 language picker. We reuse the canonical
// setLanguage() from i18n/index.js so the choice flows into every
// other surface (the existing LanguageSelector dropdown stays in
// sync, and `farroway:langchange` fires for live re-render).
import { setLanguage as i18nSetLanguage } from '../../i18n/index.js';
// Progress bar lives in its own leaf module so the QuickGarden /
// QuickFarm setup forms can import it without dragging the
// FastFlow import tree along with them (which previously pulled
// LanguageSuggestionBanner + topCropEngine + the i18n strict
// translator into every setup screen render).
import OnboardingProgressBar from '../../components/onboarding/OnboardingProgressBar.jsx';
// Production-hardening spec \u00a71 \u2014 canonical onboarding
// telemetry. Fired at every meaningful step transition so the
// launch dashboard can build a complete funnel without joining
// experience-specific events.
import { trackEvent } from '../../analytics/analyticsStore.js';

const STORE_KEY = 'onboarding';

const SIZE_OPTIONS = [
  { id: 'small',  emoji: '🌱', labelKey: 'fastFlow.size.small.label',  helperKey: 'fastFlow.size.small.helper' },
  { id: 'medium', emoji: '🌿', labelKey: 'fastFlow.size.medium.label', helperKey: 'fastFlow.size.medium.helper' },
  { id: 'large',  emoji: '🌳', labelKey: 'fastFlow.size.large.label',  helperKey: 'fastFlow.size.large.helper' },
];

// Five most common starter crops. Caller can switch to a free
// dropdown later; this list keeps the screen scroll-free on
// phones and the spec to "no scrolling".
const COMMON_CROPS = ['maize', 'cassava', 'rice', 'tomato', 'beans'];

function _initialState() {
  try {
    const cur = loadData(STORE_KEY, null);
    if (cur && typeof cur === 'object') return cur;
  } catch { /* ignore */ }
  return { step: 1, isNewFarmer: null, location: '', farmSize: '', crop: '' };
}

export default function FastFlow() {
  const navigate = useNavigate();
  const { lang } = useTranslation();

  // Final-gap stability \u00a78 \u2014 returning users with the
  // onboarding-completed flag set MUST land on /home, not in
  // FastFlow. This prevents the onboarding loop where a
  // re-entry (deep link, refresh of /onboarding/start) walks
  // the user through the picker again. The check runs once on
  // mount; a future user reset clears the flag and re-enables
  // this route.
  useEffect(() => {
    try {
      if (isOnboardingComplete()) {
        navigate('/home', { replace: true });
      }
    } catch { /* swallow \u2014 router failure shouldn't block render */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState(_initialState);

  // Persist on every state change. Pure localStorage — no API.
  const update = useCallback((patch) => {
    setState((cur) => {
      const next = { ...cur, ...patch };
      try { saveData(STORE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  function goBack() {
    setState((cur) => {
      const prev = Math.max(1, (cur.step || 1) - 1);
      const next = { ...cur, step: prev };
      try { saveData(STORE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }

  function complete() {
    // Clear onboarding state and route to Home. We don't post to
    // the backend here (strict rule); the next surface that needs
    // the data reads it from `farroway:store:onboarding` until a
    // separate background task syncs to the server. The handoff
    // is intentionally loose — Home renders fine with whatever
    // the existing profile context has.
    try { removeData(STORE_KEY); } catch { /* ignore */ }
    navigate('/dashboard', { replace: true });
  }

  // High-trust onboarding (spec \u00a71\u2013\u00a72) \u2014 two in-component
  // steps before we hand off to the multi-step Quick setup form:
  //   Step 0: Choose language (so every translated screen below
  //           is read in the user's preferred language)
  //   Step 1: What are you growing? (Garden / Farm)
  // After Step 1 we navigate to /setup/garden or /setup/farm; the
  // setup forms own steps 2\u20134 (or 2\u20135 for farm).
  const [step, setStep] = useState(state.step === 1 ? 1 : 0);

  // Production-hardening spec \u00a71 \u2014 fire onboarding_started on
  // first mount + onboarding_step_viewed every time the visible
  // step changes. Both events are best-effort; a tracking
  // failure must NEVER cascade into the render path.
  useEffect(() => {
    try { trackEvent('onboarding_started', { draftVersion: 2 }); }
    catch { /* swallow */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      trackEvent('onboarding_step_viewed', {
        currentStep: step,
        // step 0 is the language picker; step 1 is the
        // experience picker. activeExperience is unknown until
        // step 1 \u2192 setup, so the hint stays null here.
        activeExperience: null,
      });
    } catch { /* swallow */ }
  }, [step]);

  function pickLanguage(code) {
    try { i18nSetLanguage(code); } catch { /* swallow */ }
    try { saveData(STORE_KEY, { ...state, step: 1, language: code }); }
    catch { /* swallow */ }
    try {
      trackEvent('onboarding_step_completed', {
        currentStep: 0, language: code,
      });
    } catch { /* swallow */ }
    setStep(1);
  }

  function pickExperience(experience) {
    const expSafe = experience === 'farm' ? 'farm' : 'garden';
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = expSafe === 'garden' ? 'backyard' : 'farm';
        localStorage.setItem('farroway_experience', JSON.stringify(stored));
      }
    } catch { /* swallow \u2014 setup form has its own safety net */ }
    try { saveData(STORE_KEY, { ...state, step: 2, experience: expSafe }); }
    catch { /* swallow */ }
    try {
      trackEvent('onboarding_step_completed', {
        currentStep: 1, activeExperience: expSafe,
      });
    } catch { /* swallow */ }
    const target = expSafe === 'garden' ? '/setup/garden' : '/setup/farm';
    try { navigate(target); } catch { /* swallow */ }
  }

  // Spec \u00a75 \u2014 progress bar instead of a long step-count pill. Total
  // assumed 4 steps (FastFlow Step 0 + Step 1, then 2 setup
  // steps); progress reflects the visible position in the flow.
  // The setup forms own their own slice of the bar.
  const totalSteps = 4;
  const visibleStep = step + 1; // 1-indexed display

  return (
    <div style={S.page} data-testid="fast-flow" data-step={String(step)}>
      <div style={S.container}>
        <Header
          lang={lang}
          step={visibleStep}
          totalSteps={totalSteps}
          onBack={step > 0 ? () => setStep(step - 1) : null}
        />
        <OnboardingProgressBar value={visibleStep} total={totalSteps} />
        {step === 0 && (
          <ScreenLanguage onPick={pickLanguage} />
        )}
        {step === 1 && (
          <>
            {/* Language suggestion banner runs only AFTER Step 0
                so the user has already made an explicit choice
                (or seen the picker). Self-hides on subsequent
                visits per the existing per-farm flag. */}
            <LanguageSuggestionBanner
              farm={state.location ? { country: state.location } : null}
              autoDetect
            />
            <ScreenEntry onPick={pickExperience} />
          </>
        )}
      </div>
    </div>
  );
}

// OnboardingProgressBar lives in
// src/components/onboarding/OnboardingProgressBar.jsx so the
// QuickGarden / QuickFarm setup forms can import it without
// pulling the whole FastFlow tree.

// ─── Screens ──────────────────────────────────────────────

// Spec \u00a72 \u2014 the 6 launch languages we offer at Step 0. Twi
// is intentionally omitted from the FIRST-PAINT picker (it's
// still reachable via the header dropdown) because the
// onboarding spec mandates a complete-language guarantee per
// screen. Spanish IS included \u2014 guard:i18n-parity confirms
// 96/96 keys translated.
const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English'   },
  { code: 'es', label: 'Espa\u00F1ol'  },
  { code: 'fr', label: 'Fran\u00E7ais' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ha', label: 'Hausa'     },
  { code: 'hi', label: '\u0939\u093F\u0928\u094D\u0926\u0940'    },
];

function ScreenLanguage({ onPick }) {
  return (
    <section style={S.screen} data-testid="fast-flow-language" data-screen="onb-language">
      <h1 style={S.h1}>
        {tStrict('onboarding.chooseLanguage', 'Choose your language')}
      </h1>
      <div style={{ ...S.optionStack, gap: 8 }}>
        {LANGUAGE_OPTIONS.map((opt) => (
          <button
            key={opt.code}
            type="button"
            style={{ ...S.choice, ...S.choiceSecondary, justifyContent: 'flex-start' }}
            onClick={() => onPick(opt.code)}
            data-testid={`onb-language-${opt.code}`}
            aria-label={opt.label}
          >
            <span style={S.choiceIcon} aria-hidden="true">{'\uD83D\uDCAC'}</span>
            <span style={S.choiceText}>{opt.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Header({ step, totalSteps, onBack }) {
  return (
    <header style={S.header}>
      <div style={S.brandRow}>
        {/* Premium logo (final-onboarding-polish spec \u00a71). The
            emoji that used to sit here was replaced with the
            canonical raster mark from /icons/logo-premium.jpg.
            Height capped at 32px; aspect ratio preserved via
            object-fit; alt is empty because the wordmark
            "Farroway" beside it carries the brand name. */}
        <img
          src="/icons/logo-premium.jpg"
          alt=""
          width="32"
          height="32"
          style={S.brandLogoImg}
          aria-hidden="true"
        />
        <div style={S.brandTextCol}>
          <span style={S.brandName}>Farroway</span>
          <span style={S.brandTagline}>
            {tStrict('fastFlow.tagline', 'Know what to do today. Grow better.')}
          </span>
        </div>
      </div>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          style={S.backBtn}
          aria-label={tStrict('onboarding.back', 'Back')}
          data-testid="fast-flow-back"
        >
          \u2190
        </button>
      ) : (
        <span style={S.stepPill} data-testid="fast-flow-step">
          {tStrict('onboarding.step', 'Step {done} of {total}')
            .replace('{done}', String(step))
            .replace('{total}', String(totalSteps || 4))}
        </span>
      )}
    </header>
  );
}

function ScreenEntry({ onPick }) {
  // High-trust onboarding spec \u00a71 + final-onboarding-polish
  // \u00a73\u2013\u00a75 \u2014 the first question reframes from
  // "What are you growing?" to "Where are you growing?" so the
  // tiles answer the right question. Each tile carries a
  // subtitle so the user understands the bucket without
  // tapping. The "At home" tile is rendered with the primary
  // green so the conversion-default reads first; the "On a
  // farm" tile is a strong-bordered neutral card so it never
  // looks disabled \u2014 just secondary in the visual hierarchy.
  return (
    <section style={S.screen} data-testid="fast-flow-entry" data-screen="onb-entry">
      <h1 style={S.h1}>
        {tStrict('onboarding.whereAreYouGrowing', 'Where are you growing?')}
      </h1>
      <div style={S.optionStack}>
        <button
          type="button"
          style={{ ...S.choice, ...S.choicePrimary, alignItems: 'flex-start' }}
          onClick={() => onPick('garden')}
          data-testid="onb-entry-garden"
          aria-label={tStrict('onboarding.atHome', 'At home')}
        >
          <span style={S.choiceIcon} aria-hidden="true">{'\uD83C\uDF31'}</span>
          <span style={S.choiceTextCol}>
            <span style={S.choiceText}>
              {tStrict('onboarding.atHome', 'At home')}
            </span>
            <span style={S.choiceSub}>
              {tStrict('onboarding.atHomeSub',
                'Garden, pots, containers, backyard')}
            </span>
          </span>
        </button>
        <button
          type="button"
          style={{ ...S.choice, ...S.choiceFarmCard, alignItems: 'flex-start' }}
          onClick={() => onPick('farm')}
          data-testid="onb-entry-farm"
          aria-label={tStrict('onboarding.onAFarm', 'On a farm')}
        >
          <span style={S.choiceIcon} aria-hidden="true">{'\uD83D\uDE9C'}</span>
          <span style={S.choiceTextCol}>
            <span style={S.choiceText}>
              {tStrict('onboarding.onAFarm', 'On a farm')}
            </span>
            <span style={S.choiceSub}>
              {tStrict('onboarding.onAFarmSub',
                'Fields, crops, or larger growing areas')}
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}

function ScreenSetup({ state, onChange, onContinue }) {
  const [detecting, setDetecting] = useState(false);

  // Auto-detect via the standard browser geolocation API. Falls
  // back to the dropdown when the user denies / browser lacks
  // support / a timeout fires. No external geocoder — we store
  // the raw coordinates as a string so the next surface can
  // resolve them later (or accept "unknown" gracefully).
  function autoDetect() {
    if (detecting) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setDetecting(true);
    let done = false;
    const guard = setTimeout(() => {
      if (done) return;
      done = true;
      setDetecting(false);
    }, 6000);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (done) return; done = true; clearTimeout(guard);
          const lat = pos?.coords?.latitude;
          const lon = pos?.coords?.longitude;
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            onChange({ location: `${lat.toFixed(2)},${lon.toFixed(2)}` });
          }
          setDetecting(false);
        },
        () => {
          if (done) return; done = true; clearTimeout(guard);
          setDetecting(false);
        },
        { enableHighAccuracy: false, timeout: 5500, maximumAge: 60_000 },
      );
    } catch {
      done = true; clearTimeout(guard); setDetecting(false);
    }
  }

  const canContinue = !!(state.location && state.farmSize);

  return (
    <section style={S.screen} data-testid="fast-flow-setup">
      <h1 style={S.h1Compact}>
        {tStrict('fastFlow.setup.title', 'Quick setup')}
      </h1>

      {/* 1. Location */}
      <div style={S.field}>
        <label style={S.fieldLabel}>
          {tStrict('fastFlow.setup.location', 'Location')}
        </label>
        <div style={S.fieldRow}>
          <input
            type="text"
            style={S.input}
            value={state.location || ''}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder={tStrict('fastFlow.setup.locationPlaceholder', 'City or region')}
            data-testid="fast-flow-location-input"
          />
          <button
            type="button"
            style={S.detectBtn}
            onClick={autoDetect}
            disabled={detecting}
            data-testid="fast-flow-detect"
          >
            {detecting
              ? tStrict('fastFlow.setup.detecting', 'Detecting…')
              : tStrict('fastFlow.setup.autoDetect', 'Auto-detect')}
          </button>
        </div>
      </div>

      {/* 2. Farm size */}
      <div style={S.field}>
        <label style={S.fieldLabel}>
          {tStrict('fastFlow.setup.farmSize', 'Farm size')}
        </label>
        <div style={S.sizeRow}>
          {SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ farmSize: opt.id })}
              style={{
                ...S.sizeChip,
                ...(state.farmSize === opt.id ? S.sizeChipActive : null),
              }}
              data-testid={`fast-flow-size-${opt.id}`}
              aria-pressed={state.farmSize === opt.id}
            >
              <span style={S.sizeEmoji} aria-hidden="true">{opt.emoji}</span>
              <span style={S.sizeLabel}>
                {tStrict(opt.labelKey, opt.id)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Crop */}
      <div style={S.field}>
        <label style={S.fieldLabel}>
          {tStrict('fastFlow.setup.crop', 'Crop')}
        </label>
        <div style={S.cropRow}>
          <button
            type="button"
            onClick={() => onChange({ crop: '__recommend__' })}
            style={{
              ...S.cropChip,
              ...(state.crop === '__recommend__' ? S.cropChipActive : null),
            }}
            data-testid="fast-flow-recommend"
          >
            ✨ {tStrict('fastFlow.setup.recommend', 'Recommend for me')}
          </button>
          <select
            value={state.crop && state.crop !== '__recommend__' ? state.crop : ''}
            onChange={(e) => onChange({ crop: e.target.value })}
            style={S.select}
            data-testid="fast-flow-crop-select"
          >
            <option value="">
              {tStrict('fastFlow.setup.cropSelect', 'Or pick a crop…')}
            </option>
            {COMMON_CROPS.map((c) => (
              <option key={c} value={c}>{cropLabel(c, undefined)}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        style={{ ...S.cta, ...(canContinue ? null : S.ctaDisabled) }}
        data-testid="fast-flow-setup-continue"
      >
        {tStrict('common.continue', 'Continue')} →
      </button>
    </section>
  );
}

function ScreenRecommendation({ state, lang, onChange, onContinue }) {
  // Run the existing pure recommendation engine. Inputs are
  // intentionally minimal — the engine handles missing fields
  // gracefully and returns a top crop based on whatever signals
  // are available. When the user picked an explicit crop, we
  // skip the engine call and render their pick verbatim.
  const recommended = useMemo(() => {
    if (state.crop && state.crop !== '__recommend__') return state.crop;
    try {
      const result = recommendTopCrops({
        farm: { size: state.farmSize, location: state.location },
        country: null,
        weather: null,
        season: null,
      });
      const list = Array.isArray(result?.crops) ? result.crops : [];
      const top = list[0];
      return (top && (top.id || top.crop || top.code)) || 'maize';
    } catch {
      return 'maize';
    }
  }, [state.crop, state.farmSize, state.location]);

  const cropName = cropLabel(recommended, lang);

  function accept() {
    onChange({ crop: recommended });
    onContinue();
  }

  return (
    <section style={S.screen} data-testid="fast-flow-recommendation">
      <div style={S.recCard}>
        <span style={S.recBadge}>
          {tStrict('fastFlow.rec.badge', 'Recommended crop')}
        </span>
        <h2 style={S.recCrop}>{cropName}</h2>
        <p style={S.recBody}>
          {tStrict('fastFlow.rec.body', 'Based on your location and season.')}
        </p>
      </div>
      <button
        type="button"
        onClick={accept}
        style={S.cta}
        data-testid="fast-flow-rec-continue"
      >
        {tStrict('common.continue', 'Continue')} →
      </button>
    </section>
  );
}

function ScreenFirstTask({ state, lang, onAct }) {
  // No fetch — pick a sensible starter task by farm size + crop.
  // The full Today's Action experience kicks in on /dashboard;
  // this card is a one-line preview so the farmer sees an
  // actionable first step before tapping into Home.
  const cropName = cropLabel(state.crop, lang)
                || tStrict('fastFlow.firstTask.crop.fallback', 'your crop');
  const taskTitle = tStrict('fastFlow.firstTask.title', 'Today\u2019s action');
  const taskBody  = tStrict(
    'fastFlow.firstTask.body',
    'Walk your land and check soil moisture before planting {crop}.',
  ).replace('{crop}', cropName);

  return (
    <section style={S.screen} data-testid="fast-flow-first-task">
      <div style={S.taskCard}>
        <span style={S.taskBadge}>{taskTitle}</span>
        <p style={S.taskBody}>{taskBody}</p>
      </div>
      <button
        type="button"
        onClick={onAct}
        style={S.cta}
        data-testid="fast-flow-act"
      >
        {tStrict('fastFlow.firstTask.cta', 'Act now')} →
      </button>
    </section>
  );
}

// ─── Styles ──────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    display: 'flex',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 480,
    padding: '1rem 1.25rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    // Final-onboarding-polish spec \u00a71 \u2014 8\u201312px between logo
    // and "Farroway" wordmark; 10px sits in the middle.
    gap: 10,
  },
  // Premium logo image (final-onboarding-polish spec \u00a71).
  // Fixed 32x32 square mirrors the largest spec-allowed
  // height (28\u201332px). objectFit:contain preserves the
  // aspect ratio of the source JPG and never stretches.
  brandLogoImg: {
    width: 32,
    height: 32,
    objectFit: 'contain',
    borderRadius: 6,
    flex: '0 0 auto',
  },
  // Legacy emoji style kept for any caller still rendering
  // the text logo. Not referenced by Header any more.
  brandLogo: { fontSize: 30, lineHeight: 1 },
  brandTextCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  brandName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#22C55E',
    letterSpacing: '0.01em',
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.65)',
  },
  backBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: '#FFFFFF',
    width: 40,
    height: 40,
    borderRadius: 999,
    fontSize: 18,
    cursor: 'pointer',
  },
  stepPill: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.65)',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    padding: '4px 10px',
    borderRadius: 999,
  },

  screen: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginTop: 24,
  },
  h1: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.25,
    textAlign: 'center',
  },
  h1Compact: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.2,
  },

  optionStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  choice: {
    width: '100%',
    appearance: 'none',
    borderRadius: 16,
    padding: '18px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
  },
  choicePrimary: {
    background: '#22C55E',
    color: '#0B1D34',
    border: 'none',
    boxShadow: '0 8px 22px rgba(34,197,94,0.25)',
  },
  choiceSecondary: {
    background: 'rgba(255,255,255,0.05)',
    color: '#FFFFFF',
    border: '1px solid rgba(255,255,255,0.18)',
  },
  // Final-onboarding-polish spec \u00a75 \u2014 the "On a farm" tile.
  // Stronger 1.5px border + slightly higher background opacity
  // than the default secondary card so it reads as
  // "secondary, but not disabled". The text stays full-white
  // so contrast against the dark backdrop is strong.
  choiceFarmCard: {
    background: 'rgba(255,255,255,0.07)',
    color: '#FFFFFF',
    border: '1.5px solid rgba(255,255,255,0.32)',
  },
  choiceIcon: { fontSize: 26 },
  // Single-line title. The subtext sits below in choiceTextCol
  // so the title stays large + scannable.
  choiceText: { fontSize: 16, fontWeight: 700, lineHeight: 1.2, textAlign: 'left' },
  // Sub-line (final-onboarding-polish spec \u00a74) \u2014 the bucket
  // explanation under each tile title. Uses currentColor with
  // explicit opacity so contrast holds on BOTH the dark-text
  // primary tile AND the light-text secondary tile.
  choiceSub: {
    fontSize: 13,
    fontWeight: 500,
    color: 'currentColor',
    opacity: 0.78,
    textAlign: 'left',
    lineHeight: 1.35,
    marginTop: 2,
  },
  // Vertical column wrapping the title + subtitle so they sit
  // stacked instead of inline.
  choiceTextCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },

  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  fieldRow: { display: 'flex', gap: 8, alignItems: 'stretch' },
  input: {
    flex: 1,
    minWidth: 0,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 15,
    padding: '11px 14px',
    minHeight: 44,
  },
  detectBtn: {
    flex: '0 0 auto',
    appearance: 'none',
    background: 'rgba(34,197,94,0.18)',
    border: '1px solid rgba(34,197,94,0.45)',
    borderRadius: 12,
    color: '#86EFAC',
    fontSize: 13,
    fontWeight: 700,
    padding: '0 12px',
    minHeight: 44,
    cursor: 'pointer',
  },

  sizeRow: { display: 'flex', gap: 8 },
  sizeChip: {
    flex: 1,
    appearance: 'none',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 14,
    color: '#FFFFFF',
    padding: '12px 6px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    minHeight: 70,
  },
  sizeChipActive: {
    background: 'rgba(34,197,94,0.18)',
    border: '1px solid rgba(34,197,94,0.55)',
    color: '#86EFAC',
  },
  sizeEmoji: { fontSize: 22, lineHeight: 1 },
  sizeLabel: { fontSize: 12, fontWeight: 700 },

  cropRow: { display: 'flex', flexDirection: 'column', gap: 8 },
  cropChip: {
    appearance: 'none',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.40)',
    borderRadius: 12,
    color: '#86EFAC',
    fontSize: 14,
    fontWeight: 700,
    padding: '10px 14px',
    cursor: 'pointer',
    minHeight: 44,
    textAlign: 'left',
  },
  cropChipActive: {
    background: 'rgba(34,197,94,0.28)',
    border: '1px solid rgba(34,197,94,0.65)',
    color: '#FFFFFF',
  },
  select: {
    appearance: 'none',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 14,
    padding: '11px 14px',
    minHeight: 44,
  },

  recCard: {
    background: '#102C47',
    border: '1px solid rgba(34,197,94,0.45)',
    borderRadius: 16,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  recBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.14)',
    border: '1px solid rgba(34,197,94,0.4)',
    padding: '3px 10px',
    borderRadius: 999,
  },
  recCrop: {
    margin: '4px 0 0',
    fontSize: 26,
    fontWeight: 800,
    color: '#FFFFFF',
  },
  recBody: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.4,
  },

  taskCard: {
    background: '#102C47',
    border: '1px solid rgba(14,165,233,0.40)',
    borderRadius: 16,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  taskBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#7DD3FC',
    background: 'rgba(14,165,233,0.14)',
    border: '1px solid rgba(14,165,233,0.4)',
    padding: '3px 10px',
    borderRadius: 999,
  },
  taskBody: {
    margin: 0,
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 1.4,
    fontWeight: 600,
  },

  cta: {
    width: '100%',
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 800,
    padding: '14px 20px',
    borderRadius: 16,
    cursor: 'pointer',
    minHeight: 52,
    boxShadow: '0 10px 24px rgba(34,197,94,0.25)',
  },
  ctaDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
};
