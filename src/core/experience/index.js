/**
 * src/core/experience/index.js — single import surface for
 * the integration-gap closing helpers.
 */

export {
  buildCompletionBridge,
  hasCompletionBridgeNext,
} from './completionBridge.js';

export {
  persistStructuredOnly,
  readStructured,
  shouldRehydrateOnLocaleChange,
} from './localeSafeCache.js';

export {
  buildFeedbackEvent,
  isValidReason,
} from './feedbackEvent.js';
