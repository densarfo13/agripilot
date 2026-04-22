/**
 * cropDetector.js — crop-type classification foundation.
 *
 * PURPOSE
 *   Provide a clean, pluggable pipeline so a real classifier (TFLite,
 *   Teachable Machine, a server-side endpoint, or any hosted ML API)
 *   can be dropped in later without rewriting the UI.
 *
 * NOT IN SCOPE
 *   • Disease / pest detection — that's a different model family.
 *     Farroway has `src/engine/cameraDiagnosis.js` for scan-based
 *     pest/disease workflows; this file is strictly crop-type
 *     recognition.
 *   • Any actual ML inference. v1 ships the `heuristic` provider,
 *     which returns a low-confidence best-effort guess (or a
 *     "cannot tell" signal). Swapping providers is a one-liner.
 *
 * CONTRACT
 *   detectCrop(imageInput, options?) →
 *     Promise<{
 *       candidates: Array<{
 *         cropKey:    canonical crop key (e.g. 'maize') or null,
 *         label:      human-readable label in the UI language,
 *         confidence: 0..1 (never exaggerated for the heuristic),
 *       }>,
 *       best:       candidate | null,    // top candidate OR null if confidence is too low
 *       provider:   'heuristic' | 'tflite' | 'server' | ...,
 *       reason:     string,               // why this result (for the UI "why?" bubble)
 *       meta:       { filename?, mimeType?, sizeBytes?, tookMs }
 *     }>
 *
 *   Providers that legitimately cannot identify the crop MUST return
 *   `best: null` so the UI falls through to manual picker. We do not
 *   fake confidence.
 *
 * USAGE
 *   const result = await detectCrop(fileOrBlob);
 *   if (result.best && result.best.confidence >= 0.6) {
 *     // high confidence — suggest the crop with a "confirm?" prompt
 *   } else {
 *     // low confidence — show manual picker; surface candidates[] as hints
 *   }
 */

import { getActiveProvider } from './providers/index.js';

const MIN_CONFIDENT = 0.6;

/**
 * detectCrop(imageInput, options?)
 *
 *   imageInput: File | Blob | { dataUrl: string } | { url: string }
 *   options:    { provider?: string, language?: string, hints?: { filename?: string } }
 */
export async function detectCrop(imageInput, options = {}) {
  if (!imageInput) {
    return Object.freeze({
      candidates: Object.freeze([]),
      best: null,
      provider: 'none',
      reason: 'no_image_input',
      meta: Object.freeze({ tookMs: 0 }),
    });
  }

  const started = now();
  const provider = getActiveProvider(options.provider);
  const meta = extractMeta(imageInput);

  let raw = null;
  let error = null;
  try {
    raw = await provider.detect(imageInput, { ...options, meta });
  } catch (err) {
    error = err;
  }

  const tookMs = Math.max(0, Math.round(now() - started));

  if (error || !raw) {
    return Object.freeze({
      candidates: Object.freeze([]),
      best: null,
      provider: provider.name,
      reason: error ? `provider_error:${error.message || 'unknown'}` : 'no_result',
      meta: Object.freeze({ ...meta, tookMs }),
    });
  }

  // Normalise provider output.
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  const normalised = Object.freeze(candidates.map((c) => Object.freeze({
    cropKey:   c.cropKey || null,
    label:     c.label || null,
    confidence: clamp01(c.confidence),
  })));

  const topByConfidence = [...normalised].sort((a, b) => b.confidence - a.confidence);
  const top = topByConfidence[0] || null;
  const best = top && top.confidence >= MIN_CONFIDENT ? top : null;

  return Object.freeze({
    candidates: normalised,
    best,
    provider: provider.name,
    reason: raw.reason || (best ? 'confident_match' : 'low_confidence'),
    meta: Object.freeze({ ...meta, tookMs }),
  });
}

/**
 * identify(imageInput, options?) — convenience wrapper that returns
 *   only the best candidate (or null). Keeps the call site tidy
 *   when callers only care about a single answer.
 */
export async function identify(imageInput, options = {}) {
  const r = await detectCrop(imageInput, options);
  return r.best;
}

// ─── Helpers ──────────────────────────────────────────────────────
function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function now() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now();
  return Date.now();
}

function extractMeta(input) {
  try {
    if (input && typeof input.name === 'string') {
      return {
        filename:  input.name,
        mimeType:  input.type || null,
        sizeBytes: Number.isFinite(input.size) ? input.size : null,
      };
    }
  } catch (_) { /* no-op */ }
  return {};
}

export const _internal = Object.freeze({ MIN_CONFIDENT, clamp01 });
