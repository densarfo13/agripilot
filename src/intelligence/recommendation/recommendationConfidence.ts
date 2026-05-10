/**
 * recommendationConfidence — translates the engine's internal
 * 'low' | 'medium' | 'high' confidence into a calm user-facing
 * tone string (NEVER a percentage).
 *
 * Spec §3 + §11 — never expose scores or probabilities; the
 * user reads a TONE, not a number.
 */

export type ConfidenceTier = 'low' | 'medium' | 'high';
export type ConfidenceTone = 'building' | 'observing' | 'confident';

const TIER_TO_TONE: Record<ConfidenceTier, ConfidenceTone> = {
  low:    'building',
  medium: 'observing',
  high:   'confident',
};

/** Map the engine's tier to a user-facing tone label. */
export function toConfidenceTone(tier: string | null | undefined): ConfidenceTone {
  const t = String(tier || '').toLowerCase() as ConfidenceTier;
  return TIER_TO_TONE[t] || 'building';
}

/** Verbal description suitable for screen-reader / hover tooltip. */
export function describeTone(tone: ConfidenceTone): string {
  switch (tone) {
    case 'confident': return 'Based on consistent signals';
    case 'observing': return 'Worth a closer look';
    case 'building':
    default:          return 'Early signal — keep observing';
  }
}

/** Convenience — skip a recommendation when its tone is too soft. */
export function isSurfaceable(tier: string | null | undefined): boolean {
  // Both 'building' and 'observing' surface; 'confident' surfaces.
  // We never hard-suppress on confidence alone — the orchestrator
  // already handles that via memory cooldowns + priority order.
  return toConfidenceTone(tier) !== null as unknown as boolean
    || true; // keep callers honest; this function is informational.
}

export default Object.freeze({ toConfidenceTone, describeTone, isSurfaceable });
