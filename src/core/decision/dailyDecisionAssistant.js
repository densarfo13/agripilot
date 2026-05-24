/**
 * dailyDecisionAssistant.js — spec-named alias at src/core/decision/.
 *
 *   import { computeDailyDecision, EXPERIENCE_LEVEL, CONFIDENCE_TONE }
 *     from 'src/core/decision/dailyDecisionAssistant.js';
 *
 * What it is
 * ──────────
 *   A re-export of the existing daily decision assistant
 *   implementation in `src/core/lifecycle/`. The original lives
 *   under lifecycle/ because the engine composes lifecycle stage
 *   tasks heavily; the spec names it at `src/core/decision/` so
 *   surfaces using the spec wording have a stable import path.
 *
 *   ONE implementation, two paths — no duplicate state, no
 *   duplicate logic. The previously-shipped tests continue to
 *   verify behaviour through the original path.
 *
 * Strict-rule audit
 *   • Pure facade. Never throws.
 */

export {
  computeDailyDecision,
  EXPERIENCE_LEVEL,
  CONFIDENCE_TONE,
} from '../lifecycle/dailyDecisionAssistant.js';

import _impl from '../lifecycle/dailyDecisionAssistant.js';
export default _impl;
