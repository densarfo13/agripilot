/**
 * pipelinePriority.js — canonical execution-order numbers for
 * every stage in the decision pipeline. Kept separate so tests
 * and debug views can import it without pulling in the whole
 * pipeline runner.
 *
 * Lower number = runs earlier = harder constraint.
 */

export const PIPELINE_PRIORITY = Object.freeze({
  HARD_GUARDRAILS:    10,   // agronomic safety — LOCKS downstream
  MODE_RESTRICTIONS:  20,   // backyard/farm, support tier — LOCKS downstream
  BASE_LOGIC:         30,   // existing engines produce base output
  OPTIMIZATION:       40,   // bias, scoring tweaks
  ARBITRATION:        50,   // conflict resolution + confidence
  WORDING:            60,   // i18n key selection
  ANALYTICS:          70,   // dev logging / snapshot only
});

export const PIPELINE_STAGE_ORDER = Object.freeze([
  'guardrails',
  'mode_restrictions',
  'base_logic',
  'optimization',
  'arbitration',
  'wording',
  'analytics',
]);

export function stagePriority(name) {
  switch (name) {
    case 'guardrails':        return PIPELINE_PRIORITY.HARD_GUARDRAILS;
    case 'mode_restrictions': return PIPELINE_PRIORITY.MODE_RESTRICTIONS;
    case 'base_logic':        return PIPELINE_PRIORITY.BASE_LOGIC;
    case 'optimization':      return PIPELINE_PRIORITY.OPTIMIZATION;
    case 'arbitration':       return PIPELINE_PRIORITY.ARBITRATION;
    case 'wording':           return PIPELINE_PRIORITY.WORDING;
    case 'analytics':         return PIPELINE_PRIORITY.ANALYTICS;
    default:                  return 999;
  }
}
