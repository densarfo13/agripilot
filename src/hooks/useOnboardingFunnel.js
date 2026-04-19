/**
 * useOnboardingFunnel — drop-in instrumentation for each
 * onboarding screen. Wire-up is one line per step:
 *
 *   const funnel = useOnboardingFunnel(FUNNEL_STEPS.LOCATION, {
 *     mode, language, country,
 *   });
 *   // funnel.viewed() is called automatically on mount.
 *   // call funnel.completed({ meta }) before navigating forward.
 *   // if the user exits the screen without completing, the hook
 *   // fires "abandoned" on unmount.
 *
 * Design notes:
 *   • We track whether the step was completed in a ref so the
 *     unmount cleanup can decide between ABANDONED and nothing.
 *   • We deliberately DON'T fire COMPLETED automatically from
 *     unmount — completion is a product decision, not a React one.
 *   • The hook is idempotent per-mount; rapid re-renders don't
 *     re-emit viewed/completed events.
 */

import { useEffect, useRef, useCallback } from 'react';
import useAnalytics from './useAnalytics.js';
import {
  FUNNEL_EVENT_TYPES,
  getNextFunnelStep,
} from '../utils/funnelEventTypes.js';

export function useOnboardingFunnel(step, defaults = {}) {
  const { trackOnboarding } = useAnalytics(defaults);
  const viewedRef    = useRef(false);
  const completedRef = useRef(false);
  const lastMetaRef  = useRef({});

  useEffect(() => {
    if (!step || viewedRef.current) return;
    viewedRef.current = true;
    trackOnboarding(FUNNEL_EVENT_TYPES.STEP_VIEWED, {
      meta: { step, ...(defaults.meta || {}) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    return () => {
      if (!step) return;
      if (viewedRef.current && !completedRef.current) {
        trackOnboarding(FUNNEL_EVENT_TYPES.STEP_ABANDONED, {
          meta: { step, ...(lastMetaRef.current || {}) },
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const completed = useCallback((extras = {}) => {
    if (!step || completedRef.current) return;
    completedRef.current = true;
    lastMetaRef.current = extras.meta || {};
    trackOnboarding(FUNNEL_EVENT_TYPES.STEP_COMPLETED, {
      confidence: extras.confidence,
      meta: { step, nextStep: getNextFunnelStep(step), ...(extras.meta || {}) },
    });
  }, [step, trackOnboarding]);

  const abandon = useCallback((extras = {}) => {
    if (!step) return;
    if (completedRef.current) return;
    trackOnboarding(FUNNEL_EVENT_TYPES.STEP_ABANDONED, {
      meta: { step, reason: extras.reason || 'manual_abandon', ...(extras.meta || {}) },
    });
  }, [step, trackOnboarding]);

  return { completed, abandon };
}

export default useOnboardingFunnel;
