/**
 * farmerState/index.js — single import surface.
 *
 *   import {
 *     resolveFarmerState, buildHomeExperience,
 *     STATE_TYPES, STATE_PRIORITY,
 *   } from '@/utils/farmerState';
 */

export { resolveFarmerState, buildHomeExperience } from './stateEngine.js';
export { STATE_TYPES, STATE_PRIORITY, pickByPriority, getStatePriorityIndex } from './statePriority.js';
export { classifyStateCandidates } from './classifyStateCandidates.js';
export { scoreStateConfidence } from './stateConfidence.js';
export { validateResolvedState } from './stateValidation.js';
export { resolveDisplayMode } from './stateDisplayMode.js';
export { appendNextStepBridge } from './nextStepBridge.js';
export { applyStateToneByRegion, resolveRegionBucket } from './stateTone.js';
export { getStateWording, STATE_WORDING } from './stateWording.js';
export { runDevAssertions } from './devAssertions.js';
