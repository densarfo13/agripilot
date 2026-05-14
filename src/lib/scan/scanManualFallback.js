/**
 * scanManualFallback — calm result envelope returned when the
 * AI inference pipeline fails OR exhausts its retry budget.
 *
 *   import { buildManualFallbackResult } from
 *     '../lib/scan/scanManualFallback.js';
 *
 *   const result = buildManualFallbackResult({
 *     crop:        'tomato',
 *     stage:       'inference',
 *     imageQualityScore: 0.62,
 *   });
 *
 * Why this exists
 *   The Scan Pipeline Timeout Audit asks for a graceful
 *   fallback path: when the AI inference can't return, the
 *   user must still see:
 *     - the detected crop
 *     - an image-quality score
 *     - calm retry guidance
 *     - manual symptom selection options
 *   Never a dead-end "scan failed" screen.
 *
 *   The envelope mirrors the shape ScanResultCard already
 *   consumes (possibleIssue / confidence / recommendedActions /
 *   suggestedTasks) so wiring this in is a one-line setResult
 *   call — no UI changes required.
 *
 * Strict-rule audit
 *   * Pure function. Never throws. Frozen output.
 *   * No PII. No network. SSR-safe.
 *   * NO fake AI certainty — confidence is locked to 'low'
 *     and the copy uses hedged language ("we couldn't analyze
 *     this photo, here are common possibilities to check").
 */

export const MANUAL_FALLBACK_SYMPTOMS = Object.freeze([
  { id: 'leaf_yellowing',  label: 'Yellowing leaves' },
  { id: 'leaf_spots',      label: 'Spots on leaves' },
  { id: 'wilting',         label: 'Wilting' },
  { id: 'holes',           label: 'Holes or chewed leaves' },
  { id: 'discoloration',   label: 'Unusual color or stripes' },
  { id: 'stunted_growth',  label: 'Stunted growth' },
  { id: 'looks_healthy',   label: 'Looks healthy to me' },
]);

const FALLBACK_ACTIONS = Object.freeze([
  'Take another photo close to a leaf showing the issue.',
  'Use bright daylight and steady hands.',
  'Pick a symptom from the list below if the photo cannot be reanalyzed.',
]);

function _safeStr(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function _normaliseScore(value) {
  if (!Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 100) / 100;
}

function _qualityLabel(score) {
  if (score == null) return 'Image quality could not be measured.';
  if (score >= 0.75) return 'Photo looks clear.';
  if (score >= 0.45) return 'Photo is usable but could be clearer.';
  return 'Photo is blurry or dimly lit — a brighter retake will help.';
}

function _stageCopy(stage) {
  const s = _safeStr(stage) || 'unknown';
  if (s === 'compression') return 'We could not prepare this photo for analysis.';
  if (s === 'upload')      return 'We could not send this photo to the server.';
  if (s === 'inference')   return 'The analyzer is taking longer than usual.';
  if (s === 'parsing')     return 'The server response could not be read.';
  if (s === 'network')     return 'You appear to be offline.';
  return 'We could not analyze this photo right now.';
}

/**
 * Build the manual-fallback scan result envelope.
 *
 * @param {object} [input]
 * @param {string} [input.crop]
 * @param {string} [input.stage]               which pipeline stage failed
 * @param {number} [input.imageQualityScore]   0-1 inclusive, if known
 * @param {string} [input.scanId]
 * @returns {object} frozen ScanResult-shaped envelope
 */
export function buildManualFallbackResult(input) {
  try {
    const safe = (input && typeof input === 'object') ? input : {};
    const crop  = _safeStr(safe.crop) || 'crop';
    const stage = _safeStr(safe.stage) || 'unknown';
    const score = _normaliseScore(safe.imageQualityScore);
    const qualityNote = _qualityLabel(score);
    const stageNote   = _stageCopy(stage);
    const scanId = _safeStr(safe.scanId) || ('scan_fb_' + Date.now().toString(36));

    return Object.freeze({
      scanId,
      possibleIssue:      `${stageNote} Pick a symptom below if your ${crop} needs urgent attention.`,
      confidence:         'low',
      explanation:        qualityNote,
      recommendedActions: FALLBACK_ACTIONS.slice(),
      safetyWarning:      null,
      shouldSeekHelp:     false,
      suggestedTasks:     [],
      manualSymptoms:     MANUAL_FALLBACK_SYMPTOMS.slice(),
      imageQualityScore:  score,
      meta: Object.freeze({
        engine:     'manual_fallback',
        source:     'fallback',
        stage,
        cropName:   crop,
      }),
    });
  } catch {
    return Object.freeze({
      scanId:             'scan_fb_emergency',
      possibleIssue:      'We could not analyze this photo. Pick a symptom below to continue.',
      confidence:         'low',
      explanation:        'Image quality could not be measured.',
      recommendedActions: FALLBACK_ACTIONS.slice(),
      safetyWarning:      null,
      shouldSeekHelp:     false,
      suggestedTasks:     [],
      manualSymptoms:     MANUAL_FALLBACK_SYMPTOMS.slice(),
      imageQualityScore:  null,
      meta: Object.freeze({ engine: 'manual_fallback', source: 'fallback', stage: 'unknown' }),
    });
  }
}

const _module = {
  MANUAL_FALLBACK_SYMPTOMS,
  buildManualFallbackResult,
};
export default _module;
