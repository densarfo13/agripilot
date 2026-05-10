/**
 * adaptation — feature-flag-gated foundation for the quiet
 * learning layer (adaptive timing / behavioural learning /
 * environmental memory / recommendation learning / user-rhythm
 * learning / region-behaviour learning).
 *
 *   Feature flag: enableAiAdapter (default OFF)
 *
 * Behaviour
 *   • Flag OFF: every function returns the identity / null /
 *     empty value. The orchestrator + recommendation engine
 *     ignore the adaptation layer entirely.
 *   • Flag ON: the layer reads from the existing eventStore +
 *     userMemory to bias the orchestrator's ranking. Real
 *     learning models arrive when feature work happens.
 *
 * Output contract (spec §6 + §11)
 *   Adaptation is SILENT — no user-visible badges, no "you
 *   prefer X" surfaces. The orchestrator silently improves
 *   over time; the user just notices that timing is calmer
 *   and recommendations feel more personal.
 */

import { isFeatureEnabled } from '../../config/features.js';

const FLAG = 'enableAiAdapter';

export type Slot = 'morning' | 'afternoon' | 'evening';

export interface AdaptiveSignal {
  readonly weight: number;        // 0..1 — internal weighting hint
  readonly preferredSlot?: Slot;  // calm time-of-day preference
  readonly note?: string;         // internal-only diagnostic
}

const NEUTRAL: AdaptiveSignal = Object.freeze({ weight: 0 });

export function isAdaptationEnabled(): boolean {
  try { return !!isFeatureEnabled(FLAG); } catch { return false; }
}

/**
 * Returns a small adaptive bias for the given context.
 * NEUTRAL when the layer is disabled. Pure / never throws.
 */
export function getAdaptiveBias(_ctx: unknown): AdaptiveSignal {
  if (!isAdaptationEnabled()) return NEUTRAL;
  // Concrete learning logic (slot-preference inference, ignored-
  // recommendation suppression, successful-intervention boost)
  // wires here. Today: returns neutral so the rule-based path
  // remains deterministic.
  return NEUTRAL;
}

/**
 * Hint for the orchestrator's recommendation-timing layer.
 * Returns the user's preferred slot (morning/afternoon/evening)
 * when the adaptation layer is enabled AND has enough samples;
 * null otherwise.
 */
export function preferredSlot(_ctx: unknown): Slot | null {
  if (!isAdaptationEnabled()) return null;
  return null;
}

/**
 * Mark a recommendation as ignored. Today a no-op; when the
 * adaptation layer is enabled this stamps the eventStore so the
 * orchestrator can deprioritise the same kind+key on next pass.
 */
export function recordIgnoredRecommendation(_kind: string, _key?: string): void {
  if (!isAdaptationEnabled()) return;
  // Future: append to farroway_event_log_v1.
}

/**
 * Mark a recommendation as completed. Today a no-op; future
 * implementations boost similar suggestions next cycle.
 */
export function recordCompletedRecommendation(_kind: string, _key?: string): void {
  if (!isAdaptationEnabled()) return;
}

export default Object.freeze({
  isAdaptationEnabled,
  getAdaptiveBias,
  preferredSlot,
  recordIgnoredRecommendation,
  recordCompletedRecommendation,
});
