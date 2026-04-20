/**
 * assistiveMode.js — Section 6. A display-behaviour layer for
 * low-literacy users.
 *
 * Rules:
 *   • it's a mode FLAG, not a second product
 *   • affects how LocalizedPayloads are RESOLVED:
 *       – prefers `.assistiveKey` over `.key` when present
 *       – strips secondary copy to the shortest available variant
 *   • does NOT change data; does not change engines
 *
 * A mode-aware payload looks like:
 *   {
 *     key:          'home.task.prepare_land',
 *     assistiveKey: 'home.task.prepare_land.short',   // shorter copy
 *     params:       { crop: 'MAIZE' },
 *     icon:         'earth',
 *   }
 *
 * Pure — no React, no storage. Read the current mode from whatever
 * context you keep it in (e.g. UserModeContext) and pass it here.
 */

import { makeLocalizedPayload } from './localizedPayload.js';

export const ASSISTIVE = 'assistive';
export const NORMAL    = 'normal';

export function isAssistiveMode(mode) {
  return mode === ASSISTIVE;
}

/**
 * resolveAssistivePayload — project an input payload into the
 * variant appropriate for the caller's mode.
 *
 *   mode: 'normal'    → return payload unchanged
 *   mode: 'assistive' → prefer assistiveKey if present, else key
 */
export function resolveAssistivePayload(payload, mode = NORMAL) {
  if (!payload || typeof payload !== 'object') return payload;
  if (mode !== ASSISTIVE) {
    // Preserve original shape unchanged.
    return payload;
  }
  const key = payload.assistiveKey || payload.key;
  if (!key) return payload;
  // Strip secondary fields that tend to bloat low-literacy screens.
  const { key: _k, assistiveKey: _a, secondary: _s, ...rest } = payload;
  return makeLocalizedPayload(key, rest.params || {}, {
    ...rest,
    mode: ASSISTIVE,
  });
}

/**
 * simplifyText — rough, locale-agnostic text shortener used as a
 * last resort when no `.assistiveKey` variant is available. Cuts
 * off at the first sentence boundary and caps length.
 *
 * This is a PRESENTATION helper for when a translation is missing
 * the short form; the real fix is to add `.short` keys in i18n.
 */
export function simplifyText(text, { maxChars = 80 } = {}) {
  if (typeof text !== 'string') return '';
  // Prefer ending at a sentence boundary when within range.
  const slice = text.slice(0, maxChars + 40);
  const firstStop = slice.search(/[.!?]\s|[\u3002]/);
  if (firstStop > 0 && firstStop <= maxChars) {
    return slice.slice(0, firstStop + 1);
  }
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1).trimEnd() + '\u2026';
}

/**
 * assistiveLayout — render hints. Consumers pass these to the
 * card component to turn on bigger tap targets, stronger icons,
 * and fewer secondary elements.
 */
export function assistiveLayout(mode = NORMAL) {
  const on = mode === ASSISTIVE;
  return Object.freeze({
    showVoiceButton:    on ? 'prominent' : 'optional',
    showSecondaryInfo:  !on,
    minTapTargetPx:     on ? 56 : 44,
    maxTextLengthChars: on ? 80 : 240,
  });
}
