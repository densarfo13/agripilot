/**
 * PitchMode — investor / NGO walkthrough overlay for the admin
 * dashboard. UI-only. Holds its own React state, mounts a tiny
 * floating panel, and gives sections a "highlight when this step
 * is active" wrapper. No backend, no new APIs, no global state.
 *
 * Public API
 *   <PitchModeProvider>          — wraps the page; owns state.
 *   <PitchModeToggle />          — header button (Enter/Exit).
 *   <PitchModeHighlight stepId>  — wrap any section to auto-highlight
 *                                  when that step is active. Adds
 *                                  data-pitch-step="<id>" so the
 *                                  scroll effect can find it.
 *   <PitchModeOverlay />         — floating bottom-right panel with
 *                                  Back / Next / Exit. Only renders
 *                                  when pitchMode is on.
 *
 * Step config
 *   The default 4-step list is bundled below (DEFAULT_STEPS). The
 *   provider also accepts a `steps` prop so a different page can
 *   override the script without forking the component.
 *
 * Why a context instead of prop-drilling
 *   Highlights wrap arbitrary pieces of the page tree. Threading
 *   `currentStep` through every section would be invasive — a
 *   small, page-local context keeps the wiring to a single
 *   <PitchModeProvider> at the top of the page.
 *
 * Lifetime
 *   State is per-mount. Closing the page exits Pitch Mode. We do
 *   NOT persist the state to localStorage — Pitch Mode is a
 *   demo-time tour, not a setting.
 */

import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useState,
} from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';

// ─── Default 4-step script ──────────────────────────────────

export const DEFAULT_STEPS = Object.freeze([
  Object.freeze({
    id: 0,
    titleKey: 'pitch.step.farmerOverview.title',
    titleEn:  'Farmer Overview',
    bodyKey:  'pitch.step.farmerOverview.body',
    bodyEn:   'This shows total farmers and active participation levels.',
  }),
  Object.freeze({
    id: 1,
    titleKey: 'pitch.step.riskDetection.title',
    titleEn:  'Risk Detection',
    bodyKey:  'pitch.step.riskDetection.body',
    bodyEn:   'We identify farmers at risk based on activity and compliance.',
  }),
  Object.freeze({
    id: 2,
    titleKey: 'pitch.step.marketOpportunities.title',
    titleEn:  'Market Opportunities',
    bodyKey:  'pitch.step.marketOpportunities.body',
    bodyEn:   'These farmers are ready to sell and can be connected to buyers.',
  }),
  Object.freeze({
    id: 3,
    titleKey: 'pitch.step.yieldIntelligence.title',
    titleEn:  'Yield Intelligence',
    bodyKey:  'pitch.step.yieldIntelligence.body',
    bodyEn:   'We estimate production output using farm data and performance.',
  }),
]);

// ─── Context ────────────────────────────────────────────────

const PitchModeContext = createContext(null);

export function PitchModeProvider({ steps = DEFAULT_STEPS, children }) {
  const [pitchMode,   setPitchMode]   = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Auto-scroll the active step into view whenever the step
  // changes while pitchMode is on. Selector matches the
  // data-pitch-step attribute the highlight wrapper renders.
  useEffect(() => {
    if (!pitchMode) return;
    if (typeof document === 'undefined') return;
    try {
      const el = document.querySelector(`[data-pitch-step="${currentStep}"]`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch { /* SSR / locked-down — never throw from a tour */ }
  }, [pitchMode, currentStep]);

  // Reset to step 0 every time pitchMode is turned ON so the
  // walkthrough starts at the beginning and an admin can re-pitch
  // mid-meeting without manually rewinding.
  useEffect(() => {
    if (pitchMode) setCurrentStep(0);
  }, [pitchMode]);

  const next = useCallback(() => {
    setCurrentStep((s) => Math.min(steps.length - 1, s + 1));
  }, [steps.length]);

  const prev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const value = useMemo(() => ({
    pitchMode,
    currentStep,
    totalSteps: steps.length,
    steps,
    setPitchMode,
    next,
    prev,
    goTo: (n) => setCurrentStep(Math.max(0, Math.min(steps.length - 1, n))),
  }), [pitchMode, currentStep, steps, next, prev]);

  return (
    <PitchModeContext.Provider value={value}>
      {children}
    </PitchModeContext.Provider>
  );
}

export function usePitchMode() {
  const ctx = useContext(PitchModeContext);
  // Fail-soft: if a component tries to read pitch state outside
  // the provider, return a no-op shape so it renders normally
  // (no border, no overlay) instead of throwing.
  if (!ctx) {
    return {
      pitchMode: false,
      currentStep: 0,
      totalSteps: 0,
      steps: [],
      setPitchMode: () => {},
      next: () => {},
      prev: () => {},
      goTo: () => {},
    };
  }
  return ctx;
}

// ─── Toggle button ──────────────────────────────────────────

export function PitchModeToggle({ style = null, className = '' } = {}) {
  const { t } = useTranslation();
  const { pitchMode, setPitchMode } = usePitchMode();

  const onClick = () => setPitchMode(!pitchMode);

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={{ ...S.toggleBtn, ...(pitchMode ? S.toggleBtnActive : null), ...(style || {}) }}
      data-testid="pitch-mode-toggle"
      aria-pressed={pitchMode}
    >
      <span aria-hidden style={{ marginRight: 6 }}>{'\uD83C\uDFA4'}</span>
      {pitchMode
        ? tSafe(t, 'pitch.exit', 'Exit Pitch Mode')
        : tSafe(t, 'pitch.enter', 'Enter Pitch Mode')}
    </button>
  );
}

// ─── Highlight wrapper ──────────────────────────────────────

export function PitchModeHighlight({ stepId, children, style = null }) {
  const { pitchMode, currentStep } = usePitchMode();
  const isActive = pitchMode && currentStep === stepId;

  return (
    <div
      data-pitch-step={stepId}
      style={{
        ...(style || null),
        // Smooth visual transition so an admin can see the
        // highlight slide between sections during a pitch.
        transition: 'box-shadow 220ms ease, border-color 220ms ease',
        borderRadius: 16,
        border: isActive
          ? '2px solid #4CAF50'
          : '2px solid transparent',
        boxShadow: isActive
          ? '0 0 0 4px rgba(76,175,80,0.18), 0 8px 28px rgba(76,175,80,0.25)'
          : 'none',
      }}
    >
      {children}
    </div>
  );
}

// ─── Floating overlay panel ────────────────────────────────

export function PitchModeOverlay() {
  const { t } = useTranslation();
  const {
    pitchMode, currentStep, steps, totalSteps,
    next, prev, goTo, setPitchMode,
  } = usePitchMode();
  if (!pitchMode || totalSteps === 0) return null;

  const step = steps[currentStep] || steps[0];
  const isFirst = currentStep === 0;
  const isLast  = currentStep === totalSteps - 1;

  return (
    <div
      style={S.overlay}
      role="dialog"
      aria-label="Pitch Mode"
      data-testid="pitch-mode-overlay"
    >
      <div style={S.overlayHead}>
        <span style={S.stepBadge}>
          {String(currentStep + 1).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
        </span>
        <button
          type="button"
          onClick={() => setPitchMode(false)}
          style={S.exitX}
          aria-label="Exit Pitch Mode"
          data-testid="pitch-mode-exit"
        >
          {'\u2715'}
        </button>
      </div>

      <h3 style={S.overlayTitle}>
        {tSafe(t, step.titleKey, step.titleEn)}
      </h3>
      <p style={S.overlayBody}>
        {tSafe(t, step.bodyKey, step.bodyEn)}
      </p>

      <div style={S.overlayActions}>
        <button
          type="button"
          onClick={prev}
          disabled={isFirst}
          style={{ ...S.btn, ...(isFirst ? S.btnDisabled : null) }}
          data-testid="pitch-mode-back"
        >
          {tSafe(t, 'pitch.back', 'Back')}
        </button>
        <button
          type="button"
          onClick={isLast ? () => setPitchMode(false) : next}
          style={{ ...S.btn, ...S.btnPrimary }}
          data-testid="pitch-mode-next"
        >
          {isLast
            ? tSafe(t, 'pitch.finish', 'Finish')
            : tSafe(t, 'pitch.next', 'Next')}
        </button>
      </div>

      {/* Step pips — clickable shortcut to any step. */}
      <div style={S.dots}>
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(s.id)}
            style={{
              ...S.dot,
              ...(s.id === currentStep ? S.dotActive : null),
            }}
            aria-label={`Go to step ${s.id + 1}`}
            data-pitch-step-pip={s.id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Inline styles ──────────────────────────────────────────

const S = {
  toggleBtn: {
    display: 'inline-flex', alignItems: 'center',
    padding: '0.4rem 0.875rem', borderRadius: 999,
    border: '1px solid rgba(76,175,80,0.55)',
    background: 'rgba(76,175,80,0.10)',
    color: '#86EFAC', fontSize: '0.8125rem', fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'background 200ms ease, color 200ms ease',
  },
  toggleBtnActive: {
    background: 'rgba(76,175,80,0.25)',
    color: '#22C55E', borderColor: '#22C55E',
  },

  overlay: {
    position: 'fixed', bottom: 20, right: 20,
    background: '#FFFFFF', color: '#0F172A',
    padding: '16px',
    borderRadius: 12,
    boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
    width: 320, maxWidth: 'calc(100vw - 40px)',
    zIndex: 1000,
    display: 'flex', flexDirection: 'column', gap: 10,
    fontFamily: 'inherit',
  },
  overlayHead: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBadge: {
    fontSize: '0.6875rem', fontWeight: 700,
    color: '#16a34a',
    background: 'rgba(76,175,80,0.10)',
    border: '1px solid rgba(76,175,80,0.35)',
    padding: '0.125rem 0.5rem', borderRadius: 999,
    letterSpacing: '0.06em',
  },
  exitX: {
    border: 'none', background: 'transparent',
    fontSize: '1rem', cursor: 'pointer',
    color: '#64748B', padding: '0 0.25rem',
    lineHeight: 1,
  },
  overlayTitle: {
    margin: 0, fontSize: '1rem', fontWeight: 700,
    color: '#0F172A',
  },
  overlayBody: {
    margin: 0, fontSize: '0.875rem',
    color: '#475569', lineHeight: 1.5,
  },
  overlayActions: {
    display: 'flex', gap: 8, marginTop: 4,
  },
  btn: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    borderRadius: 8, border: '1px solid #CBD5E1',
    background: '#F8FAFC', color: '#0F172A',
    fontSize: '0.8125rem', fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#22C55E', color: '#FFFFFF',
    border: '1px solid #22C55E',
  },
  btnDisabled: {
    opacity: 0.5, cursor: 'not-allowed',
  },
  dots: {
    display: 'flex', justifyContent: 'center',
    gap: 6, marginTop: 4,
  },
  dot: {
    width: 8, height: 8, borderRadius: '50%',
    border: 'none',
    background: 'rgba(15,23,42,0.18)',
    cursor: 'pointer',
    padding: 0,
  },
  dotActive: {
    background: '#22C55E',
    boxShadow: '0 0 0 3px rgba(76,175,80,0.18)',
  },
};
