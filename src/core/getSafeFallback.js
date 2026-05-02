/**
 * getSafeFallback.js \u2014 universal "the system has nothing to
 * say, but the user is still here" fallback generator.
 *
 *   import { getSafeFallback } from '../core/getSafeFallback.js';
 *
 *   // Scan failure / 2-second timeout / image too dark:
 *   const fb = getSafeFallback('scan', { experience: 'garden' });
 *   //   {
 *   //     possibleIssue: 'Needs closer inspection',
 *   //     explanation:   'We couldn\u2019t clearly analyze this image.',
 *   //     actions: [
 *   //       'Retake the photo in better light',
 *   //       'Check leaves and soil manually',
 *   //       'Monitor the plant tomorrow',
 *   //     ],
 *   //   }
 *
 *   // API call failed entirely:
 *   const fb = getSafeFallback('api', { surface: 'today' });
 *
 *   // Empty data set (e.g. no tasks yet):
 *   const fb = getSafeFallback('empty', { experience: 'farm' });
 *
 * Spec rule (final-gap stability \u00a77): every fallback must
 * include a simple explanation + 2\u20133 actions so the user is
 * NEVER stuck on a blank screen. The shape returned is
 * intentionally compatible with the high-trust scan output
 * policy so a scan-page caller can render the fallback without
 * a separate code path.
 *
 * Strict-rule audit
 *   \u2022 Pure. No I/O. No React. Never throws.
 *   \u2022 Stable shape: every kind returns the same keys (so the
 *     caller branches on `possibleIssue` once, not per kind).
 *   \u2022 Coexists with `enforceHighTrustScanResult` \u2014 that policy
 *     module wraps the engine output; this module is the
 *     standalone "the engine isn't even responding" path.
 */

// Spec \u00a72 \u2014 the minimum scan fallback. Garden and farm wording
// merge into one block for the scan-fail case because the user
// hasn't told us anything actionable yet (the photo failed). The
// generic explanation is the same line the spec specifies.
const SCAN_FALLBACK = Object.freeze({
  possibleIssue: 'Needs closer inspection',
  explanation:   'We couldn\u2019t clearly analyze this image.',
  actions: [
    'Retake the photo in better light',
    'Check leaves and soil manually',
    'Monitor the plant tomorrow',
  ],
});

// Spec \u00a77 \u2014 API fail fallback. We DON'T pretend to know what
// the user was doing; just acknowledge the connectivity issue
// + give 2 actions the user can take right now without us.
const API_FALLBACK = Object.freeze({
  possibleIssue: 'Connection issue',
  explanation:   'We couldn\u2019t reach Farroway right now.',
  actions: [
    'Try again in a moment',
    'Continue with what you can see on screen',
  ],
});

// Spec \u00a77 \u2014 empty-data fallback for surfaces that loaded but
// have nothing to render. Garden + farm versions diverge only
// on wording.
const EMPTY_FALLBACK_GARDEN = Object.freeze({
  possibleIssue: 'No tasks today',
  explanation:   'Your garden looks all set for now.',
  actions: [
    'Check your plant leaves',
    'Water only if soil is dry',
  ],
});

const EMPTY_FALLBACK_FARM = Object.freeze({
  possibleIssue: 'No tasks today',
  explanation:   'Your field looks all set for now.',
  actions: [
    'Walk a row and look for spread',
    'Note anything unusual in your log',
  ],
});

/**
 * getSafeFallback(kind, ctx) \u2192 fallback object.
 *
 * @param {'scan'|'api'|'empty'|string} kind
 * @param {object} [ctx]
 * @param {'garden'|'farm'|'generic'} [ctx.experience]
 * @param {string} [ctx.surface]   informational \u2014 used in dev-only
 *                                 logging if added later.
 * @returns {{
 *   possibleIssue: string,
 *   explanation:   string,
 *   actions:       string[],   // 2\u20133 entries
 * }}
 */
export function getSafeFallback(kind = 'scan', ctx = {}) {
  const safe = (ctx && typeof ctx === 'object') ? ctx : {};
  const exp  = String(safe.experience || '').toLowerCase();

  let block;
  if (kind === 'api') {
    block = API_FALLBACK;
  } else if (kind === 'empty') {
    block = exp === 'farm' ? EMPTY_FALLBACK_FARM : EMPTY_FALLBACK_GARDEN;
  } else {
    block = SCAN_FALLBACK;   // 'scan' + any unknown kind
  }

  // Always return a fresh object + array so callers can mutate
  // without poisoning the canonical block.
  return {
    possibleIssue: block.possibleIssue,
    explanation:   block.explanation,
    actions:       block.actions.slice(),
  };
}

export const _internal = Object.freeze({
  SCAN_FALLBACK, API_FALLBACK,
  EMPTY_FALLBACK_GARDEN, EMPTY_FALLBACK_FARM,
});

export default getSafeFallback;
