/**
 * recommendationMemory — wraps the canonical memory store at
 * `src/orchestration/memory.js`.
 *
 * The store remembers which (kind, key) was last surfaced so the
 * orchestrator can suppress duplicates across reloads. This module
 * is a typed shim — single source of truth lives in memory.js.
 */

import {
  rememberShown   as _rememberShown,
  wasRecentlyShown as _wasRecentlyShown,
  forgetAll        as _forgetAll,
} from '../../orchestration/memory.js';

export type RecommendationMemoryKind =
  | 'weather' | 'scan_followup' | 'care' | 'buyer'
  | 'funding' | 'progress' | 'seasonal';

/**
 * Stamp that a recommendation kind+key was just shown.
 * Idempotent within the same millisecond.
 */
export function rememberShown(kind: string, key = '', now: number = Date.now()): void {
  try { _rememberShown(kind as never, key, now); } catch { /* swallow */ }
}

/**
 * True when the same (kind, key) is still inside its cooldown
 * window. Defaults are governed by orchestrationRules.
 */
export function wasRecentlyShown(kind: string, key = '', now: number = Date.now()): boolean {
  try { return !!_wasRecentlyShown(kind as never, key, now); }
  catch { return false; }
}

/**
 * Drop every stamped recommendation. Used in tests + by the
 * sign-out cleanup pipeline.
 */
export function forgetAll(): void {
  try { _forgetAll(); } catch { /* swallow */ }
}

export default Object.freeze({ rememberShown, wasRecentlyShown, forgetAll });
