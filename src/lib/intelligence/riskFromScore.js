/**
 * riskFromScore.js — single source of truth for the simple
 * NGO-decision risk band per the new intelligence spec.
 *
 * Bands (per spec)
 * ────────────────
 *   score <  40        → 'high'    (High Risk)
 *   40 ≤ score < 60    → 'medium'  (Medium)
 *   score ≥ 60         → 'low'     (Low)
 *
 * Coexistence note
 * ────────────────
 * The existing `lib/farmer/progressScore.js` exports a richer
 * 4-band classifier (purple/green/yellow/red) used by ScoreBadge.
 * That helper stays — this file is intentionally a smaller,
 * simpler partition tailored to the NGO/admin decision view where
 * the operator wants a single "is this farm a problem yes/no"
 * read. Both can be displayed side-by-side without conflict.
 *
 * Inputs that aren't a finite number resolve to 'unknown'. The
 * caller's UI is responsible for hiding the badge when the band
 * is 'unknown' rather than showing a misleading "Low" pill.
 */

export const RISK_BANDS = Object.freeze({
  HIGH:    'high',
  MEDIUM:  'medium',
  LOW:     'low',
  UNKNOWN: 'unknown',
});

/**
 * @param {number|string} score
 * @returns {'high'|'medium'|'low'|'unknown'}
 */
export function riskFromScore(score) {
  const n = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(n)) return RISK_BANDS.UNKNOWN;
  if (n < 40)              return RISK_BANDS.HIGH;
  if (n < 60)              return RISK_BANDS.MEDIUM;
  return RISK_BANDS.LOW;
}

/**
 * Translation key suffix for a band — the caller appends a
 * namespace prefix (e.g. `risk.label.high`).
 */
export function riskKeySuffix(band) {
  switch (band) {
    case RISK_BANDS.HIGH:    return 'high';
    case RISK_BANDS.MEDIUM:  return 'medium';
    case RISK_BANDS.LOW:     return 'low';
    default:                 return 'unknown';
  }
}

/**
 * Defensive fallback labels for the caller's `tStrict` /
 * `resolve(t, key, fallback)` invocations. Short, decision-focused
 * wording — no flourish, no emoji.
 */
export const RISK_FALLBACKS = Object.freeze({
  high:    'High Risk',
  medium:  'Medium',
  low:     'Low',
  unknown: 'Unknown',
});
