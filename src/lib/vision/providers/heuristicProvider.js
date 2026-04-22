/**
 * heuristicProvider.js — zero-model, zero-network placeholder.
 *
 * WHAT IT DOES
 *   Looks at filename + optional hints for substrings that match a
 *   canonical crop key (or a known alias — "corn", "cacao", etc.).
 *   If it finds a match, returns it as a LOW-confidence candidate
 *   (≤ 0.45) so the UI always asks the farmer to confirm. If it
 *   finds nothing, returns an empty candidate list and the detector
 *   falls through to the manual picker.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   • No ML inference. There is no model bundled.
 *   • No remote call. Runs offline-safe on-device.
 *   • Does not fake high confidence to look clever. The spec was
 *     explicit: "do not overclaim detection yet."
 *
 * WHY IT EXISTS
 *   • Closes the UI loop — the confirmation flow, the IndexedDB
 *     queue, the "detected crop → set selected crop" wiring all
 *     work end-to-end today.
 *   • Gives us a drop-in shape for a real classifier to replace.
 *   • Lets demo users (or operators testing with hand-named files
 *     like "maize-field-1.jpg") get a sensible suggestion to confirm.
 */

import { normalizeCropKey, getCropLabel } from '../../../config/crops/index.js';

// Canonical keys we're willing to surface as heuristic guesses. Each
// entry lists the substrings we scan for in filenames + hints.
// Keep this conservative — false positives are worse than no guess.
const CANDIDATES = [
  { key: 'maize',        tokens: ['maize', 'corn', 'aburoo', 'masara'] },
  { key: 'rice',         tokens: ['rice', 'paddy', 'arroz'] },
  { key: 'cassava',      tokens: ['cassava', 'manioc', 'yuca', 'tapioca'] },
  { key: 'tomato',       tokens: ['tomato', 'tomatoe'] },
  { key: 'onion',        tokens: ['onion'] },
  { key: 'okra',         tokens: ['okra', 'bhindi', 'gombo', 'ladyfinger'] },
  { key: 'pepper',       tokens: ['pepper', 'chili', 'chilli', 'capsicum'] },
  { key: 'potato',       tokens: ['potato', 'spud'] },
  { key: 'sweet-potato', tokens: ['sweetpotato', 'sweet-potato', 'sweet_potato'] },
  { key: 'yam',          tokens: ['yam'] },
  { key: 'banana',       tokens: ['banana'] },
  { key: 'plantain',     tokens: ['plantain', 'matooke'] },
  { key: 'cocoa',        tokens: ['cocoa', 'cacao', 'chocolate'] },
  { key: 'mango',        tokens: ['mango'] },
  { key: 'groundnut',    tokens: ['groundnut', 'peanut'] },
];

function scan(haystack) {
  if (!haystack) return null;
  const h = String(haystack).toLowerCase();
  for (const c of CANDIDATES) {
    for (const t of c.tokens) {
      if (h.includes(t)) return c;
    }
  }
  return null;
}

async function detect(imageInput, options = {}) {
  const meta = options.meta || {};
  const filename = meta.filename
    || (imageInput && imageInput.name)
    || (options.hints && options.hints.filename)
    || null;

  const match = scan(filename)
    || scan(options.hints && options.hints.caption)
    || scan(options.hints && options.hints.label);

  if (!match) {
    return {
      candidates: [],
      reason: 'heuristic_no_match',
    };
  }

  const canonicalKey = normalizeCropKey(match.key) || match.key;
  const label = getCropLabel(canonicalKey, options.language || 'en')
    || canonicalKey;

  // Cap at 0.45 — intentionally below the MIN_CONFIDENT (0.6) bar in
  // cropDetector so the UI always routes through the confirm step.
  return {
    candidates: [{
      cropKey:    canonicalKey,
      label,
      confidence: 0.45,
    }],
    reason: `heuristic_filename_match:${match.key}`,
  };
}

export const heuristicProvider = Object.freeze({
  name: 'heuristic',
  detect,
});
