/**
 * scanIntelligence.js — Phase 2 architecture interface.
 *
 * STATUS: STUB. Returns structured data only, NO UI text, NO
 * network calls. Not imported yet. Designed API-ready: the wiring
 * PR can replace the mock with a real inference call without
 * changing the shape.
 *
 * Purpose: consolidate the scattered scan-result mapping logic
 * (probability → severity bucket, severity → recommendation key,
 * organic/conventional treatment branch) behind one entrypoint.
 *
 * Output shape uses the typed model defined in
 * ./cropHealthResult.js so the data contract is single-sourced.
 */

import { createEmptyCropHealthResult } from './cropHealthResult.js';

/**
 * @typedef {object} ScanInput
 * @property {string}   [imageBase64]      raw image (when calling a real API)
 * @property {object}   [contextCrop]      crop hint from farm context
 * @property {string}   [country]
 * @property {string}   [stage]
 * @property {boolean}  [organicPreferred] true → recommendationKey biased to organic
 *
 * @typedef {import('./cropHealthResult.js').CropHealthResult} CropHealthResult
 */

/**
 * Analyze a scan input. Currently returns an empty-shape result —
 * the wiring PR replaces this implementation with the real inference
 * pipeline. The shape contract MUST stay stable so UI code can
 * begin consuming the model now.
 *
 * @param {ScanInput} input
 * @returns {Promise<CropHealthResult>}
 */
export async function analyzeScan(input = {}) {
  const out = createEmptyCropHealthResult();
  out.cropDetected     = (input.contextCrop && input.contextCrop.code) || null;
  out.confidence       = 0;
  out.issueDetected    = null;
  out.severity         = null;
  out.recommendationKey = 'scan.recommendation.unknown';
  out.organicOptionKey = input.organicPreferred ? 'scan.organic.placeholder' : null;
  out.safetyWarningKey = null;
  out.nextStepKey      = 'scan.nextStep.captureAnother';
  out.providerLabel    = 'stub';
  out.providerVersion  = SCAN_INTELLIGENCE_VERSION;
  out.timestamp        = new Date().toISOString();
  return out;
}

/**
 * Pure helper: bucket a 0..1 confidence into the discrete severity
 * the UI uses. Exposed so a real inference call (Plant.id / PlantNet /
 * OpenAI vision) can ship its own confidence and reuse the bucketing.
 *
 * @param {number} c
 * @returns {'low'|'medium'|'high'|null}
 */
export function bucketSeverityFromConfidence(c) {
  if (typeof c !== 'number' || Number.isNaN(c)) return null;
  if (c >= 0.85) return 'high';
  if (c >= 0.60) return 'medium';
  if (c >= 0.30) return 'low';
  return null;
}

export const SCAN_INTELLIGENCE_VERSION = '0.1.0-stub';
