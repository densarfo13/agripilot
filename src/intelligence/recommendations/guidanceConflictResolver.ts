/**
 * guidanceConflictResolver — detect contradictions in a candidate
 * set and resolve to ONE clean primary recommendation (spec §9).
 *
 *   Examples the spec calls out:
 *     • "water now" vs "skip watering"      — water rules
 *     • "scan again" right after scan       — scan-after-scan
 *     • "list produce" before harvest-ready — premature sell
 *     • "funding support" over urgent       — funding-over-safety
 *     • Garden + marketplace                — handled by mode adapter
 */

export type ResolveKind =
  | 'water' | 'skip_water'
  | 'scan_followup' | 'scan_completed'
  | 'harvest_sell' | 'pre_harvest'
  | 'funding' | 'weather' | 'safety';

export interface ResolverItem {
  readonly kind: string;
  readonly key?: string;
  readonly priority?: number;
  readonly actionRoute?: string;
}

// Pairs that must NEVER co-surface. First wins when both present.
const CONFLICT_PAIRS: ReadonlyArray<[string, string]> = Object.freeze([
  ['skip_water',      'water'],            // weather override beats care suggestion
  ['weather',         'funding'],          // urgent weather beats funding nudge
  ['safety',          'funding'],
  ['weather',         'buyer'],
  ['safety',          'buyer'],
  ['scan_completed',  'scan_followup'],    // a completed scan moots the follow-up
  ['pre_harvest',     'harvest_sell'],     // don't push sell before stage is ready
]);

const KIND_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
  safety:        1,
  weather:       1,
  skip_water:    1,
  scan_completed: 2,
  pre_harvest:   2,
  scan_followup: 3,
  water:         3,
  care:          3,
  soil_followup: 4,
  task:          4,
  harvest_sell:  5,
  buyer:         6,
  funding:       7,
  progress:      8,
  journal:       8,
  seasonal:      8,
});

function _rank(kind: string): number {
  return KIND_PRIORITY[String(kind)] ?? Infinity;
}

/**
 * Resolve a candidate set down to non-conflicting items.
 *
 *   1. For every conflict pair, drop the loser when both present.
 *   2. For items sharing actionRoute, keep highest-priority kind.
 *   3. For items sharing (kind, key), keep the first occurrence.
 *
 * Pure / never throws.
 */
export function resolveConflicts<T extends ResolverItem>(
  candidates: ReadonlyArray<T>,
): T[] {
  if (!Array.isArray(candidates)) return [];
  const kindSet = new Set(candidates.map((c) => String(c?.kind || '')));
  const dropped = new Set<string>();
  for (const [winner, loser] of CONFLICT_PAIRS) {
    if (kindSet.has(winner) && kindSet.has(loser)) dropped.add(loser);
  }

  // Step 2 — keep highest-priority kind per actionRoute.
  const byRoute = new Map<string, T>();
  const noRoute: T[] = [];
  const seenKindKey = new Set<string>();

  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    if (dropped.has(String(c.kind))) continue;
    const kindKey = `${c.kind || ''}::${c.key || ''}`;
    if (seenKindKey.has(kindKey)) continue;
    seenKindKey.add(kindKey);
    const route = String(c.actionRoute || '');
    if (!route) { noRoute.push(c); continue; }
    const existing = byRoute.get(route);
    if (!existing) {
      byRoute.set(route, c);
    } else {
      const aRank = _rank(String(c.kind));
      const bRank = _rank(String(existing.kind));
      if (aRank < bRank) byRoute.set(route, c);
    }
  }
  // Step 3 — re-emit in original order, only kept items.
  const kept = new Set<T>([...byRoute.values(), ...noRoute]);
  return candidates.filter((c) => kept.has(c));
}

/**
 * Convenience — return the SINGLE winning recommendation after
 * resolving conflicts. Picks the highest-priority kind from the
 * resolved set; null when the set is empty.
 */
export function pickWinner<T extends ResolverItem>(
  candidates: ReadonlyArray<T>,
): T | null {
  const resolved = resolveConflicts(candidates);
  if (resolved.length === 0) return null;
  return [...resolved].sort((a, b) => _rank(a.kind) - _rank(b.kind))[0];
}

export default Object.freeze({
  resolveConflicts,
  pickWinner,
  CONFLICT_PAIRS,
});
