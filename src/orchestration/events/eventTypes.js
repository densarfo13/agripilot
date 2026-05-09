/**
 * eventTypes — frozen catalogue of every coordination event the
 * orchestration layer understands.
 *
 * Spec §1. Pure constants — no imports. The bus + store + tests
 * grep against these strings, so renaming an entry is a breaking
 * change (it would silently drop existing events from listeners).
 *
 * EVENT SHAPE
 *   {
 *     id:         string,   // local-unique
 *     userId:     string|null,
 *     role:       'farmer'|'gardener'|'buyer'|'ngo'|'admin'|null,
 *     mode:       'farm'|'garden'|null,
 *     farmId:     string|null,
 *     cropSlug:   string|null,
 *     region:     string|null,
 *     type:       one of EVENT_TYPE.*
 *     timestamp:  ISO8601
 *     source:     string,   // module that emitted (e.g. 'scan')
 *     payload:    object,   // small flat — no nested PII
 *     confidence: 'low'|'medium'|'high'|null
 *   }
 */

export const EVENT_TYPE = Object.freeze({
  WEATHER_CHANGED:          'weather_changed',
  TASK_GENERATED:           'task_generated',
  TASK_COMPLETED:           'task_completed',
  TASK_SKIPPED:             'task_skipped',
  SCAN_COMPLETED:           'scan_completed',
  SOIL_CHECK_COMPLETED:     'soil_check_completed',
  CROP_STAGE_CHANGED:       'crop_stage_changed',
  PROGRESS_UPDATED:         'progress_updated',
  PRODUCE_LISTED:           'produce_listed',
  BUYER_INTEREST_RECEIVED:  'buyer_interest_received',
  FUNDING_MATCH_FOUND:      'funding_match_found',
  NOTIFICATION_SENT:        'notification_sent',
  SUPPORT_REQUESTED:        'support_requested',
  // ─── May 2026 Sell marketplace coordination upgrade ──────────
  // Spec §1 mandates a richer buyer-event vocabulary so the
  // marketplace coordinator can track the full inquiry → reserve
  // → confirm lifecycle. PRODUCE_LISTED + BUYER_INTEREST_RECEIVED
  // (above) cover the entry points; the events below cover
  // every meaningful interaction afterwards. Keep names + values
  // aligned with the LISTING_STATUS state machine in
  // src/market/marketStore.js.
  PRODUCE_VIEWED:           'produce_viewed',
  INQUIRY_SENT:             'inquiry_sent',
  QUANTITY_REQUESTED:       'quantity_requested',
  NEGOTIATION_STARTED:      'negotiation_started',
  MEETING_REQUESTED:        'meeting_requested',
  LISTING_RESERVED:         'listing_reserved',
  PURCHASE_CONFIRMED:       'purchase_confirmed',
});

// Allow-list for runtime validation. Unknown event types are
// rejected at the eventStore boundary so a typo can't bloat the
// ring buffer with invalid records.
export const EVENT_TYPE_SET = Object.freeze(new Set(Object.values(EVENT_TYPE)));

// Source tag suggestions — not enforced (callers can supply any
// short string), but components should pick from this list when
// they can so dashboards can group consistently.
export const EVENT_SOURCE = Object.freeze({
  SCAN:         'scan',
  SOIL:         'soil',
  WEATHER:      'weather',
  TASKS:        'tasks',
  PROGRESS:     'progress',
  SELL:         'sell',
  BUYER:        'buyer',
  FUNDING:      'funding',
  NOTIFICATIONS:'notifications',
  SUPPORT:      'support',
  ORCHESTRATOR: 'orchestrator',
});

const _module = { EVENT_TYPE, EVENT_TYPE_SET, EVENT_SOURCE };
export default _module;
