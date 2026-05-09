/**
 * intelligence/funding — regional funding intelligence (May 2026
 * upgrade).
 *
 *   import { prioritiseNearbySupport, SUPPORT_CATEGORY }
 *     from 'src/intelligence/funding';
 *
 * MODULES
 *   supportCategories.js  — 12-category canonical taxonomy
 *   regionalRelevance.js  — context-aware booster + ranking
 *
 * RULES
 *   • Pure / SSR-safe / never-throws.
 *   • Verified-only — every URL passes through `classifyFundingUrl`
 *     (defence-in-depth on top of the orchestrator's gate).
 *   • Threshold to surface: composite score ≥ 60.
 *   • No farmer-facing scores ever leak — adapter strips before render.
 */

export {
  SUPPORT_CATEGORY,
  SUPPORT_CATEGORY_LIST,
  normaliseCategory,
  CATEGORY_LABEL,
  categoryLabel,
} from './supportCategories.js';

export {
  detectContextSignals,
  scoreSupportRelevance,
  prioritiseNearbySupport,
  _internal as REGIONAL_RELEVANCE_INTERNAL,
} from './regionalRelevance.js';
