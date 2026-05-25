/**
 * scanCaptureChecklist.js — pre-capture quality assist.
 *
 *   import { captureChecklistFor, CHECKLIST_ITEM }
 *     from 'src/core/scan/scanCaptureChecklist.js';
 *
 *   const items = captureChecklistFor({ suspectedKind: 'pest', crop: 'tomato' });
 *   // items = [{ key, fallback, params }, ...]
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Returns a short, context-aware list of capture hints the
 *   surface renders BEFORE the user takes the photo. Improves
 *   accuracy more than any classifier tweak — the spec calls
 *   this out explicitly.
 *
 *   It is NOT a real-time framing assist (that's
 *   `liveFramingAssist.js` — it analyses the live preview
 *   stream). This module just returns the static checklist
 *   the surface renders next to the capture button.
 *
 * Strict-rule audit
 *   • Pure. Never throws. Every output is a localized envelope.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();

export const CHECKLIST_ITEM = Object.freeze({
  MOVE_CLOSER:     'move_closer',
  IMPROVE_LIGHT:   'improve_light',
  CENTER_SUBJECT:  'center_subject',
  HOLD_STEADY:     'hold_steady',
  CAPTURE_UNDERSIDE: 'capture_underside',
  REMOVE_GLOVES:   'remove_gloves',
  SHADE_HARSH_SUN: 'shade_harsh_sun',
});

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

// ── Per-item envelopes ───────────────────────────────────
const _COPY = Object.freeze({
  [CHECKLIST_ITEM.MOVE_CLOSER]:       _msg('scan.checklist.moveCloser',
    'Move closer — fill the frame with the leaf or fruit.'),
  [CHECKLIST_ITEM.IMPROVE_LIGHT]:     _msg('scan.checklist.improveLight',
    'Find natural light — avoid deep shadow.'),
  [CHECKLIST_ITEM.CENTER_SUBJECT]:    _msg('scan.checklist.centerSubject',
    'Center the affected part of the leaf in the frame.'),
  [CHECKLIST_ITEM.HOLD_STEADY]:       _msg('scan.checklist.holdSteady',
    'Hold the phone steady — let it focus for a second.'),
  [CHECKLIST_ITEM.CAPTURE_UNDERSIDE]: _msg('scan.checklist.captureUnderside',
    'For pests, capture the underside of the leaf too.'),
  [CHECKLIST_ITEM.REMOVE_GLOVES]:     _msg('scan.checklist.removeGloves',
    'If you wear gloves, remove them so they do not block the lens.'),
  [CHECKLIST_ITEM.SHADE_HARSH_SUN]:   _msg('scan.checklist.shadeHarsh',
    'Step into shade if the sun is washing out the colour.'),
});

/**
 * @param {object} [ctx]
 * @returns {Array<object>}
 */
export function captureChecklistFor(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const kind = _str(c.suspectedKind);
    const out = [
      { ..._COPY[CHECKLIST_ITEM.MOVE_CLOSER] },
      { ..._COPY[CHECKLIST_ITEM.IMPROVE_LIGHT] },
      { ..._COPY[CHECKLIST_ITEM.CENTER_SUBJECT] },
      { ..._COPY[CHECKLIST_ITEM.HOLD_STEADY] },
    ];
    if (kind === 'pest' || kind === 'pest_damage') {
      out.push({ ..._COPY[CHECKLIST_ITEM.CAPTURE_UNDERSIDE] });
    }
    // Conditional hints — only show if we can infer a likely cause.
    if (c.brightness && Number(c.brightness) > 0.85) {
      out.push({ ..._COPY[CHECKLIST_ITEM.SHADE_HARSH_SUN] });
    }
    return out;
  } catch { return [{ ..._COPY[CHECKLIST_ITEM.HOLD_STEADY] }]; }
}

const _module = { CHECKLIST_ITEM, captureChecklistFor };
export default _module;
