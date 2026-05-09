/**
 * orchestration/events — typed event bus + ring-buffer store.
 *
 *   import { emit, subscribe, EVENT_TYPE, getRecentEvents }
 *     from 'src/orchestration/events';
 */

export { EVENT_TYPE, EVENT_TYPE_SET, EVENT_SOURCE } from './eventTypes.js';
export {
  STORAGE_KEY as EVENT_STORE_KEY,
  MAX_EVENTS  as EVENT_STORE_MAX,
  appendEvent,
  getRecentEvents,
  getEventsByType,
  countEventsSince,
  clearEvents,
} from './eventStore.js';
export { subscribe, emit, _resetBus } from './eventBus.js';
