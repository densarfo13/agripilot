/**
 * fallbacks — spec §11 mode-specific fallback guidance.
 *
 * When context is missing AND the orchestrator's rule ladder
 * yielded nothing surfaceable, the calling page renders one of
 * these calm fallbacks instead of a blank card.
 */

import type { PrimaryGuidance } from './getPrimaryGuidance.js';

export const FARM_FALLBACK: PrimaryGuidance = Object.freeze({
  id:               'fallback_farm_quick_check',
  title:            'Quick crop check',
  message:          'Check your crop condition and soil moisture today.',
  reason:           'A short walk through the fields keeps the rhythm.',
  actionLabel:      'View task',
  actionRoute:      '/tasks',
  estimatedMinutes: 10,
  tone:             'practical',
  confidenceTone:   'limited-data',
  priority:         'low',
  expiresAt:        null,
});

export const GARDEN_FALLBACK: PrimaryGuidance = Object.freeze({
  id:               'fallback_garden_quick_check',
  title:            'Walk the garden',
  message:          'Notice anything new on the leaves or in the soil.',
  reason:           'A small daily glance catches early signals.',
  actionLabel:      'Walk the garden',
  actionRoute:      '/tasks',
  estimatedMinutes: 3,
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
