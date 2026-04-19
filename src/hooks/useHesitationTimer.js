/**
 * useHesitationTimer — per-screen hesitation instrumentation that
 * emits a lightweight "hesitation_tick" event when the user dwells
 * on a step longer than a configured threshold without committing.
 *
 * Pairs with useOnboardingFunnel:
 *
 *   const funnel = useOnboardingFunnel(FUNNEL_STEPS.LOCATION, {...});
 *   useHesitationTimer({
 *     step: FUNNEL_STEPS.LOCATION,
 *     thresholdMs: 45_000,
 *     armed: !funnel.completedRef?.current,
 *   });
 *
 * The timer fires AT MOST ONCE per mount, attaches a
 * `meta.dwellMs` to the event, and logs through the same
 * `trackOnboarding` pipeline. Server-side reports will then see
 * real-time "user hesitated on Location for 52s" signals, even if
 * the user eventually completes the step.
 *
 * We intentionally do NOT send a tick after completion — that's
 * what STEP_COMPLETED is for. The goal is to catch hesitation
 * *during* indecision, so product can react while it's still
 * happening (or at least know it happened without having to wait
 * for aggregate dashboards).
 */

import { useEffect, useRef } from 'react';
import useAnalytics from './useAnalytics.js';

const HESITATION_EVENT_TYPE = 'hesitation_tick';

/**
 * @param {object}   p
 * @param {string}   p.step           funnel step id
 * @param {number}   [p.thresholdMs]  when to fire (default 30s)
 * @param {boolean}  [p.armed]        set false to suspend the timer
 *                                    (e.g. after the user completed)
 * @param {object}   [p.defaults]     analytics defaults to forward
 */
export function useHesitationTimer({
  step,
  thresholdMs = 30_000,
  armed = true,
  defaults = {},
} = {}) {
  const { track } = useAnalytics(defaults);
  const startRef  = useRef(null);
  const firedRef  = useRef(false);
  const timerRef  = useRef(null);

  useEffect(() => {
    if (!step || !armed) return () => {};
    if (firedRef.current) return () => {};
    startRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      const dwellMs = Date.now() - (startRef.current || Date.now());
      track(HESITATION_EVENT_TYPE, {
        meta: { step, dwellMs, thresholdMs },
      });
    }, thresholdMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [step, armed, thresholdMs, track]);
}

export default useHesitationTimer;
