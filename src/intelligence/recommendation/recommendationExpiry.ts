/**
 * recommendationExpiry — detect stale recommendations.
 *
 *   A recommendation is "stale" when the signal that produced it
 *   is older than the per-kind expiry window. The orchestrator's
 *   memory store handles dedup within cooldown; this module
 *   handles the reverse — a recommendation persisted across
 *   sessions should not re-fire if its underlying signal has
 *   aged past usefulness.
 *
 * Spec §3 — never recommend outdated scan follow-up / irrelevant
 * seasonal guidance.
 */

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;

// Per-kind staleness window — how old can the SIGNAL be before
// surfacing it again becomes meaningless?
export const EXPIRY_WINDOWS: Readonly<Record<string, number>> = Object.freeze({
  weather:       2  * HOUR,    // weather snapshots age fast
  scan_followup: 3  * DAY,     // a 3-day-old scan reminder is fine
  care:          2  * DAY,     // care suggestions
  buyer:         7  * DAY,     // buyer interest decays over a week
  funding:       30 * DAY,     // funding programs run weeks
  progress:      14 * DAY,
  seasonal:      30 * DAY,
});

/**
 * True when the signal timestamp is past its expiry window.
 * `signalAtIso` is the ISO timestamp of the underlying signal
 * (NOT the time the recommendation was last shown — that's
 * handled by recommendationMemory).
 */
export function isExpired(
  kind: string,
  signalAtIso: string | null | undefined,
  now: number = Date.now(),
): boolean {
  const ms = EXPIRY_WINDOWS[String(kind)];
  if (!Number.isFinite(ms)) return false;
  const t = Date.parse(String(signalAtIso || ''));
  if (!Number.isFinite(t)) return false;
  return (now - t) > ms;
}

/**
 * Filter a candidate set down to non-expired items. Pure / never
 * throws.
 */
export function dropExpired<T extends { kind: string; signalAt?: string | null }>(
  candidates: ReadonlyArray<T>,
  now: number = Date.now(),
): T[] {
  if (!Array.isArray(candidates)) return [];
  return candidates.filter((c) => c && !isExpired(c.kind, c.signalAt, now));
}

export default Object.freeze({ EXPIRY_WINDOWS, isExpired, dropExpired });
