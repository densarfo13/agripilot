/**
 * fallbacks — spec §11 mode-specific fallback guidance.
 *
 * When context is missing AND the orchestrator's rule ladder
 * yielded nothing surfaceable, the calling page renders one of
 * these calm fallbacks instead of a blank card.
 */

import type { PrimaryGuidance } from './getPrimaryGuidance.js';

// Empty-title fallback. Consumers (ImmersiveHomeHero,
// NextBestActionCard, etc.) already gate on `title` presence, so
// an empty-title guidance collapses the surface to its own
// no-data branch instead of rendering generic chatter.
export const FARM_FALLBACK: PrimaryGuidance = Object.freeze({
  id:               'fallback_farm_empty',
  title:            '',
  message:          '',
  reason:           '',
  actionLabel:      '',
  actionRoute:      '/tasks',
  estimatedMinutes: 0,
  tone:             'practical',
  confidenceTone:   'limited-data',
  priority:         'low',
  expiresAt:        null,
});

export const GARDEN_FALLBACK: PrimaryGuidance = Object.freeze({
  id:               'fallback_garden_empty',
  title:            '',
  message:          '',
  reason:           '',
  actionLabel:      '',
  actionRoute:      '/tasks',
  estimatedMinutes: 0,
  tone:             'calm',
  confidenceTone:   'limited-data',
  priority:         'low',
  expiresAt:        null,
});

/**
 * Return the mode-appropriate fallback. Pure / never throws.
 */
export function fallbackForMode(mode: string | null | undefined): PrimaryGuidance {
  return String(mode || '').toLowerCase() === 'garden'
    ? GARDEN_FALLBACK
    : FARM_FALLBACK;
}

export default Object.freeze({
  FARM_FALLBACK,
  GARDEN_FALLBACK,
  fallbackForMode,
});
