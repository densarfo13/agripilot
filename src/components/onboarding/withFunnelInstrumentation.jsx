/**
 * withFunnelInstrumentation — HOC that adds funnel + hesitation
 * instrumentation to any onboarding step component without
 * modifying it. Each wrapped step emits STEP_VIEWED on mount,
 * STEP_ABANDONED on unmount (unless completed), and fires a
 * hesitation_tick if the user lingers past the threshold.
 *
 * The inner step receives three extra props:
 *   • funnelCompleted({ confidence?, meta? }) — call before
 *     navigating forward
 *   • funnelAbandon({ reason?, meta? })       — optional explicit
 *     abandon (usually unmount handles this)
 *   • funnelTrack(type, extras?)              — arbitrary decision
 *     events scoped to this step
 *
 * Usage:
 *   import withFunnelInstrumentation from
 *     '@/components/onboarding/withFunnelInstrumentation';
 *   import { FUNNEL_STEPS } from '@/utils/funnelEventTypes';
 *   export default withFunnelInstrumentation(LocationStep, {
 *     step: FUNNEL_STEPS.LOCATION,
 *     hesitationThresholdMs: 45_000,
 *   });
 *
 * The wrapped component is stable — callers continue to import
 * the same module path they used before.
 */

import { useMemo } from 'react';
import useOnboardingFunnel from '../../hooks/useOnboardingFunnel.js';
import useHesitationTimer  from '../../hooks/useHesitationTimer.js';
import useAnalytics        from '../../hooks/useAnalytics.js';

export default function withFunnelInstrumentation(Component, config = {}) {
  const {
    step,
    hesitationThresholdMs = 30_000,
    analyticsDefaults = {},
  } = config;

  if (!step) {
    throw new Error('withFunnelInstrumentation: step is required');
  }

  function Instrumented(props) {
    const defaults = useMemo(() => ({
      mode:      props.mode,
      language:  props.language,
      country:   props.country,
      stateCode: props.stateCode,
      ...analyticsDefaults,
    }), [props.mode, props.language, props.country, props.stateCode]);

    const { completed, abandon } = useOnboardingFunnel(step, {
      ...defaults,
      meta: { mode: defaults.mode },
    });
    const { track } = useAnalytics(defaults);

    useHesitationTimer({
      step,
      thresholdMs: hesitationThresholdMs,
      armed: true,
      defaults,
    });

    return (
      <Component
        {...props}
        funnelStep={step}
        funnelCompleted={completed}
        funnelAbandon={abandon}
        funnelTrack={track}
      />
    );
  }
  Instrumented.displayName = `Instrumented(${Component.displayName || Component.name || 'Step'})`;
  return Instrumented;
}
