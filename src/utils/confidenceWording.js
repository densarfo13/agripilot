/**
 * confidenceWording.js — thin translator between a confidence
 * object and the i18n key that describes it. This is what the UI
 * actually imports so the same wording logic runs on every screen.
 *
 * Three spaces of wording, all i18n-backed:
 *   1. recommendation header    — "Best / Suggested / Limited"
 *   2. location trust line       — "Detected X, tap to confirm"
 *   3. listing freshness badge  — "Fresh / Recent / May be out of date"
 *
 * Each helper returns `{ key, fallback }`. Callers pass `key` to
 * their local t() and render `fallback` if the key is missing so
 * the UI never shows a raw key.
 */

export function recommendationHeaderKey(confidence) {
  const level = levelOf(confidence);
  if (level === 'high')   return { key: 'recommendations.header.high',   fallback: 'Best crops for your area' };
  if (level === 'medium') return { key: 'recommendations.header.medium', fallback: 'Suggested crops for your area' };
  return                         { key: 'recommendations.header.low',    fallback: 'Recommendations are limited in your region' };
}

export function recommendationSubheaderKey(confidence) {
  const level = levelOf(confidence);
  if (level === 'high')   return { key: 'recommendations.sub.high',   fallback: 'Picked from crops that do well where you are' };
  if (level === 'medium') return { key: 'recommendations.sub.medium', fallback: 'A starting shortlist — adjust to your plot' };
  return                         { key: 'recommendations.sub.low',    fallback: 'We only have partial data for your region — please review carefully' };
}

export function locationConfidenceHintKey(confidence) {
  const level = levelOf(confidence);
  if (level === 'high')   return { key: 'location.confidence.high',   fallback: 'Using your detected location' };
  if (level === 'medium') return { key: 'location.confidence.medium', fallback: 'Confirm this is your field' };
  return                         { key: 'location.confidence.low',    fallback: 'We\u2019re not sure — please pick your region' };
}

export function listingFreshnessKey(confidence) {
  const level = levelOf(confidence);
  if (level === 'high')   return { key: 'listing.freshness.high',   fallback: 'Fresh listing' };
  if (level === 'medium') return { key: 'listing.freshness.medium', fallback: 'Recent' };
  return                         { key: 'listing.freshness.low',    fallback: 'May be out of date' };
}

/**
 * wordingForConfidence — generic helper that takes a caller-defined
 * base key (e.g. "task.plant") and returns `${base}.${level}`.
 * Mirrors applyConfidenceWording in taskConfidence.js.
 */
export function wordingForConfidence(baseKey, confidence) {
  if (!baseKey) return null;
  return `${baseKey}.${levelOf(confidence)}`;
}

function levelOf(c) {
  if (!c) return 'medium';
  if (typeof c === 'string') {
    const v = c.toLowerCase();
    if (v === 'high' || v === 'medium' || v === 'low') return v;
    return 'medium';
  }
  const l = String(c.level || '').toLowerCase();
  return l === 'high' || l === 'medium' || l === 'low' ? l : 'medium';
}

export const _internal = { levelOf };
