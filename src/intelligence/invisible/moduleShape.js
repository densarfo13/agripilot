/**
 * moduleShape.js — canonical shape every invisible-intelligence
 * module returns.
 *
 *   {
 *     signal:           string,           // module-specific kind
 *     confidence:       'high'|'medium'|'low'|null,
 *     farmerMessage:    string,            // plain-language line for UI
 *     recommendedAction: string|null,     // imperative phrase or null
 *     urgency:          'high'|'medium'|'low'|null,
 *     source:           string,            // module name + data origin
 *     visibleToUser:    boolean,           // honest gate — set false
 *                                         // when no real backing data
 *   }
 *
 * Why a canonical shape
 * ─────────────────────
 *   Eight modules feed the nextBestActionOrchestrator. If every
 *   module returns a different shape, the orchestrator becomes the
 *   place where N×8 adapter code lives — exactly the kind of
 *   complexity the "Complexity belongs in the engine, clarity belongs
 *   in the interface" rule pushes us to avoid.
 *
 *   The canonical shape lets the orchestrator + UI compose modules
 *   uniformly. visibleToUser is the strict gate that satisfies the
 *   "Trust + Safety: never show fake X" rule — when a module has no
 *   real backing data, it returns visibleToUser:false and the
 *   caller skips rendering rather than fabricating.
 */

/**
 * Quiet fallback factory. Use this when a module has no real
 * backing data to honour the spec's "If data unavailable: return
 * quiet fallback. Do not clutter UI" rule.
 *
 * @param {string} sourceName
 * @param {string} farmerMessage — what to show IF the user surface
 *                                  intentionally renders quiet-state
 *                                  hints (most won't).
 * @returns {object}
 */
export function makeQuietFallback(sourceName, farmerMessage) {
  return Object.freeze({
    signal:            null,
    confidence:        null,
    farmerMessage:     farmerMessage || '',
    recommendedAction: null,
    urgency:           null,
    source:            String(sourceName || 'unknown'),
    visibleToUser:     false,
  });
}

/**
 * Active signal factory. Use this when the module has real
 * backing data and an actual signal to surface.
 *
 * @param {object} input
 * @returns {object}
 */
export function makeActiveSignal(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const confidence = _normConfidence(safe.confidence);
  const urgency    = _normUrgency(safe.urgency);
  const message    = String(safe.farmerMessage || '').trim();
  return Object.freeze({
    signal:            String(safe.signal || 'unknown'),
    confidence,
    farmerMessage:     message,
    recommendedAction: safe.recommendedAction ? String(safe.recommendedAction) : null,
    urgency,
    source:            String(safe.source || 'unknown'),
    visibleToUser:     !!safe.visibleToUser && !!message,
  });
}

function _normConfidence(v) {
  const s = String(v || '').toLowerCase().trim();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return null;
}

function _normUrgency(v) {
  const s = String(v || '').toLowerCase().trim();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return null;
}

export default { makeQuietFallback, makeActiveSignal };
