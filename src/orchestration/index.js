/**
 * orchestration — calm coordination layer (May 2026).
 *
 *   import { getNextBestRecommendation, emit, EVENT_TYPE }
 *     from 'src/orchestration';
 *
 *   const rec = getNextBestRecommendation(intelligenceContext);
 *   if (rec) renderHomeCard(rec);   // i18n keys + spec §2 shape
 *
 * MODULE MAP
 *   events/           — typed bus + ring-buffer store
 *   memory.js         — continuity memory (suppress repeat)
 *   orchestrator.js   — single entry: getNextBestRecommendation
 *
 * REUSED LAYERS (not re-exported here — import direct)
 *   intelligence/core/confidence.js          — tier helpers
 *   intelligence/core/farmerInsightAdapter.js — calm-copy filter
 *   intelligence/notifications/notificationTiming.js — quiet hours
 *   intelligence/notifications/notificationDeduplication.js — push cooldowns
 *
 * RULES
 *   • Pure / SSR-safe / never-throws.
 *   • Spec §11 fallback returned on any internal failure.
 *   • Recommendation envelope carries i18n keys, NOT visible
 *     English — page renderer resolves via tSafe.
 *   • Numeric scores + sourceSignals stay INTERNAL. Renderers
 *     show only title / message / action / time estimate.
 */

export { EVENT_TYPE, EVENT_TYPE_SET, EVENT_SOURCE } from './events/eventTypes.js';
export {
  EVENT_STORE_KEY,
  EVENT_STORE_MAX,
  appendEvent,
  getRecentEvents,
  getEventsByType,
  countEventsSince,
  clearEvents,
} from './events/index.js';
export { subscribe, emit, _resetBus } from './events/eventBus.js';

export {
  MEMORY_KEY,
  MEMORY_COOLDOWNS_MS,
  rememberShown,
  wasRecentlyShown,
  lastShown,
  forgetAll,
} from './memory.js';

export {
  getNextBestRecommendation,
  lastEventOfType,
  sanitizeRecommendation,
  FALLBACK_RECOMMENDATION,
} from './orchestrator.js';
