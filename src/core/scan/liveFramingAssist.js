/**
 * liveFramingAssist.js — calm, one-line live framing hints
 * for the camera surface (spec §2).
 *
 *   import { framingHintFor } from 'src/core/scan/liveFramingAssist.js';
 *
 *   const hint = framingHintFor({ brightness, sharpness, subjectArea });
 *   // → { message: { key, fallback }, tone: 'positive' | 'caution' }
 *   //   or null when nothing to say
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure rule engine that turns simple per-frame quality
 *   signals into AT MOST ONE calm hint at a time. The spec rule:
 *   "Do not spam warnings." We always return the single most
 *   important hint, or null when the frame is acceptable.
 *
 *   It does NOT analyse pixels — the caller computes the signals
 *   (brightness, sharpness, subject-area) from the preview frame
 *   and passes them in. SSR-safe + testable.
 *
 * Strict-rule audit
 *   • Pure. Never throws. Every visible string is { key, fallback }.
 */

const _num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const HINT = Object.freeze({
  HOLD_STEADY:   { key: 'scan.framing.steady',   fallback: 'Hold steady' },
  MOVE_CLOSER:   { key: 'scan.framing.closer',   fallback: 'Move closer' },
  CENTER_LEAF:   { key: 'scan.framing.center',   fallback: 'Center the leaf' },
  GOOD_LIGHT:    { key: 'scan.framing.light_ok', fallback: 'Good lighting' },
  LOW_LIGHT:     { key: 'scan.framing.low_light',fallback: 'More light helps' },
  BRIGHT_LIGHT:  { key: 'scan.framing.bright',   fallback: 'A little less direct sun' },
});

/**
 * Decide the single most important hint to show. Returns null
 * when everything's fine — the surface should suppress the hint
 * banner entirely in that case.
 *
 * @param {object} signals
 * @param {number} [signals.brightness]    0..1
 * @param {number} [signals.sharpness]     0..1   (1 = sharp)
 * @param {number} [signals.subjectArea]   0..1   (1 = fills the frame)
 * @param {number} [signals.subjectOffset] 0..1   (0 = centered)
 * @returns {{ message: object, tone: 'positive'|'caution' } | null}
 */
export function framingHintFor(signals) {
  try {
    if (!signals || typeof signals !== 'object') return null;
    const bright   = _num(signals.brightness);
    const sharp    = _num(signals.sharpness);
    const area     = _num(signals.subjectArea);
    const offset   = _num(signals.subjectOffset);

    // Priority order — only the FIRST matching hint is returned.
    if (sharp != null && sharp <= 0.35) {
      return { message: { ...HINT.HOLD_STEADY }, tone: 'caution' };
    }
    if (bright != null && bright <= 0.20) {
      return { message: { ...HINT.LOW_LIGHT }, tone: 'caution' };
    }
    if (bright != null && bright >= 0.95) {
      return { message: { ...HINT.BRIGHT_LIGHT }, tone: 'caution' };
    }
    if (area != null && area <= 0.25) {
      return { message: { ...HINT.MOVE_CLOSER }, tone: 'caution' };
    }
    if (offset != null && offset >= 0.35) {
      return { message: { ...HINT.CENTER_LEAF }, tone: 'caution' };
    }
    // Reassuring positive note — but only when we have evidence
    // (brightness reported AND a healthy value). No fake compliment
    // on missing data.
    if (bright != null && bright >= 0.45 && bright <= 0.85
        && (sharp == null || sharp > 0.5)) {
      return { message: { ...HINT.GOOD_LIGHT }, tone: 'positive' };
    }
    return null;
  } catch {
    return null;
  }
}

export const FRAMING_HINTS = HINT;

const _module = { framingHintFor, FRAMING_HINTS };
export default _module;
