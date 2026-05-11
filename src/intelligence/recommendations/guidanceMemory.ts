/**
 * guidanceMemory — wraps the canonical memory store at
 * src/orchestration/memory.js. The store remembers which
 * (kind, key) was last surfaced so the orchestrator can suppress
 * duplicates across reloads.
 *
 * Spec §6 — store lastRecommendationId / lastShownAt /
 * lastContextHash so the same recommendation never re-fires in
 * the same context.
 */

import {
  rememberShown   as _rememberShown,
  wasRecentlyShown as _wasRecentlyShown,
  forgetAll        as _forgetAll,
} from '../../orchestration/memory.js';

export type GuidanceKind =
  | 'weather' | 'scan_followup' | 'soil_followup' | 'care'
  | 'buyer' | 'funding' | 'progress' | 'seasonal' | 'journal';

/**
 * Stamp that a guidance kind+key was just shown. The (kind, key)
 * pair becomes the dedup signature; the orchestrator's memory
 * store handles the actual ms-precision timestamps.
 */
export function rememberShown(kind: string, key = '', now: number = Date.now()): void {
  try { _rememberShown(kind as never, key, now); } catch { /* swallow */ }
}

/**
 * True when the same (kind, key) is still inside its cooldown
 * window — see guidanceCooldown.ts for the per-kind windows.
 */
export function wasRecentlyShown(kind: string, key = '', now: number = Date.now()): boolean {
  try { return !!_wasRecentlyShown(kind as never, key, now); }
  catch { return false; }
}

/**
 * Drop every stamped guidance. Used in tests + by the sign-out
 * cleanup pipeline.
 */
export function forgetAll(): void {
  try { _forgetAll(); } catch { /* swallow */ }
}

export default Object.freeze({ rememberShown, wasRecentlyShown, forgetAll });
