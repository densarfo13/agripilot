/**
 * scanApiService.js — async wrapper over the (future)
 * `/api/scan/analyze` endpoint.
 *
 * Position
 * ────────
 * Sister to `services/fundingService.js` — local-first today,
 * future-proofed for a server swap. The detection engine
 * (`core/scanDetectionEngine.js`) calls `requestScanAnalysis`
 * here; if the feature flag is off OR the API errors, the
 * engine falls back to its rule-based answer. UI surfaces
 * never need to know which path served the result.
 *
 * Strict-rule audit
 *   • Async-by-default so the future migration is a transparent swap.
 *   • Never throws; rejected fetches return `null` so the engine
 *     can fall through cleanly.
 *   • Behind feature flag `scanApiEnabled` — flag-off path does
 *     NOT make the network call.
 *   • Per-call timeout (8s) so a hung server can't lock the UI.
 */

import { isFeatureEnabled } from '../config/features.js';
import {
  logScanStage, logScanPipelineError, SCAN_STAGES,
} from '../lib/scan/scanPipelineLogger.js';

const ENDPOINT = '/api/scan/analyze';
// Field fix (dbg footer: src=fallback_15s_timer, 2026-07-16): 8s was the
// TOTAL budget including the multi-MB base64 photo UPLOAD. On the target
// market's networks (rural 2G/3G, weak cellular, relay proxies) the upload
// alone can exceed 8s, so the client aborted its OWN successful request —
// the server completed + logged 200 while the phone showed the fallback.
// 30s upload-inclusive budget; the analyzing surface owns progress messaging.
const TIMEOUT_MS = 30000;
// Scan Pipeline Timeout Audit — separate budget for body parsing.
// The previous code awaited res.json() with NO timeout; a slow
// server stream produced the indefinite "taking longer than
// expected" stall. 3s is the canonical parsing ceiling.
const PARSE_TIMEOUT_MS = 8000;   // body is ~12KB, but slow links stream it slowly

function _withTimeout(promise, ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { signal?.abort(); } catch { /* ignore */ }
      reject(new Error('timeout'));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Send a scan analysis request to the backend. Returns `null` on
 * any failure (no API enabled, network error, non-2xx response,
 * unparseable JSON). The detection engine treats null as "fall
 * back to rules".
 *
 * @param {object} input
 * @param {string} [input.imageBase64]
 * @param {string} [input.imageUrl]
 * @param {string} [input.cropId]
 * @param {string} [input.plantName]
 * @param {string} [input.country]
 * @param {string} [input.experience]
 * @param {string} [input.language]
 * @returns {Promise<object|null>}
 */
export async function requestScanAnalysis(input = {}) {
  if (!isFeatureEnabled('scanApiEnabled')) return null;
  if (typeof fetch === 'undefined') return null;

  // Build a JSON-serializable payload. We never log the image —
  // it stays inside the request body only.
  //
  // Body shape mirrors the backend's /api/scan/analyze contract:
  // weather, region, cropName, activeExperience are all read by
  // contextFusionEngine on the server to layer environmental
  // context onto the image-only inference. Missing fields fall
  // back to safe defaults — the backend never fakes signals.
  const body = JSON.stringify({
    imageBase64:      input.imageBase64 || null,
    imageUrl:         input.imageUrl    || null,
    // Both naming conventions sent so the backend route handler
    // can read either. cropId is the legacy alias; cropName is
    // what the contextFusionEngine actually consumes.
    cropId:           input.cropId      || null,
    cropName:         input.cropName    || input.cropId   || null,
    plantName:        input.plantName   || null,
    country:          input.country     || null,
    region:           input.region      || null,
    experience:       input.experience  || 'generic',
    activeExperience: input.activeExperience || input.experience || 'generic',
    language:         input.language    || 'en',
    // Weather snapshot — optional. When present, the backend
    // contextFusionEngine raises confidence when image + weather
    // agree, and surfaces a "weather-related caution" line. When
    // absent, the engine treats the image as the only signal.
    weather:          input.weather     || null,
  });

  let controller = null;
  try { controller = typeof AbortController !== 'undefined' ? new AbortController() : null; }
  catch { controller = null; }

  const t0 = logScanStage(SCAN_STAGES.INFERENCE_STARTED, {
    size: typeof body === 'string' ? body.length : null,
  });
  try {
    const fetchPromise = fetch(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'include',
      signal:   controller?.signal,
    });
    const res = await _withTimeout(fetchPromise, TIMEOUT_MS, controller);
    if (!res || !res.ok) {
      // A 429 daily-scan-limit is a REAL terminal state, not an inference
      // failure. Preserve its reason so the UI shows a clear "limit reached"
      // message instead of returning null → the engine's rule-based
      // "can't identify" fallback (silent result loss).
      if (res && res.status === 429) {
        const q = await _withTimeout(res.json().catch(() => null), PARSE_TIMEOUT_MS, controller)
          .catch(() => null);
        if (q && (q.error === 'scan_limit_reached' || q.limit != null || q.resetAt)) {
          logScanPipelineError('inference', { message: 'scan_limit_reached' });
          return {
            __terminalState:  'LIMIT_REACHED',
            scanLimitReached: true,
            plan:      typeof q.plan === 'string' ? q.plan : null,
            limit:     typeof q.limit === 'number' ? q.limit : null,
            used:      typeof q.used === 'number' ? q.used : null,
            remaining: typeof q.remaining === 'number' ? q.remaining : 0,
            resetsAt:  q.resetsAt || q.resetAt || null,
            resetAt:   q.resetsAt || q.resetAt || null,
            message:   typeof q.message === 'string' ? q.message : null,
          };
        }
      }
      logScanPipelineError('inference', {
        message: 'http_' + (res && res.status),
      });
      return null;
    }
    // Bound the body-parse independently. A slow JSON stream
    // used to surface as the indefinite "taking longer than
    // expected" stall because the fetch itself succeeded but
    // res.json() awaited forever.
    const json = await _withTimeout(
      res.json().catch(() => null),
      PARSE_TIMEOUT_MS,
      controller,
    ).catch((err) => {
      logScanPipelineError('parsing', err);
      return null;
    });
    // Boundary trace (candidate-handoff repair, req 2): candidate counts at the
    // FIRST client boundary, keyed by scanId, so a lost candidate can be pinned
    // to provider→API vs a later client transform. Counts only — never image data.
    const _cc = json && Array.isArray(json.confirmationCandidates) ? json.confirmationCandidates.length : 0;
    const _tc = json && Array.isArray(json.topCandidates) ? json.topCandidates.length : 0;
    logScanStage(SCAN_STAGES.INFERENCE_RESPONSE, {
      durationMs:      (Date.now() - t0),
      outcome:         json ? 'ok' : 'empty',
      scanId:          (json && json.scanId) || null,
      state:           (json && json.identificationState) || null,
      confirmCands:    _cc,
      topCands:        _tc,
    });
    try {
      console.info('[scan.trace] api.response scanId=' + ((json && json.scanId) || '-')
        + ' state=' + ((json && json.identificationState) || '-')
        + ' confirmCands=' + _cc + ' topCands=' + _tc);
    } catch { /* swallow */ }
    return json && typeof json === 'object' ? json : null;
  } catch (err) {
    logScanPipelineError('inference', err);
    return null;
  }
}

export default { requestScanAnalysis };
