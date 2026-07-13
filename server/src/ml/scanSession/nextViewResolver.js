/**
 * nextViewResolver.js — the deterministic "next best view" engine (spec P2/P9).
 *
 * Given the current session evidence, decides whether more photos are needed and,
 * if so, WHICH view most reduces the remaining uncertainty — instead of a generic
 * "Scan again". Pure, deterministic, never throws. No DB, no provider, no image.
 *
 * This is the brain of the guided multi-view session; the session persistence +
 * endpoint + UI (P0/P8) consume it. It is intentionally standalone + side-effect
 * free so it is fully unit-testable without a database.
 */

export const VIEW_TYPES = Object.freeze([
  'WHOLE_PLANT', 'LEAF_FRONT', 'LEAF_UNDERSIDE', 'STEM', 'FRUIT', 'FLOWER',
  'PEST', 'DAMAGE_CLOSEUP', 'UNKNOWN',
]);

// P9 cost controls — env-configurable with safe, validated defaults.
function _envInt(name, def, min = 1, max = 20) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return def;
  return n;
}
export function getSessionLimits() {
  return Object.freeze({
    maxImages:              _envInt('SCAN_SESSION_MAX_IMAGES', 3, 1, 10),
    expiryMinutes:          _envInt('SCAN_SESSION_EXPIRY_MINUTES', 30, 1, 240),
    maxIdentificationCalls: _envInt('SCAN_SESSION_MAX_IDENTIFICATION_CALLS', 3, 1, 10),
    maxHealthCalls:         _envInt('SCAN_SESSION_MAX_HEALTH_CALLS', 2, 1, 10),
    dedupWindowMinutes:     _envInt('SCAN_SESSION_DEDUP_WINDOW_MINUTES', 60, 1, 1440),
  });
}

// Farmer-facing instruction per requested view. i18n keys the client renders via
// tSafe; the English fallback keeps the engine self-describing in logs/tests.
const VIEW_INSTRUCTION = Object.freeze({
  WHOLE_PLANT:    ['scan.view.wholePlant',   'Take one photo of the whole plant.'],
  LEAF_FRONT:     ['scan.view.leafFront',    'Take a close photo of the top of the affected leaf.'],
  LEAF_UNDERSIDE: ['scan.view.leafUnderside','Photograph the underside of the same affected leaf.'],
  STEM:           ['scan.view.stem',         'Take a close photo of the stem or branch.'],
  FRUIT:          ['scan.view.fruit',        'Take a close photo of the fruit.'],
  FLOWER:         ['scan.view.flower',       'Take a close photo of the flower.'],
  PEST:           ['scan.view.pest',         'Take a close photo of the insect or pest you can see.'],
  DAMAGE_CLOSEUP: ['scan.view.damage',       'Take a close photo of the damaged area.'],
});

const _arr = (v) => (Array.isArray(v) ? v : []);
function _done(reasonCode, remaining) {
  return Object.freeze({
    requiresMoreEvidence: false, requestedView: null, reasonCode,
    farmerInstruction: null, farmerInstructionKey: null,
    maximumAdditionalPhotosRemaining: remaining,
  });
}
function _request(view, reasonCode, remaining) {
  const ins = VIEW_INSTRUCTION[view] || VIEW_INSTRUCTION.LEAF_FRONT;
  return Object.freeze({
    requiresMoreEvidence: true, requestedView: view, reasonCode,
    farmerInstructionKey: ins[0], farmerInstruction: ins[1],
    maximumAdditionalPhotosRemaining: remaining,
  });
}

/**
 * @param {object} input
 * @param {string} input.identificationState  CONFIRMED|PROVISIONAL|LOW_CONFIDENCE|CONFLICTING_EVIDENCE|NOT_A_PLANT
 * @param {string} input.healthState          HEALTHY|ISSUE_POSSIBLE|HEALTH_UNCERTAIN|HEALTH_RESOLVED|NOT_RUN
 * @param {boolean} input.healthDisagreement  leading health conditions hard to distinguish (e.g. pest vs disease)
 * @param {string} input.imageQualityStatus   PASS|WARN|FAIL of the most recent image
 * @param {string} input.latestView           viewType of the most recent image
 * @param {string[]} input.submittedViews      viewTypes already submitted (usable quality)
 * @param {number} input.photosSubmitted       count of images in the session
 * @returns {Readonly<object>} the next-view decision (never throws)
 */
export function resolveNextView(input = {}) {
  const lim = getSessionLimits();
  const submitted = _arr(input.submittedViews);
  const photos = Number.isInteger(input.photosSubmitted) ? input.photosSubmitted : submitted.length;
  const remaining = Math.max(0, lim.maxImages - photos);
  const idState = String(input.identificationState || '').toUpperCase();
  const healthState = String(input.healthState || '').toUpperCase();
  const quality = String(input.imageQualityStatus || 'PASS').toUpperCase();
  const has = (v) => submitted.includes(v);

  // Terminal — no more photos will help.
  if (idState === 'NOT_A_PLANT') return _done('NOT_A_PLANT', remaining);
  if (idState === 'CONFIRMED' && (healthState === 'HEALTHY' || healthState === 'HEALTH_RESOLVED'
      || (healthState && healthState !== 'HEALTH_UNCERTAIN' && !input.healthDisagreement))) {
    return _done('SUFFICIENT', remaining);
  }
  // Budget exhausted → stop asking, escalate to a human.
  if (remaining <= 0) return _done('MAX_PHOTOS_REACHED', 0);

  // A failed image → retake the SAME view (the only case we re-request a view).
  if (quality === 'FAIL' && input.latestView && VIEW_INSTRUCTION[input.latestView]) {
    return _request(input.latestView, 'RETAKE_QUALITY', remaining);
  }

  // Health ambiguity (pest vs disease) → the underside separates them best.
  if (input.healthDisagreement && !has('LEAF_UNDERSIDE')) {
    return _request('LEAF_UNDERSIDE', 'DISTINGUISH_PEST_FROM_DISEASE', remaining);
  }

  // Conflicting identity across views → a whole-plant view adds disambiguating context.
  if (idState === 'CONFLICTING_EVIDENCE') {
    if (!has('WHOLE_PLANT')) return _request('WHOLE_PLANT', 'RESOLVE_CONFLICT', remaining);
    return _done('ESCALATE_CONFLICT', remaining); // more photos unlikely to help
  }

  // Weak identification from a distant/whole-plant shot → ask for a close leaf.
  if (idState === 'LOW_CONFIDENCE' || idState === 'PROVISIONAL') {
    if (!has('LEAF_FRONT')) return _request('LEAF_FRONT', 'NEED_CLOSEUP', remaining);
    if (!has('WHOLE_PLANT')) return _request('WHOLE_PLANT', 'NEED_CONTEXT', remaining);
    // Ran the useful views, still not confident → stop, offer expert review.
    return _done('ESCALATE_LOW_CONFIDENCE', remaining);
  }

  // Identity fine but health still uncertain → a close damage/underside view helps.
  if ((idState === 'CONFIRMED') && (healthState === 'HEALTH_UNCERTAIN' || input.healthDisagreement)) {
    if (!has('DAMAGE_CLOSEUP')) return _request('DAMAGE_CLOSEUP', 'NEED_HEALTH_DETAIL', remaining);
    return _done('ESCALATE_HEALTH_UNCERTAIN', remaining);
  }

  return _done('SUFFICIENT', remaining);
}

export default resolveNextView;
