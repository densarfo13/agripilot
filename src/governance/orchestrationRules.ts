/**
 * orchestrationRules — governance for the cross-system
 * coordination layer (weather × scan × care × notification ×
 * memory × seasonal).
 *
 * Spec §8: prevent conflicting guidance, no duplicate
 * recommendations, no contradictory tasks.
 *
 * Strict-rule audit
 *   • Pure data + thin helpers. Frozen.
 *   • Memory cooldowns are owned by `src/orchestration/memory.js`.
 *     This file documents the contract those cooldowns must
 *     satisfy and exposes a deduplication helper the audit can
 *     use to check engine output.
 */

const HOUR = 60 * 60 * 1000;

export type RecommendationKind =
  | 'weather'
  | 'scan_followup'
  | 'care'
  | 'buyer'
  | 'funding'
  | 'progress'
  | 'seasonal';

// Cooldown table — minimum time before the same recommendation
// kind is allowed to surface again. Mirror of the contract in
// `src/orchestration/memory.js`; kept here so any new caller can
// reach the spec without coupling to memory.js's storage shape.
//
// Values in milliseconds.
export const RECOMMENDATION_COOLDOWNS: Readonly<Record<RecommendationKind, number>> = Object.freeze({
  weather:       4  * HOUR,
  scan_followup: 12 * HOUR,
  care:          6  * HOUR,
  buyer:         6  * HOUR,
  funding:       24 * HOUR,
  progress:      24 * HOUR,
  seasonal:      24 * HOUR,
});

export interface OrchestratedItem {
  readonly kind: string;
  readonly key?: string;
  readonly actionRoute?: string;
}

/**
 * Deduplicate a candidate set by (kind+key) and (actionRoute).
 * Returns the trimmed list — first occurrence wins. The orchestrator
 * already produces a single primary tile, so this is a defence-in-
 * depth check used by the audit to verify engine output.
 */
export function dedupeOrchestratedSet(items: ReadonlyArray<OrchestratedItem> | null | undefined): OrchestratedItem[] {
  if (!Array.isArray(items)) return [];
  const seenKindKey = new Set<string>();
  const seenRoute   = new Set<string>();
  const out: OrchestratedItem[] = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const kindKey = `${it.kind || ''}::${it.key || ''}`;
    const route   = String(it.actionRoute || '');
    if (seenKindKey.has(kindKey)) continue;
    if (route && seenRoute.has(route)) continue;
    seenKindKey.add(kindKey);
    if (route) seenRoute.add(route);
    out.push(it);
  }
  return out;
}

/**
 * True when the same recommendation kind+key would surface inside
 * its cooldown window. Pure / never throws. The orchestrator's
 * memory module is the canonical store; this is the rule the
 * memory store must match.
 */
export function withinCooldown(
  kind: string,
  lastShownAtIso: string | null | undefined,
  now: number = Date.now(),
): boolean {
  const ms = (RECOMMENDATION_COOLDOWNS as Record<string, number>)[String(kind)];
  if (!Number.isFinite(ms)) return false;
  const t = Date.parse(String(lastShownAtIso || ''));
  if (!Number.isFinite(t)) return false;
  return (now - t) < ms;
}

export default Object.freeze({
  RECOMMENDATION_COOLDOWNS,
  dedupeOrchestratedSet,
  withinCooldown,
});
