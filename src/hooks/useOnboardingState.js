/**
 * useOnboardingState — owns the onboarding state machine on the
 * client. Hydrates from localStorage on mount, auto-saves on
 * every change, exposes the pure flow-controller helpers as
 * imperative methods.
 *
 *   const {
 *     state, step, mode,
 *     patch, next, back, goTo,
 *     canAdvance, reset,
 *   } = useOnboardingState({ initialLanguage: 'en' });
 *
 * Notes:
 *   • `patch(partial)` merges into the state using
 *     patchOnboardingState (deep-merges `location` / `sizeDetails`).
 *   • `next()` uses validation before advancing — returns the
 *     new step, or null if validation failed.
 *   • `back()` moves to the previous step, never past welcome.
 *   • `goTo(step)` only jumps forward if the target step is already
 *     passing validation (prevents skipping required answers).
 *   • `reset()` wipes the persisted state and returns to welcome.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultOnboardingState, loadOnboardingState, saveOnboardingState,
  clearOnboardingState, patchOnboardingState,
} from '../utils/onboardingV2/onboardingPersistence.js';
import {
  getNextOnboardingStep, getPrevOnboardingStep, canAdvanceFromStep,
  resumeOnboardingStep, deriveMode,
} from '../utils/onboardingV2/getNextOnboardingStep.js';
import { validateOnboardingStep } from '../utils/onboardingV2/validateOnboardingStep.js';
import {
  ONBOARDING_STEPS, isValidStep, STEP_ORDER,
} from '../utils/onboardingV2/stepIds.js';

export function useOnboardingState({ initialLanguage = 'en' } = {}) {
  const [state, setState] = useState(() => {
    const persisted = loadOnboardingState();
    if (persisted) {
      // Resume on the step the user should actually see.
      const resume = resumeOnboardingStep(persisted);
      return { ...persisted, currentStep: resume };
    }
    return defaultOnboardingState(initialLanguage);
  });

  const firstRender = useRef(true);
  useEffect(() => {
    // Skip the very first effect run — we already initialized
    // from storage. After that, every state change persists.
    if (firstRender.current) { firstRender.current = false; return; }
    saveOnboardingState(state);
  }, [state]);

  const patch = useCallback((partial) => {
    setState((prev) => {
      const next = patchOnboardingState(prev, partial || {});
      // Derive `mode` whenever growingType changes — single
      // source of truth for mode.
      if ('growingType' in (partial || {})) {
        next.mode = deriveMode(next.growingType);
      }
      return next;
    });
  }, []);

  const next = useCallback(() => {
    let advanced = null;
    setState((prev) => {
      const nx = getNextOnboardingStep(prev);
      if (!nx || nx === prev.currentStep) return prev; // validation failed or terminal
      advanced = nx;
      if (nx === ONBOARDING_STEPS.FIRST_VALUE) {
        return { ...prev, currentStep: nx, completedAt: Date.now() };
      }
      return { ...prev, currentStep: nx };
    });
    return advanced;
  }, []);

  const back = useCallback(() => {
    let moved = null;
    setState((prev) => {
      const pv = getPrevOnboardingStep(prev);
      if (!pv) return prev;
      moved = pv;
      return { ...prev, currentStep: pv };
    });
    return moved;
  }, []);

  const goTo = useCallback((target) => {
    if (!isValidStep(target)) return null;
    let moved = null;
    setState((prev) => {
      // Forward jumps only allowed if everything between is valid.
      const currIdx = STEP_ORDER.indexOf(prev.currentStep);
      const nextIdx = STEP_ORDER.indexOf(target);
      if (nextIdx > currIdx) {
        for (let i = currIdx; i < nextIdx; i++) {
          if (!validateOnboardingStep(STEP_ORDER[i], prev).ok) return prev;
        }
      }
      moved = target;
      return { ...prev, currentStep: target };
    });
    return moved;
  }, []);

  const reset = useCallback(() => {
    clearOnboardingState();
    setState(defaultOnboardingState(initialLanguage));
  }, [initialLanguage]);

  const canAdvance = useMemo(
    () => canAdvanceFromStep(state, state.currentStep),
    [state],
  );

  const mode = useMemo(() => state.mode || deriveMode(state.growingType), [state]);

  return { state, step: state.currentStep, mode, patch, next, back, goTo, canAdvance, reset };
}

export default useOnboardingState;
