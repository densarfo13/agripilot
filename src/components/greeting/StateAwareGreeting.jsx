/**
 * StateAwareGreeting — thin wrapper that binds the farmer state
 * engine to the existing DynamicGreeting presentation.
 *
 *   <StateAwareGreeting
 *     context={{ ...resolveFarmerState inputs }}
 *     t={t}
 *     cropLabel={getCropDisplayName(crop, language)}
 *   />
 *
 * Under the hood it:
 *   1. runs resolveFarmerState(context)
 *   2. maps the winning stateType → DynamicGreeting state
 *   3. forwards title / subtitle through the i18n keys the state
 *      engine emitted, so the greeting matches the same wording
 *      the Home card uses
 *
 * This keeps greeting/header from making independent decisions —
 * the greeting is now a view onto the farmer state engine, not a
 * separate rule system.
 */

import { useMemo } from 'react';
import DynamicGreeting from './DynamicGreeting.jsx';
import { resolveFarmerState, STATE_TYPES } from '../../utils/farmerState/index.js';

// Map farmer-state → DynamicGreeting state input so the greeting
// layer stays simple and we don't grow a second state table.
const STATE_TO_GREETING = Object.freeze({
  [STATE_TYPES.HARVEST_COMPLETE]:   { hasJustCompletedHarvest: true },
  [STATE_TYPES.POST_HARVEST]:       { hasJustCompletedHarvest: true },
  [STATE_TYPES.FIELD_RESET]:        { hasCatchUpState: true }, // "finish what you started"
  [STATE_TYPES.RETURNING_INACTIVE]: { hasCatchUpState: true },
  [STATE_TYPES.STALE_OFFLINE]:      { hasCatchUpState: true },
  [STATE_TYPES.FIRST_USE]:          { hasCompletedOnboarding: false, hasActiveCropCycle: false },
  [STATE_TYPES.ACTIVE_CYCLE]:       { hasCompletedOnboarding: true, hasActiveCropCycle: true, todayState: 'active' },
  [STATE_TYPES.OFF_SEASON]:         {},
  [STATE_TYPES.BLOCKED_BY_LAND]:    { hasCompletedOnboarding: true, hasActiveCropCycle: true, todayState: 'active' },
  [STATE_TYPES.WEATHER_SENSITIVE]:  { hasCompletedOnboarding: true, hasActiveCropCycle: true, todayState: 'active' },
  [STATE_TYPES.CAMERA_ISSUE]:       { hasCompletedOnboarding: true, hasActiveCropCycle: true, todayState: 'active' },
  [STATE_TYPES.SAFE_FALLBACK]:      {},
});

export default function StateAwareGreeting({
  context = {},
  t = null,
  cropLabel = '',
  className = '',
} = {}) {
  const farmerState = useMemo(() => resolveFarmerState(context || {}), [context]);

  const greetingInput = useMemo(() => {
    const base = STATE_TO_GREETING[farmerState.stateType] || {};
    return {
      ...base,
      missedDays: Number(context?.missedDays) || 0,
      cropLabel,
      // Also pass hasCompletedOnboarding/hasActiveCropCycle from
      // caller context as a safety net — some states don't pin them.
      hasCompletedOnboarding: base.hasCompletedOnboarding ?? !!context?.hasCompletedOnboarding,
      hasActiveCropCycle:     base.hasActiveCropCycle     ?? !!context?.hasActiveCropCycle,
    };
  }, [farmerState.stateType, context, cropLabel]);

  return (
    <DynamicGreeting
      input={greetingInput}
      t={t}
      className={`state-aware-greeting state-aware-greeting--${farmerState.stateType} ${className}`.trim()}
    />
  );
}
