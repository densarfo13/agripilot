/**
 * dailyDecisionEngine.js — spec-named alias at
 * `src/core/intelligence/`.
 *
 *   import { computeTodayTop3, computeDailyDecision,
 *            computeDailyDecisionForCurrentUser,
 *            EXPERIENCE_LEVEL, CONFIDENCE_TONE }
 *     from 'src/core/intelligence/dailyDecisionEngine.js';
 *
 * What it is
 * ──────────
 *   Re-exports the existing implementations at the spec-named
 *   import path. One function set, three import paths:
 *     • lifecycle/dailyDecisionAssistant.js (original)
 *     • decision/dailyDecisionAssistant.js (earlier alias)
 *     • intelligence/dailyDecisionEngine.js (this alias)
 *
 *   No duplicate state, no duplicate logic — just stable import
 *   paths for surfaces using the spec wording.
 *
 * Strict-rule audit
 *   • Pure facade. Never throws.
 */

export {
  computeDailyDecision,
  computeDailyDecisionForCurrentUser,
  EXPERIENCE_LEVEL,
  CONFIDENCE_TONE,
} from '../lifecycle/dailyDecisionAssistant.js';

export { computeTodayTop3 } from '../decision/top3PrioritiesComposer.js';

import _impl from '../lifecycle/dailyDecisionAssistant.js';
export default _impl;
