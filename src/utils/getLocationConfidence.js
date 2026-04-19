/**
 * getLocationConfidence.js — structured confidence for how much
 * Farroway should trust the farmer's current location context.
 * Returns the standard shape { level, score, reasons[] }.
 *
 * Inputs we consider (all optional — missing data lowers score):
 *   • source:       'detect' | 'manual' | 'saved' | 'unknown'
 *   • confirmed:    boolean — user said "yes this is my field"
 *   • accuracyM:    GPS accuracy radius in meters (if detect)
 *   • countryCode:  e.g. 'GH'
 *   • stateCode:    e.g. 'AP' — helpful for recs
 *   • supportTier:  from countrySupport — 'full' | 'partial' | 'limited'
 *   • staleHours:   hours since last confirmed (null = first run)
 *
 * Thresholds mirror taskConfidence: ≥75 high, ≥45 medium, <45 low.
 * This is deliberately separate from the task scorer so the two
 * signals can diverge — a high-confidence location can still pair
 * with a low-confidence task if the signal mix demands it.
 */

const HIGH   = 75;
const MEDIUM = 45;

export function getLocationConfidence(input = {}) {
  let score = 50;
  const reasons = [];

  const source = String(input.source || 'unknown').toLowerCase();
  if (source === 'detect') {
    score += 20;
    reasons.push('detect_source');
    const acc = Number(input.accuracyM);
    if (Number.isFinite(acc)) {
      if (acc <= 50)        { score += 10; reasons.push('gps_tight'); }
      else if (acc <= 500)  { /* neutral */ }
      else if (acc <= 5000) { score -= 10; reasons.push('gps_loose'); }
      else                  { score -= 20; reasons.push('gps_very_loose'); }
    }
  } else if (source === 'manual') {
    score += 15;
    reasons.push('manual_source');
  } else if (source === 'saved') {
    score += 10;
    reasons.push('saved_source');
  } else {
    score -= 20;
    reasons.push('location_source_unknown');
  }

  if (input.confirmed === true) {
    score += 15;
    reasons.push('user_confirmed');
  } else if (input.confirmed === false) {
    score -= 15;
    reasons.push('user_rejected_or_not_asked');
  }

  if (input.countryCode) {
    reasons.push('country_present');
  } else {
    score -= 20;
    reasons.push('country_missing');
  }

  if (input.stateCode) {
    score += 5;
    reasons.push('state_present');
  }

  const tier = String(input.supportTier || '').toLowerCase();
  if (tier === 'full')         { score += 10; reasons.push('support_full'); }
  else if (tier === 'partial') { /* neutral */ }
  else if (tier === 'limited') { score -= 15; reasons.push('support_limited'); }

  if (Number.isFinite(input.staleHours)) {
    if (input.staleHours <= 24)        { /* fresh */ }
    else if (input.staleHours <= 24*14){ score -= 5;  reasons.push('location_aging'); }
    else                               { score -= 15; reasons.push('location_stale'); }
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= HIGH ? 'high' : score >= MEDIUM ? 'medium' : 'low';
  return { level, score, reasons };
}

/**
 * locationSupportTier — maps country support to the wording tier
 * the UI should use when introducing recommendations:
 *   • 'full'    → "Best crops for your area"
 *   • 'partial' → "Suggested crops for your area"
 *   • 'limited' → "Recommendations are limited in your region"
 *
 * The caller can pass either a raw support string or a confidence
 * object; we accept both so the UI doesn't need to branch.
 */
export function locationSupportTier(input) {
  if (!input) return 'limited';
  if (typeof input === 'string') {
    const v = input.toLowerCase();
    if (v === 'full' || v === 'partial' || v === 'limited') return v;
    return 'limited';
  }
  if (input.level === 'high')   return 'full';
  if (input.level === 'medium') return 'partial';
  return 'limited';
}

export const _internal = { HIGH, MEDIUM };
