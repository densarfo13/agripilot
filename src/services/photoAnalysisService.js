/**
 * photoAnalysisService.js — POST /api/photo/analyze with a
 * localStorage-friendly fallback.
 *
 * Strict-rule audit
 *   • The service ALWAYS routes through the safe rule-based
 *     engine when the backend is disabled or errors out — the
 *     UI never sees a fake-confident result.
 *   • FEATURE_OPEN_AI_DIAGNOSIS gates the actual fetch. While
 *     it's off, the service short-circuits to the engine so
 *     the rest of the flow (preview / result card / scan
 *     history) keeps working end-to-end.
 *
 * Backend contract (when it lands):
 *   POST /api/photo/analyze
 *   {
 *     farmId, cropId, language, question, imageBase64
 *   }
 *   → { possibleIssue, confidence, recommendedAction,
 *       safetyWarning, seekHelp, localizedResponse }
 */

import { analyzePhoto } from '../utils/photoAnalysisEngine.js';
import { isFeatureEnabled } from '../utils/featureFlags.js';
import { logEvent, EVENT_TYPES } from '../data/eventLogger.js';

function backendEnabled() {
  if (!isFeatureEnabled('FEATURE_OPEN_AI_DIAGNOSIS')) return false;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_PHOTO_API === '1'
        || import.meta.env.VITE_PHOTO_API === 'true';
    }
  } catch { /* SSR */ }
  return false;
}

async function safeFetch(input, init) {
  try {
    const res = await fetch(input, init);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw Object.assign(new Error('HTTP ' + res.status),
        { status: res.status, body });
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  } catch (err) {
    return { _failed: true, error: err };
  }
}

/**
 * analyzePhotoRequest — caller-friendly entry point. ALWAYS
 * resolves with a result object (never throws), so the UI can
 * stay simple.
 *
 * @returns {Promise<{
 *   possibleIssue, confidence, recommendedAction,
 *   safetyWarning, seekHelp, localizedResponse,
 *   source: 'backend' | 'engine' | 'engine-fallback',
 * }>}
 */
export async function analyzePhotoRequest({
  farmId = null,
  cropId = null,
  language = 'en',
  question,
  imageBase64 = null,
  imageHint = null,
} = {}) {
  // Always log the request for telemetry — the admin "Crop
  // Scan Intelligence" card reads from these events.
  try {
    logEvent(EVENT_TYPES.PHOTO_ANALYZE_REQUESTED || 'photo_analyze_requested', {
      farmId, cropId, language, question,
      hasImage: !!imageBase64,
    });
  } catch { /* swallow */ }

  // Engine-only path when the backend is disabled.
  if (!backendEnabled()) {
    const engine = analyzePhoto({ questionId: question, language, cropId, imageHint });
    return { ...engine, source: 'engine' };
  }

  // Backend path. We still call the engine on failure so the
  // UI is never blocked by a flaky network.
  const result = await safeFetch('/api/photo/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      farmId, cropId, language, question, imageBase64,
    }),
  });
  if (!result || result._failed) {
    const engine = analyzePhoto({ questionId: question, language, cropId, imageHint });
    return { ...engine, source: 'engine-fallback' };
  }

  // Defensive normalisation — if the backend response is
  // missing fields the UI expects, fill them in with safe
  // defaults rather than rendering blanks.
  const normalised = {
    possibleIssue:     String(result.possibleIssue || '').trim() || 'Possible issue detected.',
    confidence:        ['low', 'medium', 'high'].includes(result.confidence) ? result.confidence : 'low',
    recommendedAction: String(result.recommendedAction || '').trim(),
    safetyWarning:     result.safetyWarning ? String(result.safetyWarning) : null,
    seekHelp:          String(result.seekHelp || '').trim(),
    localizedResponse: String(result.localizedResponse || '').trim(),
    retakeRequested:   !!result.retakeRequested,
    source:            'backend',
  };
  return normalised;
}
