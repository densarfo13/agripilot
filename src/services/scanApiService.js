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

const ENDPOINT = '/api/scan/analyze';
const TIMEOUT_MS = 8000;

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

  // Build a small, JSON-serializable payload. We never log the
  // image — keep it inside the request body only.
  const body = JSON.stringify({
    imageBase64: input.imageBase64 || null,
    imageUrl:    input.imageUrl    || null,
    cropId:      input.cropId      || null,
    plantName:   input.plantName   || null,
    country:     input.country     || null,
    experience:  input.experience  || 'generic',
    language:    input.language    || 'en',
  });

  let controller = null;
  try { controller = typeof AbortController !== 'undefined' ? new AbortController() : null; }
  catch { controller = null; }

  try {
    const fetchPromise = fetch(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'include',
      signal:   controller?.signal,
    });
    const res = await _withTimeout(fetchPromise, TIMEOUT_MS, controller);
    if (!res || !res.ok) return null;
    const json = await res.json().catch(() => null);
    return json && typeof json === 'object' ? json : null;
  } catch {
    return null;
  }
}

export default { requestScanAnalysis };
