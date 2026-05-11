/**
 * guidanceCooldown — per-kind cooldown windows per spec §7.
 *
 *   weather:              12h
 *   task:                  8h
 *   scan_followup:        24h
 *   soil_followup:        24h
 *   funding:              72h
 *   buyer_interest:        2h  (can bypass when new inquiry exists)
 *   journal:              24h
 *   progress_reassurance: 12h
 *
 * Stricter than the governance default cooldowns where the spec
 * calls for stricter values; identical where it doesn't. Exposed
 * via `getCooldownMs(kind)` so callers don't bind to the constant
 * shape and can swap the table at runtime in tests.
 */

const HOUR = 60 * 60 * 1000;

export const GUIDANCE_COOLDOWNS: Readonly<Record<string, number>> = Object.freeze({
  weather:              12 * HOUR,
  task:                 8  * HOUR,
  scan_followup:        24 * HOUR,
  soil_followup:        24 * HOUR,
  funding:              72 * HOUR,
  buyer_interest:       2  * HOUR,
  journal:              24 * HOUR,
  progress_reassurance: 12 * HOUR,
  // Aliases for the governance kind names so either spelling
  // resolves the same window.
  care:                 8  * HOUR,
  buyer:                2  * HOUR,
  progress:             12 * HOUR,
  seasonal:             24 * HOUR,
});

/**
 * Returns the cooldown window in ms for a given kind. Falls back
 * to a 1-hour minimum when the kind is unknown so a misspelled
 * kind never produces an aggressively short cooldown.
 */
export function getCooldownMs(kind: string): number {
  const ms = GUIDANCE_COOLDOWNS[String(kind)];
  return Number.isFinite(ms) ? ms : HOUR;
}

/**
 * True when (now - lastShownAt) is still inside the kind's
 * cooldown window. Pure / never throws.
 *
 * `bypassWhen` is the spec §7 escape hatch for buyer_interest:
 * pass `{ newInquiry: true }` to ignore the cooldown when a
 * fresh buyer inquiry has arrived.
 */
export function withinCooldown(
  kind: string,
  lastShownAtIso: string | null | undefined,
  now: number = Date.now(),
  bypassWhen: { newInquiry?: boolean } = {},
): boolean {
  if (kind === 'buyer_interest' && bypassWhen.newInquiry === true) return false;
  const ms = getCooldownMs(kind);
  const t = Date.parse(String(lastShownAtIso || ''));
  if (!Number.isFinite(t)) return false;
  return (now - t) < ms;
}

export default Object.freeze({
  GUIDANCE_COOLDOWNS,
  getCooldownMs,
  withinCooldown,
});
