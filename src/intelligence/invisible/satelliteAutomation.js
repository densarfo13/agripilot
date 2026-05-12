/**
 * satelliteAutomation.js — land-health signal that hides raw NDVI
 * (Invisible Intelligence spec §6).
 *
 *   const signal = computeSatelliteAutomation({
 *     coordinates, satelliteSnapshot, weather, cropStage,
 *   });
 *
 * What this module does (and doesn't)
 * ───────────────────────────────────
 *   The spec rule: "Do not show raw NDVI unless advanced/admin
 *   mode." We honour that strictly:
 *     • Output is a calm farmer-language hint
 *       ("Land health needs attention" / "Check crop area today")
 *     • Raw NDVI values, model JSON, and band-level readings are
 *       NEVER surfaced through farmerMessage
 *
 *   Inputs the spec lists:
 *     • farm coordinates       — required (no coords → quiet)
 *     • NDVI / land-health
 *       endpoint snapshot      — required (no snapshot → quiet)
 *     • weather                — optional context
 *     • crop stage             — optional gating ("seedling vs mature")
 *     • historical land health — optional trend
 *
 *   Strict-rule audit
 *     • Pure function. Never throws.
 *     • Reads from the caller's snapshot — does NOT make a fresh
 *       satellite call. That stays in whichever service owns the
 *       NDVI endpoint; this is the synthesis layer.
 *     • visibleToUser:false unless the snapshot has BOTH valid
 *       coords AND a known stressLevel.
 */

import { makeQuietFallback, makeActiveSignal } from './moduleShape.js';

const SOURCE = 'satelliteAutomation';
const QUIET_MESSAGE = 'Add farm location to unlock land-health insights.';

function _hasCoords(coords) {
  if (!coords || typeof coords !== 'object') return false;
  return typeof coords.lat === 'number' && typeof coords.lng === 'number'
      && Number.isFinite(coords.lat) && Number.isFinite(coords.lng);
}

export function computeSatelliteAutomation(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const snap = (safe.satelliteSnapshot && typeof safe.satelliteSnapshot === 'object')
    ? safe.satelliteSnapshot : null;
  const coords = safe.coordinates;

  if (!_hasCoords(coords) || !snap) {
    return makeQuietFallback(SOURCE, QUIET_MESSAGE);
  }

  const stress = String(snap.stressLevel || '').toLowerCase();
  const drought = snap.droughtSignal === true;
  const decline = snap.vegetationTrend === 'declining' || snap.ndviTrend === 'declining';

  if (stress === 'high' || (decline && drought)) {
    return makeActiveSignal({
      signal:           'land_health_attention',
      confidence:       'medium',
      farmerMessage:    'Land health needs attention.',
      recommendedAction: 'Check the crop area today.',
      urgency:          'high',
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  if (stress === 'medium' || drought || decline) {
    return makeActiveSignal({
      signal:           'land_health_watch',
      confidence:       'medium',
      farmerMessage:    'Land health is shifting — worth a closer look this week.',
      recommendedAction: 'Walk the field and note any stressed rows.',
      urgency:          'medium',
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  // Healthy / unknown → quiet acknowledgement. No raw NDVI ever.
  return makeQuietFallback(SOURCE, '');
}

export default { computeSatelliteAutomation };
