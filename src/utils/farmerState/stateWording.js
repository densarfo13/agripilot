/**
 * stateWording.js — per-state canonical copy (title, subtitle,
 * why) with confidence-tier variants. Kept in its own file so
 * the main engine stays short.
 *
 * Each entry holds:
 *   titleKey, titleFallback
 *   subtitleKey, subtitleFallback
 *   whyKey, whyFallback        (optional — for TASK-FIRST states
 *                                that need to explain the task)
 *
 * Confidence tier wording:
 *   Engine appends `.${level}` to the base key (e.g.
 *   'state.harvest_complete.title.low'). The i18n overlay ships
 *   entries for 'high' / 'medium' / 'low' where meaningful. The
 *   caller's t() should fall back to the base key if a tier
 *   variant is missing.
 */

import { STATE_TYPES } from './statePriority.js';

export const STATE_WORDING = Object.freeze({
  [STATE_TYPES.CAMERA_ISSUE]: {
    titleKey: 'state.camera_issue.title',
    titleFallback: 'Check what your camera found',
    subtitleKey: 'state.camera_issue.subtitle',
    subtitleFallback: 'Review the finding before acting',
    whyKey: 'state.camera_issue.why',
    whyFallback: 'A recent photo may show a problem',
  },
  [STATE_TYPES.STALE_OFFLINE]: {
    titleKey: 'state.stale_offline.title',
    titleFallback: 'Based on your last update',
    subtitleKey: 'state.stale_offline.subtitle',
    subtitleFallback: 'We can\u2019t refresh while you\u2019re offline',
    whyKey: 'state.stale_offline.why',
    whyFallback: 'Reconnect to get the latest guidance',
  },
  [STATE_TYPES.BLOCKED_BY_LAND]: {
    titleKey: 'state.blocked_by_land.title',
    titleFallback: 'Wait before planting',
    subtitleKey: 'state.blocked_by_land.subtitle',
    subtitleFallback: 'Your field may not be ready yet',
    whyKey: 'state.blocked_by_land.why',
    whyFallback: 'Conditions may not be right yet',
  },
  [STATE_TYPES.FIELD_RESET]: {
    titleKey: 'state.field_reset.title',
    titleFallback: 'Finish clearing your field',
    subtitleKey: 'state.field_reset.subtitle',
    subtitleFallback: 'Your field still needs preparation',
  },
  [STATE_TYPES.HARVEST_COMPLETE]: {
    titleKey: 'state.harvest_complete.title',
    titleFallback: 'Harvest complete 🌾',
    subtitleKey: 'state.harvest_complete.subtitle',
    subtitleFallback: 'Great work — here\u2019s what\u2019s next',
  },
  [STATE_TYPES.POST_HARVEST]: {
    titleKey: 'state.post_harvest.title',
    titleFallback: 'Post-harvest check-in',
    subtitleKey: 'state.post_harvest.subtitle',
    subtitleFallback: 'Let\u2019s plan your next crop',
  },
  [STATE_TYPES.WEATHER_SENSITIVE]: {
    titleKey: 'state.weather_sensitive.title',
    titleFallback: 'Weather may change your plan today',
    subtitleKey: 'state.weather_sensitive.subtitle',
    subtitleFallback: 'Watch for rain or heat before acting',
    whyKey: 'state.weather_sensitive.why',
    whyFallback: 'Strong rain or heat is expected',
  },
  [STATE_TYPES.FIRST_USE]: {
    titleKey: 'state.first_use.title',
    titleFallback: 'Welcome — let\u2019s begin',
    subtitleKey: 'state.first_use.subtitle',
    subtitleFallback: 'Set up your first crop to get started',
  },
  [STATE_TYPES.RETURNING_INACTIVE]: {
    titleKey: 'state.returning_inactive.title',
    titleFallback: 'Let\u2019s get back on track',
    subtitleKey: 'state.returning_inactive.subtitle',
    subtitleFallback: 'Start with today\u2019s task',
  },
  [STATE_TYPES.ACTIVE_CYCLE]: {
    titleKey: 'state.active_cycle.title',
    titleFallback: 'Today on your farm',
    subtitleKey: 'state.active_cycle.subtitle',
    subtitleFallback: 'Here\u2019s what to focus on',
  },
  [STATE_TYPES.OFF_SEASON]: {
    titleKey: 'state.off_season.title',
    titleFallback: 'Off-season',
    subtitleKey: 'state.off_season.subtitle',
    subtitleFallback: 'Nothing to do right now — plan ahead',
  },
  [STATE_TYPES.SAFE_FALLBACK]: {
    // Safe fallback is deliberately action-oriented — never
    // empty branding. If we can't figure out what the farmer is
    // doing, we still open a clear door.
    titleKey: 'state.safe_fallback.title',
    titleFallback: 'Open today\u2019s guidance',
    subtitleKey: 'state.safe_fallback.subtitle',
    subtitleFallback: null,
  },
});

export function getStateWording(stateType) {
  return STATE_WORDING[stateType] || STATE_WORDING[STATE_TYPES.SAFE_FALLBACK];
}
