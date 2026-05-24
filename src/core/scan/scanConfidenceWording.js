/**
 * scanConfidenceWording.js — calm, actionable wording for the
 * "low confidence" surface (spec §6).
 *
 *   import { wordingForConfidence, retakeTipsFor }
 *     from 'src/core/scan/scanConfidenceWording.js';
 *
 *   const ux = wordingForConfidence({ tier: 'low', evidence: [] });
 *   // ux.headline   → "We may need a clearer image to verify this."
 *   // ux.subline    → "Try the tips below for a clearer scan."
 *   // ux.retakeTips → [{ key, fallback }, …]
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure UI-layer helper. It does NOT make the confidence
 *   decision — `fastIssueClassifier` already returns a hedged
 *   `confidenceWord`. This module turns that tier into the surface
 *   copy the spec asked for: never the bare phrase "low
 *   confidence" — always paired with retake guidance and a calm
 *   explanation of why.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Every user-visible string ships as `{ key, fallback }`.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();

const HEADLINES = Object.freeze({
  high:         { key: 'scan.conf.headline.high',   fallback: 'This looks like a likely match.' },
  medium:       { key: 'scan.conf.headline.medium', fallback: 'A possible match — check before acting.' },
  low:          { key: 'scan.conf.headline.low',    fallback: 'We may need a clearer image to verify this.' },
  needs_review: { key: 'scan.conf.headline.review', fallback: 'We need a clearer photo to read this scan.' },
});

const SUBLINES = Object.freeze({
  high:         { key: 'scan.conf.sub.high',   fallback: 'Even at this level, real-world conditions vary — keep an eye on the plant.' },
  medium:       { key: 'scan.conf.sub.medium', fallback: 'A second look can confirm what we see — try the tips below if it stays unclear.' },
  low:          { key: 'scan.conf.sub.low',    fallback: 'Try the tips below for a clearer scan.' },
  needs_review: { key: 'scan.conf.sub.review', fallback: 'A clearer photo helps us give better guidance.' },
});

// Retake tips — each ships a translation key + English fallback.
// The "why your confidence dropped" cause feeds tip selection so
// we don't show "good lighting" when blur was the real problem.
const TIP = Object.freeze({
  natural_light:   { key: 'scan.retake.light',   fallback: 'Take the photo in natural daylight, not direct shade.' },
  hold_steady:     { key: 'scan.retake.steady',  fallback: 'Hold the phone steady — a hand brace against the plant helps.' },
  fill_frame:      { key: 'scan.retake.frame',   fallback: 'Fill the frame with one leaf or one fruit — not the whole plant.' },
  one_subject:     { key: 'scan.retake.subject', fallback: 'Capture a single affected leaf, not a wide shot of the patch.' },
  closer:          { key: 'scan.retake.closer',  fallback: 'Move closer — about a hand\'s width from the subject.' },
  no_glare:        { key: 'scan.retake.glare',   fallback: 'Move slightly so the leaf isn\'t in direct sun-glare.' },
  multiple_angles: { key: 'scan.retake.angles',  fallback: 'Try a second photo from another angle if the first looks unclear.' },
});

// Map a reason string (from `isImageQualityPoor` etc.) to the
// tip that most directly fixes it. Unknown reasons fall through
// to the generic "fill the frame + hold steady" pair.
const TIP_FOR_REASON = Object.freeze({
  blurry:           [TIP.hold_steady, TIP.closer],
  too_dark:         [TIP.natural_light, TIP.no_glare],
  overexposed:      [TIP.no_glare, TIP.natural_light],
  low_contrast:    [TIP.natural_light, TIP.fill_frame],
  crop_not_visible:[TIP.closer, TIP.fill_frame],
});

const DEFAULT_TIPS = Object.freeze([
  TIP.fill_frame, TIP.hold_steady, TIP.natural_light,
]);

function _tierFor(input) {
  const tier = _str((input && input.tier) || input);
  if (tier === 'high') return 'high';
  if (tier === 'medium') return 'medium';
  if (tier === 'needs_review') return 'needs_review';
  return 'low';
}

/**
 * Wording for a confidence outcome.
 *
 * @param {object|string} input
 *        Either a tier string ('high'|'medium'|'low'|'needs_review')
 *        OR an object `{ tier, reasons }` where `reasons` is an
 *        array of strings from the quality check.
 * @returns {{ headline, subline, retakeTips, tier }}
 */
export function wordingForConfidence(input) {
  try {
    const tier = _tierFor(input);
    const reasons = (input && Array.isArray(input.reasons)) ? input.reasons : [];
    return {
      tier,
      headline:   { ...HEADLINES[tier] },
      subline:    { ...SUBLINES[tier] },
      retakeTips: retakeTipsFor(reasons, tier),
    };
  } catch {
    return {
      tier:       'low',
      headline:   { ...HEADLINES.low },
      subline:    { ...SUBLINES.low },
      retakeTips: DEFAULT_TIPS.slice(),
    };
  }
}

/**
 * Pick retake tips relevant to the quality reasons. Always
 * returns 2–4 tips. High/medium tiers also get one tip in case
 * the user wants to retake voluntarily.
 *
 * @param {string[]} reasons
 * @param {string} [tier]
 * @returns {Array<{key, fallback}>}
 */
export function retakeTipsFor(reasons, tier) {
  try {
    const t = _tierFor(tier);
    const list = [];
    const seen = new Set();
    const push = (tip) => {
      if (!tip || seen.has(tip.key)) return;
      seen.add(tip.key);
      list.push({ ...tip });
    };
    const arr = Array.isArray(reasons) ? reasons : [];
    for (const r of arr) {
      const tips = TIP_FOR_REASON[String(r)] || [];
      for (const tip of tips) push(tip);
      if (list.length >= 4) break;
    }
    // Pad to at least 2 tips so the surface always has something
    // calm to render.
    for (const tip of DEFAULT_TIPS) {
      if (list.length >= (t === 'high' ? 1 : 3)) break;
      push(tip);
    }
    return list;
  } catch {
    return DEFAULT_TIPS.slice();
  }
}

const _module = { wordingForConfidence, retakeTipsFor };
export default _module;
