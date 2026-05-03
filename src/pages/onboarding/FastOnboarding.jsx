/**
 * FastOnboarding — sub-30-second onboarding flow per the
 * "Build Perfect Farroway Onboarding" spec.
 *
 *   <Route path="/onboarding/fast" element={<FastOnboarding />} />
 *
 * Why this flow exists alongside the legacy onboarding paths
 * ──────────────────────────────────────────────────────────
 * Spec goal: "Reduce onboarding to <30 seconds and deliver first
 * useful action immediately." The existing paths (FastFlow,
 * QuickGardenSetup, QuickFarmSetup, BackyardOnboarding) ship a
 * decent multi-step form each, but the user pays a 5-7 sub-step
 * tax before seeing anything actionable. FastOnboarding compresses
 * that to FOUR screens with one decision per screen, then renders
 * the engine's primary action with a single "Done" button.
 *
 * Screens
 *   1. Experience pick    — "What are you growing?"  garden|farm
 *   2. Plant/crop + setup — one screen, two compact rows
 *   3. Location           — "Use my location" (with manual fallback)
 *   4. First action       — "Before you do anything, do this first:"
 *                           Action card + Done → tomorrow hook
 *
 * Strict-rule audit
 *   • Inline styles only.
 *   • All visible text via tStrict / tSafe with English fallbacks.
 *   • Pure consumer of addGarden / addFarm / generateFirstPlan +
 *     navigator.geolocation. No backend calls.
 *   • Never throws — every save / geo call try/catch wrapped.
 *   • Validation is generous; missing optional fields fall through
 *     with safe defaults so the user is never trapped.
 *   • Saves PARTIAL context on screen 4 enter so a tab-close after
 *     screen 3 still leaves a usable garden/farm row.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tStrict } from '../../i18n/strictT.js';
import { tSafe } from '../../i18n/tSafe.js';
import { addGarden, addFarm } from '../../store/multiExperience.js';
import { saveTaskCompletion } from '../../store/farrowayLocal.js';
import { generateFirstPlan } from '../../core/firstPlanEngine.js';
import { setOnboardingComplete } from '../../utils/onboarding.js';
import { trackEvent } from '../../core/analytics.js';

// ── Color tokens (mirror onboarding visual language) ────────────
const C = {
  navy:    '#0B1D34',
  navy2:   '#081423',
  panel:   '#102C47',
  border:  '#1F3B5C',
  ink:     '#FFFFFF',
  inkDim:  'rgba(255,255,255,0.65)',
  green:   '#22C55E',
  greenBg: 'rgba(34,197,94,0.12)',
  greenBd: 'rgba(34,197,94,0.32)',
  greenFg: '#86EFAC',
  amber:   '#F59E0B',
};

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.navy} 0%, ${C.navy2} 100%)`,
    color: C.ink,
    padding: '1.25rem 1rem 6rem',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  progress: {
    height: 4, background: 'rgba(255,255,255,0.08)',
    borderRadius: 4, overflow: 'hidden', margin: '0 0 6px',
  },
  progressFill: {
    height: '100%', background: C.green,
    transition: 'width 220ms ease',
  },
  title: {
    margin: 0, fontSize: '1.5rem', fontWeight: 800,
    color: C.ink, letterSpacing: '-0.01em',
    lineHeight: 1.2,
  },
  subtitle: {
    margin: 0, fontSize: '0.9rem', color: C.inkDim, lineHeight: 1.4,
  },
  card: {
    background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: '1rem',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  // Big experience pick tiles (screen 1)
  bigTile: {
    appearance: 'none', display: 'flex', flexDirection: 'column',
    alignItems: 'flex-start', gap: 6,
    background: C.panel, border: `1px solid ${C.border}`,
    color: C.ink,
    borderRadius: 16, padding: '1.1rem 1rem',
    fontSize: '1rem', fontWeight: 700,
    cursor: 'pointer', minHeight: 80, fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'background 120ms ease, border-color 120ms ease, transform 80ms ease',
  },
  bigTileEmoji: { fontSize: '1.6rem', lineHeight: 1 },
  bigTileTitle: { fontSize: '1.1rem', fontWeight: 800 },
  bigTileSub:   { fontSize: '0.85rem', color: C.inkDim, fontWeight: 500 },

  pillRow: {
    display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6,
  },
  pill: {
    appearance: 'none',
    background: 'transparent', border: `1px solid ${C.border}`,
    color: C.ink,
    borderRadius: 999, padding: '0.55rem 0.95rem',
    fontSize: '0.85rem', fontWeight: 700,
    cursor: 'pointer', minHeight: 40, fontFamily: 'inherit',
  },
  pillActive: {
    background: C.greenBg, border: `1px solid ${C.greenBd}`,
    color: C.greenFg,
  },
  label: {
    fontSize: '0.78rem', fontWeight: 700,
    color: C.inkDim, textTransform: 'uppercase', letterSpacing: '0.06em',
    margin: '4px 0 -2px',
  },
  input: {
    appearance: 'none',
    background: 'rgba(0,0,0,0.32)', border: `1px solid ${C.border}`,
    color: C.ink,
    borderRadius: 10, padding: '0.65rem 0.85rem',
    fontSize: '0.95rem', fontWeight: 600, fontFamily: 'inherit',
    minHeight: 44, width: '100%', boxSizing: 'border-box',
  },
  primaryBtn: {
    appearance: 'none', display: 'block', width: '100%',
    border: 'none',
    background: C.green, color: C.ink,
    borderRadius: 12, padding: '0.85rem 1rem',
    fontSize: '0.95rem', fontWeight: 800,
    cursor: 'pointer', minHeight: 48, fontFamily: 'inherit',
    boxShadow: '0 6px 18px rgba(34,197,94,0.28)',
  },
  primaryBtnDisabled: { opacity: 0.55, cursor: 'default', boxShadow: 'none' },
  ghostBtn: {
    appearance: 'none', display: 'block', width: '100%',
    background: 'transparent', border: `1px solid ${C.border}`,
    color: C.ink,
    borderRadius: 12, padding: '0.7rem 1rem',
    fontSize: '0.9rem', fontWeight: 700,
    cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
  },
  geoStatus: {
    fontSize: '0.8rem', color: C.inkDim, lineHeight: 1.4,
  },

  // Action card (screen 4)
  actionEyebrow: {
    fontSize: '0.7rem', fontWeight: 800,
    color: C.greenFg, letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  actionCard: {
    background: C.greenBg,
    border: `1px solid ${C.greenBd}`,
    borderRadius: 16,
    padding: '1.1rem 1rem',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  actionTitle: {
    margin: 0, fontSize: '1.15rem', fontWeight: 800, color: C.ink,
    lineHeight: 1.25,
  },
  actionDetail: {
    margin: 0, fontSize: '0.875rem', color: C.inkDim, lineHeight: 1.45,
  },
  doneBlock: {
    background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: '1rem',
    display: 'flex', flexDirection: 'column', gap: 10,
    textAlign: 'center',
  },
  doneTitle: { margin: 0, fontSize: '1rem', fontWeight: 800, color: C.greenFg },
  doneSub:   { margin: 0, fontSize: '0.875rem', color: C.inkDim, lineHeight: 1.4 },
  errorRow:  { color: '#FCA5A5', fontSize: '0.85rem', lineHeight: 1.4 },
};

// ── Pickable tile sets (kept tiny on purpose) ───────────────────
const PLANT_OPTIONS = [
  { value: 'tomato',   label: 'Tomato',   emoji: '\u{1F345}' },
  { value: 'pepper',   label: 'Pepper',   emoji: '\u{1F336}' },
  { value: 'leafy',    label: 'Greens',   emoji: '\u{1F96C}' },
  { value: 'herbs',    label: 'Herbs',    emoji: '\u{1F33F}' },
  { value: 'flowers',  label: 'Flowers',  emoji: '\u{1F33C}' },
  { value: 'other',    label: 'Other',    emoji: '\u{1F331}' },
];

const CROP_OPTIONS = [
  { value: 'maize',    label: 'Maize',    emoji: '\u{1F33D}' },
  { value: 'tomato',   label: 'Tomato',   emoji: '\u{1F345}' },
  { value: 'pepper',   label: 'Pepper',   emoji: '\u{1F336}' },
  { value: 'cassava',  label: 'Cassava',  emoji: '\u{1F33E}' },
  { value: 'rice',     label: 'Rice',     emoji: '\u{1F35A}' },
  { value: 'other',    label: 'Other',    emoji: '\u{1F331}' },
];

const GROWING_SETUPS = [
  { value: 'container',      label: 'Pots / containers' },
  { value: 'raised_bed',     label: 'Raised bed' },
  { value: 'ground',         label: 'In the ground' },
  { value: 'indoor_balcony', label: 'Indoor / balcony' },
];

const FARM_SIZE_BUCKETS = [
  { value: 'small',  label: 'Small (< 5 acres)' },
  { value: 'medium', label: 'Medium (5\u201350 acres)' },
  { value: 'large',  label: 'Large (> 50 acres)' },
];

// ── Component ───────────────────────────────────────────────────
export default function FastOnboarding() {
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);

  // Form state — every field stays optional EXCEPT the experience
  // pick on screen 1 and the plant/crop pick on screen 2.
  const [experience, setExperience] = useState(null);   // 'garden' | 'farm'
  const [plant,      setPlant]      = useState('');     // garden plant code
  const [crop,       setCrop]       = useState('');     // farm crop code
  const [otherText,  setOtherText]  = useState('');     // when 'other' picked
  const [setup,      setSetup]      = useState('');     // garden growing setup
  const [size,       setSize]       = useState('');     // farm size category

  const [country,    setCountry]    = useState('');
  const [region,     setRegion]     = useState('');
  const [geoStatus,  setGeoStatus]  = useState('idle'); // idle|requesting|granted|denied

  const [savedRow,   setSavedRow]   = useState(null);   // row returned from addGarden/addFarm
  const [taskDone,   setTaskDone]   = useState(false);
  const [error,      setError]      = useState('');

  // Track flow-start once so analytics can attribute the funnel.
  const startedAtRef = useRef(null);
  useEffect(() => {
    if (startedAtRef.current) return;
    startedAtRef.current = Date.now();
    try { trackEvent('fast_onboarding_started', {}); } catch { /* swallow */ }
  }, []);

  const isGarden = experience === 'garden';
  const totalSteps = 4;
  const progressPct = Math.round(((stepIdx + 1) / totalSteps) * 100);

  // ── Step gates ────────────────────────────────────────────
  function canAdvance() {
    if (stepIdx === 0) return experience === 'garden' || experience === 'farm';
    if (stepIdx === 1) {
      // Plant/crop required. Setup/size optional but encouraged.
      const pick = isGarden ? plant : crop;
      if (!pick) return false;
      if (pick === 'other' && !otherText.trim()) return false;
      return true;
    }
    if (stepIdx === 2) return true;       // Location is non-blocking
    if (stepIdx === 3) return true;       // Final screen owns its own button
    return false;
  }

  // ── Geolocation (screen 3) ────────────────────────────────
  function requestLocation() {
    setError('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('requesting');
    try {
      navigator.geolocation.getCurrentPosition(
        () => {
          // Spec §3 — "Do not block if location fails." We only
          // record granted-state for the analytics event; the
          // user can still type country/region manually below.
          // We deliberately don't run a reverse-geocode here:
          // the spec says "if available" — it's optional context.
          setGeoStatus('granted');
        },
        () => { setGeoStatus('denied'); },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 60_000 },
      );
    } catch {
      setGeoStatus('denied');
    }
  }

  // ── Save partial context (called when entering screen 4) ─
  function persistRow() {
    if (savedRow) return savedRow; // already saved — idempotent
    setError('');
    try {
      const cropOrPlant = (isGarden
        ? (plant === 'other' ? otherText.trim() : plant)
        : (crop  === 'other' ? otherText.trim() : crop)
      ).toLowerCase().replace(/\s+/g, '_');
      const cropLabel = (isGarden
        ? (plant === 'other' ? otherText.trim()
            : (PLANT_OPTIONS.find((p) => p.value === plant)?.label || plant))
        : (crop === 'other' ? otherText.trim()
            : (CROP_OPTIONS.find((c) => c.value === crop)?.label || crop))
      );
      const payload = {
        crop:           cropOrPlant,
        cropLabel,
        name:           cropLabel ? `My ${cropLabel}` : (isGarden ? 'My garden' : 'My farm'),
        country:        country.trim().toUpperCase() || null,
        countryLabel:   country.trim() || null,
        state:          region.trim() || null,
        stateLabel:     region.trim() || null,
      };
      let row = null;
      if (isGarden) {
        row = addGarden({
          ...payload,
          // Spec §2 — garden minimal fields. growingSetup is the
          // only meaningful customisation we collect.
          growingSetup: setup || 'unknown',
          // Spec §2 — "Do NOT ask: exact size, units". We ship a
          // bucket category so the engine has a tier signal,
          // defaulted to 'small' (the safe non-blocking default
          // for a fast-onboarded garden).
          gardenSizeCategory: 'small',
          farmType: 'backyard',
        });
      } else {
        // Farm: spec §2 says "sizeCategory only", no exact size.
        // Map size bucket to engine sizeBucket vocabulary so the
        // existing growingContext._pickSize translates cleanly.
        const sizeBucket = (size === 'small') ? 'lt1'
                         : (size === 'medium') ? '1to5'
                         : (size === 'large') ? 'gt5' : 'unknown';
        row = addFarm({
          ...payload,
          sizeBucket,
          farmSizeBucket: sizeBucket,
          // Spec §2 + §7 — sizeCategory is the ONLY size signal
          // we collect on the fast path. exact farmSize stays
          // null so the data-model validator never blocks.
          farmType: 'small_farm',
        });
      }
      if (!row || !row.id) {
        setError(tSafe('fastOnboarding.error.save',
          'We couldn\u2019t save right now. Try again.'));
        return null;
      }
      // Mark onboarding done — same flag the legacy guards read.
      try { setOnboardingComplete(); } catch { /* swallow */ }
      try {
        trackEvent('onboarding_completed', {
          source:           'fast',
          activeExperience: isGarden ? 'garden' : 'farm',
          elapsedMs:        startedAtRef.current
            ? Date.now() - startedAtRef.current : null,
        });
      } catch { /* swallow */ }
      setSavedRow(row);
      return row;
    } catch {
      setError(tSafe('fastOnboarding.error.save',
        'We couldn\u2019t save right now. Try again.'));
      return null;
    }
  }

  function goNext() {
    if (!canAdvance()) return;
    if (stepIdx === 2) {
      // Entering screen 4 — save context first so a tab-close on
      // the action screen still leaves a usable row + the engine
      // has cropOrPlant to work with.
      persistRow();
    }
    setStepIdx((i) => Math.min(totalSteps - 1, i + 1));
  }

  function goBack() {
    setStepIdx((i) => Math.max(0, i - 1));
  }

  // ── First-action engine (screen 4) ────────────────────────
  // Single primary action per the spec: actions[0] from the
  // engine. We also keep actions[1] available for a "tomorrow
  // hook" hint after Done is tapped.
  const actions = useMemo(() => {
    if (stepIdx !== 3) return [];
    try {
      return generateFirstPlan({
        crop:     (isGarden
          ? (plant === 'other' ? otherText.trim() : plant)
          : (crop  === 'other' ? otherText.trim() : crop)
        ),
        isGarden,
        location: { country: country.trim(), region: region.trim() },
        plantedAt: null,
        weather:   null,
      });
    } catch { return []; }
  }, [stepIdx, isGarden, plant, crop, otherText, country, region]);

  const primaryAction = actions[0] || {
    text: isGarden
      ? tStrict('fastOnboarding.fallbackTitle.garden', 'Check your plant today')
      : tStrict('fastOnboarding.fallbackTitle.farm',   'Check your crop today'),
    detail: tStrict('fastOnboarding.fallbackDetail',
      'Look closely at the leaves \u2014 anything different from yesterday?'),
    type: 'inspection',
  };
  const tomorrowAction = actions[1] || null;

  function handleDone() {
    setError('');
    // Mark the first task complete so the user's progress streak
    // begins right here. Uses the same store helper the daily
    // surface relies on so the streak/feedback loop stays in
    // sync no matter where the task gets ticked off.
    try {
      saveTaskCompletion({
        taskId: `fast_first_${primaryAction.type || 'task'}`,
        farmId: savedRow ? savedRow.id : null,
      });
    } catch { /* swallow */ }
    try {
      trackEvent('fast_onboarding_first_task_done', {
        actionType: primaryAction.type || 'unknown',
        elapsedMs:  startedAtRef.current
          ? Date.now() - startedAtRef.current : null,
      });
    } catch { /* swallow */ }
    setTaskDone(true);
  }

  function handleEnterApp() {
    // Land on /home so the daily plan picks up immediately. The
    // /manage-gardens / /farms surfaces are reachable from the
    // bottom nav once the user wants to manage their entity.
    try { navigate('/home', { replace: true }); }
    catch {
      try { navigate('/dashboard', { replace: true }); }
      catch { /* swallow */ }
    }
  }

  // ── Render per step ───────────────────────────────────────
  return (
    <main
      style={S.page}
      data-testid="fast-onboarding"
      data-screen={`fast-step-${stepIdx}`}
    >
      <div
        style={S.progress}
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={tSafe('fastOnboarding.progressAria',
          'Onboarding progress')}
      >
        <div style={{ ...S.progressFill, width: `${progressPct}%` }} />
      </div>

      {/* ── Screen 1: experience pick ─────────────────────── */}
      {stepIdx === 0 ? (
        <>
          <h1 style={S.title}>
            {tStrict('fastOnboarding.title.experience',
              'What are you growing?')}
          </h1>
          <p style={S.subtitle}>
            {tStrict('fastOnboarding.subtitle.experience',
              'Pick where your plants live. You can add the other one later.')}
          </p>
          <button
            type="button"
            onClick={() => { setExperience('garden'); setStepIdx(1); }}
            style={{
              ...S.bigTile,
              ...(experience === 'garden'
                ? { background: C.greenBg, borderColor: C.greenBd }
                : null),
            }}
            data-testid="fast-onboarding-pick-garden"
          >
            <span style={S.bigTileEmoji} aria-hidden="true">{'\u{1F331}'}</span>
            <span style={S.bigTileTitle}>
              {tStrict('fastOnboarding.experience.garden.title', 'At home')}
            </span>
            <span style={S.bigTileSub}>
              {tStrict('fastOnboarding.experience.garden.sub',
                'Backyard, balcony, or a few pots')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setExperience('farm'); setStepIdx(1); }}
            style={{
              ...S.bigTile,
              ...(experience === 'farm'
                ? { background: C.greenBg, borderColor: C.greenBd }
                : null),
            }}
            data-testid="fast-onboarding-pick-farm"
          >
            <span style={S.bigTileEmoji} aria-hidden="true">{'\u{1F33D}'}</span>
            <span style={S.bigTileTitle}>
              {tStrict('fastOnboarding.experience.farm.title', 'On a farm')}
            </span>
            <span style={S.bigTileSub}>
              {tStrict('fastOnboarding.experience.farm.sub',
                'Field crops, market garden, or larger plot')}
            </span>
          </button>
        </>
      ) : null}

      {/* ── Screen 2: plant/crop + setup/size ─────────────── */}
      {stepIdx === 1 ? (
        <>
          <h1 style={S.title}>
            {isGarden
              ? tStrict('fastOnboarding.title.plant',
                  'What are you growing at home?')
              : tStrict('fastOnboarding.title.crop',
                  'What crop are you growing?')}
          </h1>
          <p style={S.subtitle}>
            {tStrict('fastOnboarding.subtitle.plantCrop',
              'Pick the closest match. We\u2019ll fine-tune later.')}
          </p>

          <span style={S.label}>
            {isGarden
              ? tStrict('fastOnboarding.label.plant', 'Plant')
              : tStrict('fastOnboarding.label.crop',  'Crop')}
          </span>
          <div style={S.pillRow}>
            {(isGarden ? PLANT_OPTIONS : CROP_OPTIONS).map((opt) => {
              const picked = isGarden ? plant : crop;
              const active = picked === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (isGarden) setPlant(opt.value);
                    else          setCrop(opt.value);
                  }}
                  style={active ? { ...S.pill, ...S.pillActive } : S.pill}
                  data-testid={`fast-onboarding-${isGarden ? 'plant' : 'crop'}-${opt.value}`}
                  aria-pressed={active}
                >
                  <span aria-hidden="true" style={{ marginRight: 6 }}>{opt.emoji}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
          {(isGarden ? plant : crop) === 'other' ? (
            <input
              type="text"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder={isGarden
                ? tStrict('fastOnboarding.placeholder.plantOther',
                    'e.g. basil, mint, marigold')
                : tStrict('fastOnboarding.placeholder.cropOther',
                    'e.g. cocoa, sorghum, beans')}
              style={S.input}
              maxLength={40}
              autoFocus
              data-testid="fast-onboarding-other-text"
            />
          ) : null}

          <span style={S.label}>
            {isGarden
              ? tStrict('fastOnboarding.label.setup', 'Where are they growing?')
              : tStrict('fastOnboarding.label.size',  'How big is your farm?')}
          </span>
          <div style={S.pillRow}>
            {(isGarden ? GROWING_SETUPS : FARM_SIZE_BUCKETS).map((opt) => {
              const picked = isGarden ? setup : size;
              const active = picked === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (isGarden) setSetup(opt.value);
                    else          setSize(opt.value);
                  }}
                  style={active ? { ...S.pill, ...S.pillActive } : S.pill}
                  data-testid={`fast-onboarding-${isGarden ? 'setup' : 'size'}-${opt.value}`}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance()}
            style={canAdvance() ? S.primaryBtn : { ...S.primaryBtn, ...S.primaryBtnDisabled }}
            data-testid="fast-onboarding-next-2"
          >
            {tStrict('fastOnboarding.next', 'Next')}
          </button>
          <button
            type="button"
            onClick={goBack}
            style={S.ghostBtn}
            data-testid="fast-onboarding-back-2"
          >
            {tStrict('fastOnboarding.back', 'Back')}
          </button>
        </>
      ) : null}

      {/* ── Screen 3: location ────────────────────────────── */}
      {stepIdx === 2 ? (
        <>
          <h1 style={S.title}>
            {tStrict('fastOnboarding.title.location', 'Where are you?')}
          </h1>
          <p style={S.subtitle}>
            {tStrict('fastOnboarding.subtitle.location',
              'We use this for weather-aware tips. Skipping is fine \u2014 we\u2019ll fall back to general guidance.')}
          </p>

          <button
            type="button"
            onClick={requestLocation}
            disabled={geoStatus === 'requesting'}
            style={{
              ...S.primaryBtn,
              ...(geoStatus === 'requesting'
                ? { opacity: 0.7, cursor: 'default' } : null),
            }}
            data-testid="fast-onboarding-use-location"
          >
            {geoStatus === 'requesting'
              ? tStrict('fastOnboarding.location.detecting', 'Detecting\u2026')
              : tStrict('fastOnboarding.location.useMine',   '\uD83D\uDCCD Use my location')}
          </button>

          {geoStatus === 'granted' ? (
            <p style={{ ...S.geoStatus, color: C.greenFg }}>
              {tStrict('fastOnboarding.location.granted',
                'Got it \u2014 you can fine-tune the country/region below if you want.')}
            </p>
          ) : null}
          {geoStatus === 'denied' ? (
            <p style={S.geoStatus}>
              {tStrict('fastOnboarding.location.denied',
                'No problem \u2014 enter your country and region below.')}
            </p>
          ) : null}

          <span style={S.label}>
            {tStrict('fastOnboarding.label.country', 'Country')}
          </span>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={tStrict('fastOnboarding.placeholder.country',
              'e.g. Ghana, Nigeria, USA')}
            style={S.input}
            maxLength={60}
            autoComplete="country-name"
            data-testid="fast-onboarding-country"
          />
          <span style={S.label}>
            {tStrict('fastOnboarding.label.region', 'Region (optional)')}
          </span>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder={tStrict('fastOnboarding.placeholder.region',
              'e.g. Ashanti, Lagos, Maryland')}
            style={S.input}
            maxLength={60}
            autoComplete="address-level1"
            data-testid="fast-onboarding-region"
          />

          <button
            type="button"
            onClick={goNext}
            style={S.primaryBtn}
            data-testid="fast-onboarding-next-3"
          >
            {country.trim()
              ? tStrict('fastOnboarding.next', 'Next')
              : tStrict('fastOnboarding.skipLocation',
                  'Skip \u2014 I\u2019ll add later')}
          </button>
          <button
            type="button"
            onClick={goBack}
            style={S.ghostBtn}
            data-testid="fast-onboarding-back-3"
          >
            {tStrict('fastOnboarding.back', 'Back')}
          </button>
        </>
      ) : null}

      {/* ── Screen 4: first action ────────────────────────── */}
      {stepIdx === 3 ? (
        <>
          <span style={S.actionEyebrow}>
            {tStrict('fastOnboarding.firstAction.eyebrow',
              'Before you do anything, do this first:')}
          </span>
          <div style={S.actionCard} data-testid="fast-onboarding-first-action">
            <h2 style={S.actionTitle}>{primaryAction.text}</h2>
            <p   style={S.actionDetail}>{primaryAction.detail}</p>
          </div>

          {!taskDone ? (
            <button
              type="button"
              onClick={handleDone}
              style={S.primaryBtn}
              data-testid="fast-onboarding-done"
            >
              {tStrict('fastOnboarding.firstAction.done', 'Done')}
            </button>
          ) : (
            <div style={S.doneBlock} data-testid="fast-onboarding-done-block">
              <h3 style={S.doneTitle}>
                {tStrict('fastOnboarding.firstAction.feedback.title',
                  'Nice \u2014 streak started.')}
              </h3>
              <p style={S.doneSub}>
                {tomorrowAction
                  ? tStrict('fastOnboarding.firstAction.feedback.tomorrow',
                      'Tomorrow we\u2019ll remind you to:') + ' ' + tomorrowAction.text
                  : tStrict('fastOnboarding.firstAction.feedback.fallback',
                      'We\u2019ll show your next action on Home tomorrow.')}
              </p>
              <button
                type="button"
                onClick={handleEnterApp}
                style={S.primaryBtn}
                data-testid="fast-onboarding-enter-app"
              >
                {tStrict('fastOnboarding.firstAction.enterApp',
                  'Open my Home')}
              </button>
            </div>
          )}

          {error ? (
            <div style={S.errorRow} data-testid="fast-onboarding-error">
              {error}
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
