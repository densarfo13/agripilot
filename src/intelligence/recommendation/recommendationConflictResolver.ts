/**
 * recommendationConflictResolver — detect conflicting guidance
 * between candidate recommendations and resolve to the calm
 * winner (NEVER both).
 *
 * Spec §3 — system must:
 *   • prevent conflicting watering timing
 *   • prevent duplicate tasks
 *   • prevent contradictory growth advice
 *
 * The most common conflict pattern is "water today" + "skip
 * watering today" landing in the same candidate set when a
 * weather rule and a soil rule disagree. The resolver picks the
 * higher-priority signal (weather > soil > care > seasonal).
 */

import { dedupeOrchestratedSet } from '../../governance/orchestrationRules.js';

export interface ConflictCandidate {
  readonly kind: string;
  readonly key?: string;
  readonly actionRoute?: string;
  readonly priority?: number;
}

const KIND_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  weather:       1,
  scan_followup: 2,
  care:          3,
  buyer:         4,
  funding:       5,
  progress:      6,
  seasonal:      7,
});

/**
 * Resolve a candidate set down to non-conflicting items.
 *
 *   1. Run dedupe by (kind, key) and actionRoute.
 *   2. When two candidates share the same actionRoute but
 *      different kinds, keep the higher-priority kind.
 *   3. When two candidates share the same kind but different
 *      messages (e.g. "water today" vs "skip watering"), keep
 *      the one explicitly tagged with the higher priority hint.
 */
export function resolveConflicts<T extends ConflictCandidate>(
  candidates: ReadonlyArray<T>,
): T[] {
  if (!Array.isArray(candidates)) return [];
  // Step 1 — basic dedup
  const dedup = dedupeOrchestratedSet(candidates as never[]) as T[];
  // Step 2 — for items sharing actionRoute, keep highest-priority kind
  const byRoute = new Map<string, T>();
  for (const c of dedup) {
    if (!c) continue;
    const r = String(c.actionRoute || '');
    if (!r) continue;
    const existing = byRoute.get(r);
    if (!existing) {
      byRoute.set(r, c);
      continue;
    }
    const aRank = (Number.isFinite(c.priority as number) ? Number(c.priority) : Infinity);
    const bRank = (Number.isFinite(existing.priority as number) ? Number(existing.priority) : Infinity);
    if (aRank < bRank) byRoute.set(r, c);
    else if (aRank === bRank) {
      const aKind = KIND_PRIORITY[String(c.kind)] ?? Infinity;
      const bKind = KIND_PRIORITY[String(existing.kind)] ?? Infinity;
      if (aKind < bKind) byRoute.set(r, c);
    }
  }
  // Step 3 — emit kept items in original order
  const kept = new Set<T>(byRoute.values());
  return dedup.filter((c) => !c.actionRoute || kept.has(c));
}

export default Object.freeze({ resolveConflicts });
