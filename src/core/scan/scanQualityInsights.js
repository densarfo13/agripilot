/**
 * scanQualityInsights.js — read-only scan-quality analytics (v2 §2).
 *
 *   import { computeScanQualityInsights }
 *     from 'src/core/scan/scanQualityInsights.js';
 *
 * What it is
 * ──────────
 *   A pure VIEW over the analytics event log that surfaces WHY
 *   scans fail — blurry / dark photos, repeated retakes, manual
 *   fallback usage, crop mismatch, low-confidence results — so the
 *   pilot team can fix the actual friction (lighting guidance,
 *   problem crops, problem devices).
 *
 *   This is NOT a learning model and NOT fake ML. It counts real
 *   recorded events. The "training loop" is human: operators read
 *   these insights and improve guidance.
 *
 * Strict-rule audit
 *   • Pure. Never throws. Takes events as an argument (testable) —
 *     no I/O inside.
 */

// Event names this view understands (subset of RETENTION_EVENTS +
// generic scan events). Any string is tolerated.
const _str = (v) => String(v == null ? '' : v).toLowerCase();

function _safeArr(events) {
  return Array.isArray(events) ? events.filter(Boolean) : [];
}

/** Top-N entries of a count map, as a sorted [{key,count}] list. */
function _topN(map, n) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * Compute scan-quality insights from an event array.
 *
 * Each event is read defensively: `{ name, payload }` where the
 * payload MAY carry `reason` ('blurry'|'dark'|...), `crop`,
 * `device`, `retake` (bool), `manualFallback` (bool),
 * `cropMismatch` (bool), `confidence` (0-1 or 'low').
 *
 * @param {Array<object>} events
 * @returns {object}
 */
export function computeScanQualityInsights(events) {
  try {
    const list = _safeArr(events);
    let scanTotal = 0;
    let blurry = 0;
    let dark = 0;
    let retakes = 0;
    let manualFallback = 0;
    let cropMismatch = 0;
    let lowConfidence = 0;
    const reasonMap = new Map();
    const cropFail = new Map();
    const deviceFail = new Map();

    for (const e of list) {
      const name = _str(e.name || e.type);
      const p = (e.payload && typeof e.payload === 'object') ? e.payload : {};
      const isScan = name.startsWith('scan_');
      if (name === 'scan_completed' || name === 'scan_failed') scanTotal += 1;

      const reason = _str(p.reason);
      if (reason === 'blurry' || reason === 'blur') blurry += 1;
      if (reason === 'dark' || reason === 'too_dark' || reason === 'low_light') dark += 1;
      if (reason) reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);

      if (p.retake === true || name === 'scan_retake') retakes += 1;
      if (p.manualFallback === true || name === 'scan_manual_fallback') manualFallback += 1;
      if (p.cropMismatch === true) cropMismatch += 1;

      const conf = p.confidence;
      const lowConf = (typeof conf === 'string' && _str(conf) === 'low')
        || (typeof conf === 'number' && conf < 0.6);
      if (lowConf) lowConfidence += 1;

      // Attribute failures / problems to crop + device buckets.
      const isProblem = name === 'scan_failed' || lowConf
        || p.retake === true || p.cropMismatch === true || p.manualFallback === true;
      if (isScan && isProblem) {
        const crop = _str(p.crop);
        if (crop) cropFail.set(crop, (cropFail.get(crop) || 0) + 1);
        const device = _str(p.device || p.deviceModel || p.browser);
        if (device) deviceFail.set(device, (deviceFail.get(device) || 0) + 1);
      }
    }

    const failurePatterns = _topN(reasonMap, 6);

    return {
      scanTotal,
      blurry,
      dark,
      retakes,
      manualFallback,
      cropMismatch,
      lowConfidence,
      failurePatterns,                          // [{key,count}]
      topProblematicCrops:   _topN(cropFail, 5),
      topProblematicDevices: _topN(deviceFail, 5),
    };
  } catch {
    return {
      scanTotal: 0, blurry: 0, dark: 0, retakes: 0, manualFallback: 0,
      cropMismatch: 0, lowConfidence: 0, failurePatterns: [],
      topProblematicCrops: [], topProblematicDevices: [],
    };
  }
}

const _module = { computeScanQualityInsights };
export default _module;
