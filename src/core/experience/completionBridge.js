/**
 * completionBridge.js — §6. Replace the dead-end "All done
 * for now" with a composed completion payload that always
 * includes a forward-looking next-step hint.
 *
 * Emits LocalizedPayload structures ONLY — the UI renders
 * them through the shared renderer.
 *
 *   buildCompletionBridge(input)
 *     input:  { farmStage, cropStage, allDoneReason?, missedDays?,
 *               nowDate?, seasonalTransition? }
 *     output: {
 *       title:        LocalizedPayload   // "All done for now"
 *       encouragement:LocalizedPayload   // "Great work!"
 *       next:         LocalizedPayload | null  // "Next: check tomorrow's task"
 *       severity:     'positive'
 *     }
 *
 * Pure. No React. No network. No i18n — it only emits keys.
 */

import { makeLocalizedPayload } from '../i18n/localizedPayload.js';

/** Seasonal cycle → transition key. Kept tiny and explicit. */
const SEASONAL_NEXT = Object.freeze({
  post_harvest:      'completion.next.prepare_next_cycle',
  harvest:           'completion.next.post_harvest_steps',
  planting:          'completion.next.monitor_germination',
  vegetative:        'completion.next.watch_pests',
  flowering:         'completion.next.ensure_pollination',
  fruiting:          'completion.next.plan_harvest',
  germination:       'completion.next.thin_seedlings',
  land_preparation:  'completion.next.start_planting_soon',
  planning:          'completion.next.complete_plan',
});

/** Universal default next-step when we have no stage signal. */
const DEFAULT_NEXT_KEY = 'completion.next.check_tomorrow';

/**
 * buildCompletionBridge — compose the three payloads.
 */
export function buildCompletionBridge(input = {}) {
  const {
    cropStage, allDoneReason, missedDays = 0, seasonalTransition = false,
  } = input || {};

  const title = makeLocalizedPayload(
    'completion.title.all_done_for_now',
    {},
    { severity: 'positive', fallback: 'All done for now' },
  );

  // Encouragement adapts to the "reason" — if they came back
  // after missed days, acknowledge that instead of "great work".
  let encouragementKey = 'completion.encouragement.great_work';
  if (allDoneReason === 'returning_inactive' || missedDays >= 3) {
    encouragementKey = 'completion.encouragement.back_on_track';
  } else if (allDoneReason === 'harvest_complete') {
    encouragementKey = 'completion.encouragement.harvest_done';
  }
  const encouragement = makeLocalizedPayload(
    encouragementKey, {},
    { severity: 'positive', fallback: 'Great work!' },
  );

  // Next-step bridge. Prefers seasonal transition, then crop-stage,
  // then a universal default so there's always SOMETHING actionable.
  let nextKey = null;
  if (seasonalTransition) {
    nextKey = 'completion.next.prepare_next_cycle';
  } else if (cropStage && SEASONAL_NEXT[cropStage]) {
    nextKey = SEASONAL_NEXT[cropStage];
  } else {
    nextKey = DEFAULT_NEXT_KEY;
  }
  const next = makeLocalizedPayload(
    nextKey, { cropStage: cropStage || null },
    { severity: 'neutral', fallback: 'Next: check tomorrow\u2019s task' },
  );

  return Object.freeze({ title, encouragement, next, severity: 'positive' });
}

/**
 * hasCompletionBridgeNext — predicate for §6 / dev assertions.
 * True when the bridge is actually forward-looking rather than
 * a dead-end.
 */
export function hasCompletionBridgeNext(bridge) {
  if (!bridge || typeof bridge !== 'object') return false;
  return !!(bridge.next && bridge.next.key);
}

export const _internal = { SEASONAL_NEXT, DEFAULT_NEXT_KEY };
