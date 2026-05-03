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
import { stampOnboardingStart } from '../../core/onboardingTiming.js';

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
  // Viral Hook §1 + §2 — full-screen surface for the curiosity
  // hook. Centered card, generous spacing, no other UI. Auto-
  // navigates after 1.8s. Background mirrors `page` so the
  // visual continuity from screen 2 → hook → home stays calm.
  hookPage: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.navy} 0%, ${C.navy2} 100%)`,
    color: C.ink,
    padding: '1.5rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hookCard: {
    maxWidth: '24rem',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    textAlign: 'left',
  },
  hookLine1: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'rgba(234,242,255,0.62)',
    letterSpacing: '0.01em',
  },
  hookLine2: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
  },
  hookLine3: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: '#FCD34D',
    lineHeight: 1.4,
  },
  hookSharePrompt: {
    margin: '12px 0 0',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'rgba(234,242,255,0.72)',
  },
  hookShareBtn: {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#FFFFFF',
    borderRadius: 999,
    padding: '0.55rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 40,
    fontFamily: 'inherit',
  },
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
  // Onboarding Completion §1 — textual stepper eyebrow above the
  // hairline progress bar. Replaces the opaque "75%" read with
  // the spec's "Step 1 of 1 · Almost done" framing. Tiny, dim,
  // never the dominant element on screen.
  stepEyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: '0 0 8px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  stepEyebrowStep: {
    color: 'rgba(255,255,255,0.55)',
  },
  stepEyebrowDot: {
    color: 'rgba(255,255,255,0.35)',
  },
  stepEyebrowAlmost: {
    color: '#86EFAC',
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
  // Activation §3 — small experience toggle on step 1. Sits
  // above the headline; tap flips garden ↔ farm without a
  // separate screen. Subtle styling so it doesn't compete with
  // the crop-picker tiles below.
  experienceToggle: {
    appearance: 'none',
    background: 'transparent',
    border: '1px solid rgba(34,197,94,0.45)',
    borderRadius: 999,
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: 700,
    padding: '6px 14px',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    margin: '0 0 6px',
    WebkitTapHighlightColor: 'transparent',
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
  // High-Conversion Onboarding §1 — text link beneath the
  // primary CTA. Reveals/hides the manual country/region inputs.
  // Visually a link, not a button — the spec wants it secondary
  // so the typical user never registers it as something they
  // need to interact with.
  linkBtn: {
    appearance: 'none',
    display: 'block',
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: 'rgba(234,242,255,0.62)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.5rem',
    minHeight: 36,
    textDecoration: 'underline',
    textDecorationColor: 'rgba(234,242,255,0.32)',
    textUnderlineOffset: 3,
    fontFamily: 'inherit',
  },
  // High-Conversion Onboarding §1 — location status card. Single
  // tap target showing 📍 + status text. Idle/denied states are
  // tappable to (re-)trigger detection; granted state is purely
  // informational.
  locationCard: {
    appearance: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: C.ink,
    borderRadius: 14,
    padding: '14px 16px',
    margin: '6px 0 14px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 56,
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  locationCardGranted: {
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.40)',
    color: C.greenFg,
    cursor: 'default',
  },
  locationCardDenied: {
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.36)',
    color: '#FDE68A',
  },
  locationCardIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  locationCardText: {
    flex: 1,
    lineHeight: 1.35,
  },
  // Final Onboarding Optimization §1 — confidence cue under the
  // location card. Quiet green text + ✓ glyph. Sits in its own
  // line so the user reads "Location detected → ✓ Looks correct"
  // top-down without crowding the primary card.
  locationConfidence: {
    marginTop: -6,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: 700,
    color: C.greenFg,
    letterSpacing: '0.01em',
  },
  // Final Onboarding Optimization §2 — reassurance below crop
  // pillRow. Tiny + dim — whispers, not shouts.
  cropReassurance: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: -4,
    marginBottom: 10,
    fontStyle: 'italic',
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
//
// Unify §1/§2 — there is ONE crop list shown to every user
// regardless of garden/farm mode. The earlier split (PLANT_OPTIONS
// vs CROP_OPTIONS) caused the tile grid to reshuffle when the user
// flipped the experience toggle, which read as a bug. The unified
// list is the deduplicated union of both legacy sets, ordered so
// the most common picks (tomato, pepper, maize) come first.
//
// Experience (garden vs farm) is now an INDEPENDENT signal driven
// by the toggle pill above the headline + future behavioural
// inference (skipped tasks, scan counts, feedback patterns). It
// only controls downstream routing — addGarden vs addFarm,
// engine wording, urgency tiers — never the crop list itself.
// Onboarding Completion §3 — limit to top 4 crops + Other so the
// pill row is a single horizontal scan rather than a 9-item grid.
// Picks are the most common smallholder crops globally (tomato,
// pepper, maize, cassava); rice/herbs/flowers/greens still
// reachable via the Other free-text input so we don't lock users
// out of their crop. Spec §3 explicitly calls for 3-5 options.
const UNIFIED_CROP_OPTIONS = [
  { value: 'tomato',   label: 'Tomato',   emoji: '\u{1F345}' },
  { value: 'pepper',   label: 'Pepper',   emoji: '\u{1F336}' },
  { value: 'maize',    label: 'Maize',    emoji: '\u{1F33D}' },
  { value: 'cassava',  label: 'Cassava',  emoji: '\u{1F33E}' },
  { value: 'other',    label: 'Other',    emoji: '\u{1F331}' },
];

// Legacy aliases — kept so existing label-lookup call sites
// (persistRow's cropLabel) don't churn. Both point at the same
// unified list, so behaviour is identical regardless of which
// branch runs.
const PLANT_OPTIONS = UNIFIED_CROP_OPTIONS;
const CROP_OPTIONS  = UNIFIED_CROP_OPTIONS;

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
  // High-Conversion Onboarding spec — true 2-screen flow:
  //   Screen 0 — Location confirm (auto-detect → "Continue")
  //   Screen 1 — Crop selection (4 + Other → tap → /home)
  // Default to 0 so a fresh open lands on the location-confirm
  // screen. The experience-pick screen the legacy stepIdx=0
  // used to render is no longer reached; its JSX has been
  // replaced inline by the location-confirm UI below. The
  // legacy multi-step location form (stepIdx 2) and the final
  // ready screen (stepIdx 3) stay in scope for deep-link
  // compat but are unreachable on the happy path.
  const [stepIdx, setStepIdx] = useState(0);

  // Form state — every field stays optional EXCEPT the experience
  // pick on screen 1 and the plant/crop pick on screen 2.
  const [experience, setExperience] = useState('farm');   // 'garden' | 'farm'
  const [plant,      setPlant]      = useState('');     // garden plant code
  const [crop,       setCrop]       = useState('');     // farm crop code
  const [otherText,  setOtherText]  = useState('');     // when 'other' picked
  const [setup,      setSetup]      = useState('');     // garden growing setup
  const [size,       setSize]       = useState('');     // farm size category

  const [country,    setCountry]    = useState('');
  const [region,     setRegion]     = useState('');
  const [geoStatus,  setGeoStatus]  = useState('idle'); // idle|requesting|granted|denied
  // High-Conversion Onboarding §1 — manual entry on the
  // location-confirm screen sits behind a link. Default false so
  // typical users never see the country/region inputs. Toggled by
  // the "Enter manually" link beneath the Continue button.
  const [showManualEntry, setShowManualEntry] = useState(false);
  // Viral Hook §1 + §2 — transient hook screen shown between crop
  // pick and navigation to /home. Persistence + flags fire when
  // the hook flips on (so a user who closes the tab mid-hook
  // doesn't lose their work); auto-redirect timer fires 1.8s
  // later. Single shot per onboarding session.
  const [showingHook, setShowingHook] = useState(false);

  const [savedRow,   setSavedRow]   = useState(null);   // row returned from addGarden/addFarm
  const [taskDone,   setTaskDone]   = useState(false);
  const [error,      setError]      = useState('');

  // Track flow-start once so analytics can attribute the funnel.
  const startedAtRef = useRef(null);
  useEffect(() => {
    if (startedAtRef.current) return;
    startedAtRef.current = Date.now();
    try { trackEvent('fast_onboarding_started', {}); } catch { /* swallow */ }
    // Onboarding cleanup §4 — stamp the canonical "first action
    // timer" so FirstActionGate can compute time_to_first_action_ms
    // on the user's first Done tap. Idempotent — a returning user
    // who re-enters this flow doesn't restart the clock.
    try { stampOnboardingStart(); } catch { /* swallow */ }
    // Activation §1 — auto-request the device's location in the
    // background so by the time the user has picked a crop the
    // geo state is already settled. requestLocation itself is a
    // no-throw no-op when geolocation is unsupported / denied,
    // so this can run unconditionally on every mount.
    try { requestLocation(); } catch { /* swallow */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isGarden = experience === 'garden';
  const totalSteps = 4;
  const progressPct = Math.round(((stepIdx + 1) / totalSteps) * 100);

  // ── Step gates ────────────────────────────────────────────
  function canAdvance() {
    // High-Conversion Onboarding §1 — location screen is non-
    // blocking. Geo detection runs in the background; "Continue"
    // is always tappable so a slow / denied geo never gates the
    // user.
    if (stepIdx === 0) return true;
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

  // ── Viral Hook §2 — auto-redirect after the hook screen mounts.
  //   Timer fires once, exactly 1.8s after the hook flips on.
  //   Cleared on unmount so a back-button mid-hook never leaves
  //   a stale navigation queued. Persistence + flags already
  //   ran in goNext when the user tapped Next, so closing the
  //   tab mid-hook still leaves the saved row + onboarding-
  //   complete flag in place.
  useEffect(() => {
    if (!showingHook) return undefined;
    const timer = setTimeout(() => {
      try { navigate('/home', { replace: true }); }
      catch {
        try { navigate('/dashboard', { replace: true }); }
        catch { /* swallow */ }
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, [showingHook, navigate]);

  // ── Viral Hook §3 — share button. Uses the Web Share API when
  //   available (mobile primary path); falls back to copying a
  //   share link to clipboard. Never throws; never blocks the
  //   auto-redirect timer.
  function onClickShare() {
    const shareText = tStrict(
      'fastOnboarding.viralHook.sharePrompt',
      'Want to see what your plants need today?',
    );
    const shareUrl = (typeof window !== 'undefined' && window.location)
      ? `${window.location.origin}/`
      : 'https://farroway.app/';
    try {
      trackEvent('viral_hook_share_tapped', {});
    } catch { /* swallow */ }
    try {
      if (typeof navigator !== 'undefined'
          && typeof navigator.share === 'function') {
        navigator.share({
          title: 'Farroway',
          text:  shareText,
          url:   shareUrl,
        }).catch(() => { /* user cancelled or share failed — silent */ });
        return;
      }
    } catch { /* fall through to clipboard */ }
    try {
      if (typeof navigator !== 'undefined'
          && navigator.clipboard
          && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(`${shareText} ${shareUrl}`)
          .catch(() => { /* clipboard blocked — silent */ });
      }
    } catch { /* ignore */ }
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
    // Activation §4 — collapse the flow. Once the user has picked
    // a crop on step 1 (the only required input now that step 0
    // auto-skips), persist the row and jump straight to Home so
    // the FirstActionGate becomes the very next thing they see.
    // Skips the legacy in-flow location screen + first-action
    // preview; both are still reachable via /onboarding/fast for
    // pilots / tests but the typical happy path is one screen +
    // one navigation.
    if (stepIdx === 1) {
      try { persistRow(); } catch { /* never block navigation */ }
      try { setOnboardingComplete(); } catch { /* swallow */ }
      // Onboarding Completion §6 — stamp the "just completed"
      // intent so FarmerTodayPage can show the spec's exact line
      // ("We prepared your first action") as a brief banner
      // above the FirstActionGate on first paint. sessionStorage
      // (not localStorage) so it never persists across browser
      // sessions and a returning user doesn't see it again. The
      // banner self-clears the flag after first read.
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('farroway:onboarding:justCompleted', '1');
        }
      } catch { /* ignore */ }
      try {
        trackEvent('fast_onboarding_collapsed_to_home', {
          experience,
          elapsedMs: startedAtRef.current
            ? Date.now() - startedAtRef.current : null,
        });
      } catch { /* swallow */ }
      // Viral Hook §1 + §2 — instead of navigating immediately,
      // show the curiosity hook screen for 1.8s. The actual
      // navigation fires from the showingHook useEffect below.
      // All persistence + flags + analytics already ran above so
      // closing the tab mid-hook still leaves the user's data
      // intact and a return open lands cleanly on /home.
      try {
        trackEvent('viral_hook_shown', {
          experience,
        });
      } catch { /* swallow */ }
      setShowingHook(true);
      return;
    }
    // Legacy multi-step path — preserved for any deep-link
    // entry that bypassed step 1 (e.g. a test setting stepIdx=2).
    if (stepIdx === 2) {
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
  // Viral Hook §1 + §2 — when the hook screen is on, render ONLY
  // the hook (suppress stepper, progress bar, and step content).
  // This is the "memorable, shareable first impression" surface;
  // any other UI competing with it would dilute the moment.
  if (showingHook) {
    // Final Onboarding Optimization §3 — hook simplified to ONE
    // line ("Do not water today"). The earlier 3-line copy
    // ("Based on your location… / Most people water too early
    // today. / That can harm your plants.") tested as too dense
    // for the 1.8s auto-redirect window — users were still
    // reading line 2 when navigation fired. Single bold line
    // lands in <0.5s + leaves room for the share affordance
    // without clutter. Old i18n keys preserved (line2 carries
    // the new spec wording) so translation packs that
    // already shipped don't churn.
    const hookHeadline = tStrict(
      'fastOnboarding.viralHook.line2',
      'Do not water today',
    );
    const sharePrompt = tStrict(
      'fastOnboarding.viralHook.sharePrompt',
      'Want to see what your plants need today?',
    );
    const shareCta = tStrict(
      'fastOnboarding.viralHook.shareCta',
      'Share',
    );
    return (
      <main
        style={S.hookPage}
        data-testid="fast-onboarding-viral-hook"
      >
        <div style={S.hookCard} role="status" aria-live="polite">
          <p style={S.hookLine2}>{hookHeadline}</p>
          <p style={S.hookSharePrompt}>{sharePrompt}</p>
          <button
            type="button"
            onClick={onClickShare}
            style={S.hookShareBtn}
            data-testid="fast-onboarding-viral-share"
          >
            <span aria-hidden="true" style={{ marginRight: 6 }}>
              {'\u{1F4E4}'}
            </span>
            {shareCta}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      style={S.page}
      data-testid="fast-onboarding"
      data-screen={`fast-step-${stepIdx}`}
    >
      {/* Onboarding Completion §1 — explicit "Step N of N · Almost
          done" eyebrow instead of an opaque % bar. Reads as
          "you're nearly there", not "you have N% to slog through".
          The progress bar still renders for the assistive-tech
          path (role/aria) but visually is replaced by the textual
          stepper above it. */}
      {/* High-Conversion Onboarding §1 — stepper reflects the true
          2-screen flow: 1/2 on location-confirm, 2/2 on crop-pick.
          "Almost done" still shows alongside since both screens
          are within seconds of completing the flow. */}
      <div style={S.stepEyebrow} data-testid="fast-onboarding-step-eyebrow">
        <span style={S.stepEyebrowStep}>
          {tStrict('fastOnboarding.progress.stepOfX',
            `Step ${stepIdx === 0 ? 1 : 2} of 2`,
            { current: stepIdx === 0 ? 1 : 2, total: 2 })}
        </span>
        <span style={S.stepEyebrowDot} aria-hidden="true">{'\u00B7'}</span>
        <span style={S.stepEyebrowAlmost}>
          {tStrict('fastOnboarding.progress.almostDone', 'Almost done')}
        </span>
      </div>
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

      {/* ── Screen 1: location confirm (High-Conversion §1) ─────
          Auto-detect runs on mount (mount useEffect calls
          requestLocation()); this screen is just the confirm UI.
          The "Continue" button is always tappable — geo is
          non-blocking. Manual entry sits behind a link so a
          typical user never sees a typing field. */}
      {stepIdx === 0 ? (
        <>
          <h1 style={S.title}>
            {tStrict('fastOnboarding.locationConfirm.title',
              'Where are you?')}
          </h1>
          <p style={S.subtitle}>
            {tStrict('fastOnboarding.locationConfirm.subtitle',
              'We use this for weather-aware tips.')}
          </p>

          {/* Status card — communicates the current geo state at
              a glance. Tapping it (when idle) re-triggers the
              detection so a user who arrived before the auto-
              call settled can still kick it off. */}
          <button
            type="button"
            onClick={geoStatus === 'granted' ? undefined : requestLocation}
            style={{
              ...S.locationCard,
              ...(geoStatus === 'granted' ? S.locationCardGranted : null),
              ...(geoStatus === 'denied'  ? S.locationCardDenied  : null),
            }}
            data-testid="fast-onboarding-location-card"
            data-geo-status={geoStatus}
          >
            <span style={S.locationCardIcon} aria-hidden="true">
              {geoStatus === 'granted' ? '\u2705'
               : geoStatus === 'denied' ? '\u26A0\uFE0F'
               : '\uD83D\uDCCD'}
            </span>
            <span style={S.locationCardText}>
              {geoStatus === 'requesting'
                ? tStrict('fastOnboarding.locationConfirm.detecting',
                    'Detecting your location\u2026')
                : geoStatus === 'granted'
                ? tStrict('fastOnboarding.locationConfirm.granted',
                    'Location detected')
                : geoStatus === 'denied'
                ? tStrict('fastOnboarding.locationConfirm.denied',
                    'We couldn\u2019t detect your location')
                : tStrict('fastOnboarding.locationConfirm.idle',
                    'Tap to use your location')}
            </span>
          </button>

          {/* Final Onboarding Optimization §1 — "✓ Looks correct"
              affirmation rendered immediately below the location
              card when geo permission was granted. Removes the
              "is this right?" hesitation by giving the user an
              explicit confidence cue. Hidden in the requesting /
              denied / idle states because it would read as a
              false promise there. */}
          {geoStatus === 'granted' ? (
            <span style={S.locationConfidence} data-testid="fast-onboarding-location-confidence">
              <span aria-hidden="true">{'\u2714'}</span>{' '}
              {tStrict('fastOnboarding.locationConfirm.looksCorrect',
                'Looks correct')}
            </span>
          ) : null}

          {/* Primary CTA — always tappable per spec. Geo state
              is informational; advancing to the crop screen is
              never gated on it. */}
          <button
            type="button"
            onClick={() => {
              // User Behavior Tracking §1 — fire location_confirmed
              // on Continue tap. Carries the geo state so the
              // funnel can split on auto-detect-success vs
              // manual-entry vs skipped paths.
              try {
                trackEvent('location_confirmed', {
                  geoStatus,
                  hasManualCountry: !!country.trim(),
                  hasManualRegion:  !!region.trim(),
                });
              } catch { /* swallow */ }
              setStepIdx(1);
            }}
            style={S.primaryBtn}
            data-testid="fast-onboarding-location-continue"
          >
            {tStrict('fastOnboarding.continue', 'Continue')}
          </button>

          {/* Manual entry behind a link per spec §1 ("hide manual
              fields behind link"). Default off; toggling reveals
              two compact text fields. The fields are still
              optional — Continue advances regardless of whether
              the user typed anything. */}
          <button
            type="button"
            onClick={() => setShowManualEntry((v) => !v)}
            style={S.linkBtn}
            data-testid="fast-onboarding-toggle-manual"
            aria-expanded={showManualEntry}
          >
            {showManualEntry
              ? tStrict('fastOnboarding.locationConfirm.hideManual',
                  'Hide manual entry')
              : tStrict('fastOnboarding.locationConfirm.enterManually',
                  'Enter manually')}
          </button>

          {showManualEntry ? (
            <>
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
                data-testid="fast-onboarding-country-screen0"
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
                data-testid="fast-onboarding-region-screen0"
              />
            </>
          ) : null}
        </>
      ) : null}

      {/* ── Screen 2: plant/crop + setup/size ─────────────── */}
      {stepIdx === 1 ? (
        <>
          {/* Activation §3 — small "garden vs farm" toggle right
              above the headline. Defaults to farm; the user can
              flip to garden in one tap WITHOUT a separate
              experience-pick screen. */}
          <button
            type="button"
            onClick={() => setExperience(isGarden ? 'farm' : 'garden')}
            style={S.experienceToggle}
            data-testid="fast-onboarding-experience-toggle"
          >
            {isGarden
              ? tStrict('fastOnboarding.toggleToFarm', 'On a farm? Switch')
              : tStrict('fastOnboarding.toggleToGarden', 'Growing in a garden? Switch')}
          </button>
          {/* Optimize Onboarding for Backyard Users §1 — single
              friendly headline that works for both garden and
              farm users. Earlier mode-specific copy ("What crop
              are you growing?") read as too farming-specific
              for a backyard user just picking a tomato plant.
              "What are you growing?" is universal + low-pressure. */}
          <h1 style={S.title}>
            {tStrict('fastOnboarding.title.universal',
              'What are you growing?')}
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
            {/* Unify §1/§2 — single options list, single test-id
                shape. Picking writes to BOTH plant + crop state
                so the downstream persistRow path (which still
                reads experience-specific fields) stays stable
                whichever way the user later flips the toggle. */}
            {UNIFIED_CROP_OPTIONS.map((opt) => {
              const picked = isGarden ? plant : crop;
              const active = picked === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setPlant(opt.value);
                    setCrop(opt.value);
                    // User Behavior Tracking §1 — fire
                    // crop_selected on tile tap (NOT on the
                    // downstream "Next" button) so the funnel
                    // captures the moment the user actually
                    // chose, not the moment they advanced.
                    // Lets us measure tile-tap → next-button
                    // hesitation as its own micro-funnel.
                    try {
                      trackEvent('crop_selected', {
                        crop:       opt.value,
                        experience: isGarden ? 'garden' : 'farm',
                      });
                    } catch { /* swallow */ }
                  }}
                  style={active ? { ...S.pill, ...S.pillActive } : S.pill}
                  data-testid={`fast-onboarding-crop-${opt.value}`}
                  aria-pressed={active}
                >
                  <span aria-hidden="true" style={{ marginRight: 6 }}>{opt.emoji}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
          {/* Final Onboarding Optimization §2 — "You can change
              this later" reassurance directly under the crop
              pills. Removes the "what if I pick wrong?"
              hesitation that historically drove drop-off here.
              Tiny, dim styling so it whispers rather than
              shouts — the pill row stays the dominant element. */}
          <span
            style={S.cropReassurance}
            data-testid="fast-onboarding-crop-reassurance"
          >
            {tStrict('fastOnboarding.cropReassurance',
              'You can change this later')}
          </span>
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

          {/* Onboarding Completion §4 — farm size + growing setup
              were optional from day one; the spec promotes that to
              "remove entirely" so the screen has a single
              decision (crop) on it. The state hooks (setSetup /
              setSize) stay in scope so persistRow's downstream
              writes ('unknown' / 'small' defaults) don't break,
              but the user is never asked. Cuts ~6 taps off the
              p50 onboarding flow.
              suppressed:
              <span style={S.label}>...how big is your farm?</span>
              <div style={S.pillRow}>...size pills...</div>
          */}

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

          {/* Onboarding Drop-Off §1 — manual country/region fields
              are hidden by default; the auto-detect → confirm path
              is the only one users see in the happy flow. The
              fields surface ONLY when geo permission was denied,
              giving a graceful fallback without exposing every
              new user to a typing field they don't need.
              Spec mandates "show confirm only, hide manual
              fields". The legacy multi-step flow itself is
              auto-skipped (FastOnboarding navigates from step 1
              directly to /home) so most users never reach this
              code path; this just hardens it for deep-links. */}
          {geoStatus === 'denied' ? (
            <>
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
            </>
          ) : null}

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
