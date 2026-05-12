/**
 * emptyStateCTA.js — single source of truth for "missing data"
 * empty-state hints (production-trust spec §8).
 *
 *   const cta = getEmptyStateCTA({ hasFarm: false });
 *   //  → { kind: 'no_farm', title: 'Add your first farm', ... }
 *
 *   // No empty state applies (everything is set up):
 *   getEmptyStateCTA({ hasFarm: true, hasCrop: true, hasLocation: true,
 *                       hasScan: true, hasSatellite: true });
 *   // → null
 *
 * Why a helper, not five per-surface checks
 * ──────────────────────────────────────────
 *   The spec asks Home / Scan / Tasks / Progress / Land-Health to
 *   each render a calm "missing data" line when the relevant piece
 *   isn't there yet. Letting each surface invent its own copy is
 *   exactly how a "fake data" regression slips in — one card
 *   shows "Add your farm" while another silently renders empty.
 *
 *   This helper enforces:
 *
 *     • ONE canonical copy + CTA per missing-data kind.
 *     • A priority order so the FIRST applicable state surfaces
 *       (e.g. "no farm" outranks "no scan" — until they have a
 *       farm, there's no point telling them to scan).
 *     • Each state has exactly one CTA so the surface never shows
 *       multiple competing actions (spec rule "one CTA").
 *
 * Strict-rule audit
 *   • Pure function. Never throws on garbage.
 *   • Returns null when every requested piece is present so the
 *     surface can render the normal happy-path content.
 *   • Caller passes the BOOLEAN states it actually cares about
 *     (a surface checking just "no scan" can skip the rest).
 *   • Copy is intentionally calm + non-judgmental ("Take a photo
 *     to check crop health" — not "You haven't scanned yet!").
 */

// Priority order: which missing piece blocks the most downstream
// behaviour. We surface the highest-priority unmet state.
const _CTA_ORDER = Object.freeze([
  'no_farm',
  'no_plant',
  'no_location',
  'no_scan',
  'no_satellite',
]);

const _CTAS = Object.freeze({
  no_farm: {
    kind:     'no_farm',
    title:    'Add your first farm',
    body:     'Get personalised guidance by adding a farm.',
    ctaLabel: 'Add a farm',
    ctaRoute: '/my-farm/new',
  },
  no_plant: {
    kind:     'no_plant',
    title:    'Add your first plant',
    body:     'Tell Farroway what you grow so the daily plan can adapt.',
    ctaLabel: 'Add a plant',
    ctaRoute: '/my-garden/new',
  },
  no_location: {
    kind:     'no_location',
    title:    'Use current location',
    body:     'We use location for weather + regional patterns. Nothing leaves your device without your tap.',
    ctaLabel: 'Use my location',
    ctaRoute: '/settings/location',
  },
  no_scan: {
    kind:     'no_scan',
    title:    'Take a photo to check crop health',
    body:     'A single photo runs the full intelligence pipeline.',
    ctaLabel: 'Open the camera',
    ctaRoute: '/scan',
  },
  no_satellite: {
    kind:     'no_satellite',
    title:    'Add farm location to unlock land health',
    body:     'Satellite-based stress signals need a farm location to focus on.',
    ctaLabel: 'Add a location',
    ctaRoute: '/my-farm',
  },
});

// ─── Helpers ──────────────────────────────────────────────────

function _falseyMissing(val) {
  // We treat `undefined` as "caller doesn't care about this piece"
  // — we don't surface the CTA for an unspecified key. Only when
  // the caller EXPLICITLY says `hasFarm: false` do we recommend.
  return val === false;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Return the highest-priority empty-state CTA the caller's inputs
 * indicate. Returns null when nothing applies.
 *
 * @param {object} input
 * @param {boolean} [input.hasFarm]
 * @param {boolean} [input.hasCrop]      — alias for hasPlant
 * @param {boolean} [input.hasPlant]
 * @param {boolean} [input.hasLocation]
 * @param {boolean} [input.hasScan]
 * @param {boolean} [input.hasSatellite]
 * @returns {{
 *   kind:     string,
 *   title:    string,
 *   body:     string,
 *   ctaLabel: string,
 *   ctaRoute: string,
 * }|null}
 */
export function getEmptyStateCTA(input) {
  if (!input || typeof input !== 'object') return null;

  // Build a map of unmet states the caller specified.
  const unmet = new Set();
  if (_falseyMissing(input.hasFarm))     unmet.add('no_farm');
  if (_falseyMissing(input.hasPlant) || _falseyMissing(input.hasCrop)) unmet.add('no_plant');
  if (_falseyMissing(input.hasLocation)) unmet.add('no_location');
  if (_falseyMissing(input.hasScan))     unmet.add('no_scan');
  if (_falseyMissing(input.hasSatellite)) unmet.add('no_satellite');

  // Walk the priority list and return the FIRST match.
  for (const k of _CTA_ORDER) {
    if (unmet.has(k)) return { ..._CTAS[k] };
  }
  return null;
}

/**
 * Return ALL applicable empty-state CTAs in priority order. Useful
 * for a settings surface that lists "things still to set up."
 *
 * @param {object} input
 * @returns {Array<object>}
 */
export function getAllEmptyStateCTAs(input) {
  const first = getEmptyStateCTA(input);
  if (!first) return [];
  // Re-walk the priority list collecting every match.
  if (!input || typeof input !== 'object') return [];
  const unmet = new Set();
  if (_falseyMissing(input.hasFarm))     unmet.add('no_farm');
  if (_falseyMissing(input.hasPlant) || _falseyMissing(input.hasCrop)) unmet.add('no_plant');
  if (_falseyMissing(input.hasLocation)) unmet.add('no_location');
  if (_falseyMissing(input.hasScan))     unmet.add('no_scan');
  if (_falseyMissing(input.hasSatellite)) unmet.add('no_satellite');

  return _CTA_ORDER.filter((k) => unmet.has(k)).map((k) => ({ ..._CTAS[k] }));
}

/**
 * Read-only access to the canonical CTA definitions. Test helper +
 * useful for a settings surface that wants to know every possible
 * empty-state kind without inferring from the input.
 */
export function getEmptyStateRegistry() {
  return Object.keys(_CTAS).map((k) => ({ ..._CTAS[k] }));
}

export default {
  getEmptyStateCTA,
  getAllEmptyStateCTAs,
  getEmptyStateRegistry,
};
