/**
 * scanResultColors.js — semantic colour tokens for the scan
 * result surface (spec §5).
 *
 *   import { resultTone, RESULT_TONE, colorTokenFor }
 *     from 'src/core/scan/scanResultColors.js';
 *
 *   const tone = resultTone({ issueCategory, confidenceLabel });
 *   const tokens = colorTokenFor(tone);
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Pure helpers that map a scan result + confidence to ONE of
 *   three calm tones — healthy / caution / critical — and return
 *   the colour tokens the result card uses. Centralising here
 *   means no surface re-invents "what colour is amber?".
 *
 *   Hex values are advisory — the calling theme may override with
 *   its own palette. The token NAMES are what surfaces should
 *   consume so the theme stays swappable.
 *
 * Strict-rule audit
 *   • Pure. Never throws.
 */

export const RESULT_TONE = Object.freeze({
  HEALTHY:  'healthy',
  CAUTION:  'caution',
  CRITICAL: 'critical',
});

// Calm advisory palette. Surface themes may override the hex
// values — token names (tone, accent, surface, ink) are the API.
const PALETTE = Object.freeze({
  healthy: Object.freeze({
    tone:    'healthy',
    accent:  '#3F8C5C',   // calm green
    surface: 'rgba(63, 140, 92, 0.10)',
    ink:     '#1E3F2A',
  }),
  caution: Object.freeze({
    tone:    'caution',
    accent:  '#C8944D',   // amber
    surface: 'rgba(200, 148, 77, 0.12)',
    ink:     '#3D2A0C',
  }),
  critical: Object.freeze({
    tone:    'critical',
    accent:  '#C76A6A',   // soft red — never alarmist
    surface: 'rgba(199, 106, 106, 0.10)',
    ink:     '#4A1C1C',
  }),
});

const _str = (v) => String(v == null ? '' : v).toLowerCase();

// Issue categories grouped by their default tone. The
// confidence label can ESCALATE a category (high confidence
// fungal_risk → critical) but it never DOWNGRADES below the
// category's base tone.
const CATEGORY_BASE_TONE = Object.freeze({
  healthy:                     RESULT_TONE.HEALTHY,
  unknown_needs_clearer_photo: RESULT_TONE.CAUTION,
  yellowing:                   RESULT_TONE.CAUTION,
  wilting:                     RESULT_TONE.CAUTION,
  water_stress:                RESULT_TONE.CAUTION,
  overwatering:                RESULT_TONE.CAUTION,
  nutrient_stress:             RESULT_TONE.CAUTION,
  sunburn:                     RESULT_TONE.CAUTION,
  leaf_spot:                   RESULT_TONE.CAUTION,
  pest_damage:                 RESULT_TONE.CAUTION,
  fungal_risk:                 RESULT_TONE.CRITICAL,
  fruit_rot:                   RESULT_TONE.CRITICAL,
});

/**
 * Pick the tone for a result.
 *
 * @param {object} args
 * @param {string} [args.issueCategory]   from fastIssueClassifier
 * @param {string} [args.confidenceLabel] 'high' | 'medium' | 'low' | 'needs_review'
 * @returns {string} one of RESULT_TONE
 */
export function resultTone(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const cat = _str(a.issueCategory);
    const baseTone = CATEGORY_BASE_TONE[cat] || RESULT_TONE.CAUTION;
    if (baseTone === RESULT_TONE.HEALTHY) return RESULT_TONE.HEALTHY;

    const conf = _str(a.confidenceLabel);
    // High-confidence escalation: caution issues become critical
    // only when confidence is high AND the category is already
    // chemical-risk shaped (fungal/pest/fruit-rot). Don't escalate
    // water/sunburn/nutrient to critical — those resolve with
    // observation, not panic.
    if (conf === 'high') {
      if (cat === 'pest_damage' || cat === 'leaf_spot') return RESULT_TONE.CRITICAL;
    }
    return baseTone;
  } catch {
    return RESULT_TONE.CAUTION;
  }
}

/** Theme tokens for a tone. */
export function colorTokenFor(tone) {
  const t = _str(tone);
  return { ...(PALETTE[t] || PALETTE.caution) };
}

const _module = { RESULT_TONE, resultTone, colorTokenFor };
export default _module;
