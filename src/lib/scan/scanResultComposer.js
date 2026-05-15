/**
 * scanResultComposer — single composer that turns the FSM
 * output + image quality report + optional manual symptom
 * pick into one consumable envelope for the result card,
 * the journal write, the follow-up task, and the dev trace.
 *
 *   import { composeScanResult, debugTraceScanResult } from
 *     '../lib/scan/scanResultComposer.js';
 *
 *   const envelope = composeScanResult({
 *     fsmCtx:         fsm.getState().ctx,
 *     qualityReport:  qualityReport,
 *     previewUrl:     preview.getUrl(),
 *     manualSelection: 'yellow_leaves',  // optional
 *     followUpChoice:  'check_again_tomorrow', // optional
 *     retryAttempts:  attemptCount,
 *     farmId:         farmCtx.activeFarmId,
 *     now:            Date.now(),
 *   });
 *   //   {
 *   //     render: { previewUrl, displayResult, confidence, guidance,
 *   //               manualSymptoms, allowSave, allowManualSelect,
 *   //               allowFollowUp, allowRetry, promote },
 *   //     persist: { journalEntry, followUpTask, scanHistoryEntry },
 *   //     debug:   { ...the [SCAN_RESULT_DEBUG] payload },
 *   //   }
 *
 *   debugTraceScanResult(envelope.debug);  // emits in dev only
 *
 * Why a composer
 *   ScanResultCard rendered raw analyser output + raw confidence,
 *   leaving every page to reinvent:
 *     - which preview URL to render (blob vs remote vs fallback)
 *     - how to downgrade confidence on poor photo quality
 *     - which farmer-friendly guidance to surface
 *     - what shape to persist to the journal
 *     - which follow-up task to suggest
 *
 *   This module is the single SOURCE OF TRUTH that the result
 *   surface + the persistence layer consume. The host page just:
 *     1. calls composeScanResult once on transition into a
 *        terminal state
 *     2. renders envelope.render
 *     3. on user confirmation, writes envelope.persist via the
 *        existing scanHistoryStore + continuityEngine helpers
 *     4. on Save tap, dispatches envelope.persist.followUpTask
 *        through the existing scanToTask helper
 *
 * Strict-rule audit
 *   * Pure function. Frozen output. Never throws.
 *   * No DOM / storage / network — caller wires persistence.
 *   * Calm low-literacy guidance only (locked by test).
 *   * Manual fallback IS allowed at every confidence tier so
 *     the user is never dead-ended.
 *   * Preview URL falls back to a documented sentinel string
 *     when none is available — never null + never broken.
 */

import { resolveScanConfidence, CONFIDENCE_TIERS } from './scanConfidenceEngine.js';
import { buildQualityGuidance } from './scanImageQuality.js';
import { MANUAL_FALLBACK_SYMPTOMS } from './scanManualFallback.js';
import { REALISM_ASSETS } from '../realVisuals.jsx';

export const PREVIEW_FALLBACK = REALISM_ASSETS.heroes.farmDefault;

export const FOLLOW_UP_CHOICES = Object.freeze({
  CHECK_TOMORROW:    'check_again_tomorrow',
  RETAKE_IN_DAYLIGHT: 'retake_in_daylight',
  ADD_TASK:          'add_follow_up_task',
  NONE:              'none',
});

const _MS_PER_DAY = 24 * 60 * 60 * 1000;

function _safeStr(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function _firstStr(...vals) {
  for (const v of vals) {
    const s = _safeStr(v);
    if (s) return s;
  }
  return null;
}

function _renderablePreview(previewUrl, fsmCtx) {
  // Order matches the spec: local preview first, then any URL the
  // FSM captured from upload, then the canonical fallback. The
  // fallback ensures the <img src=> NEVER points at an empty
  // string (browsers render a broken icon for empty src).
  const local = _safeStr(previewUrl);
  if (local) return local;
  const fromFsm = _safeStr(
    fsmCtx && fsmCtx.result && (fsmCtx.result.imageUrl || fsmCtx.result.image_url),
  );
  if (fromFsm) return fromFsm;
  return PREVIEW_FALLBACK;
}

function _displayResult(fsmCtx, manualSelection) {
  // Manual symptom pick wins when present so the result card
  // surfaces what the FARMER chose, not the (failed) AI guess.
  if (manualSelection) {
    const sym = MANUAL_FALLBACK_SYMPTOMS.find((s) => s.id === manualSelection);
    if (sym) {
      return {
        title:       `Manual note: ${sym.label}`,
        summary:     `You marked the issue as "${sym.label}". This is saved to your journal.`,
        source:      'manual_fallback',
        symptomId:   sym.id,
        symptomLabel: sym.label,
      };
    }
  }
  const result = fsmCtx && fsmCtx.result;
  if (result && _safeStr(result.possibleIssue)) {
    return {
      title:   result.possibleIssue.trim(),
      summary: _safeStr(result.explanation) || _safeStr(result.summary) || '',
      source:  result.meta && result.meta.source === 'fallback'
                ? 'rule_based_fallback'
                : 'analyzer',
      recommendedActions: Array.isArray(result.recommendedActions)
                            ? result.recommendedActions.map(String)
                            : [],
    };
  }
  // No result + no manual pick = needs review.
  return {
    title:   'No clear result',
    summary: 'We could not clearly identify the issue. Retake the photo or pick a symptom below.',
    source:  'needs_review',
  };
}

function _guidanceFor(confidenceEnvelope, qualityReport, fsmCtx) {
  // Top priority — explicit image quality issue with calm copy.
  const qg = buildQualityGuidance(qualityReport);
  if (qg) return qg;
  // Confidence-tier specific copy.
  if (confidenceEnvelope.tier === CONFIDENCE_TIERS.NEEDS_REVIEW) {
    return 'Retake the photo or pick a symptom below.';
  }
  if (confidenceEnvelope.tier === CONFIDENCE_TIERS.LOW) {
    return 'Confidence is low. A clearer photo will help.';
  }
  if (confidenceEnvelope.tier === CONFIDENCE_TIERS.MODERATE) {
    return 'A clearer photo would confirm this result.';
  }
  // High — surface the first recommendedAction as the guidance.
  const result = fsmCtx && fsmCtx.result;
  if (result && Array.isArray(result.recommendedActions) && _safeStr(result.recommendedActions[0])) {
    return _safeStr(result.recommendedActions[0]);
  }
  return null;
}

function _journalEntry(input) {
  const { farmId, fsmCtx, qualityReport, confidence, manualSelection, previewUrl, now } = input;
  const result = fsmCtx && fsmCtx.result;
  const scanId = _firstStr(
    fsmCtx && fsmCtx.runId,
    result && result.scanId,
    'scan_' + (Number.isFinite(now) ? now.toString(36) : 'unknown'),
  );
  // Spec §5 — when the farmer made a manual selection it REPLACES
  // the AI summary in the journal entry so the saved record
  // reflects what the farmer chose, not the (failed) AI guess.
  const manualLabel = manualSelection
    ? (MANUAL_FALLBACK_SYMPTOMS.find((s) => s.id === manualSelection) || {}).label
    : null;
  return Object.freeze({
    scanId,
    farmId:        _safeStr(farmId),
    imageUrl:      _renderablePreview(previewUrl, fsmCtx),
    scanType:      _firstStr(result && result.scanType, 'crop_health'),
    summary:       _firstStr(manualLabel,
                              result && result.possibleIssue,
                              'Scan recorded.'),
    confidence:    confidence.tier,
    recommendedAction: _firstStr(
      result && Array.isArray(result.recommendedActions) && result.recommendedActions[0],
    ),
    manualSelection: _safeStr(manualSelection),
    qualityIssues:   (qualityReport && Array.isArray(qualityReport.issues))
                        ? qualityReport.issues.slice()
                        : [],
    createdAt:       Number.isFinite(now) ? new Date(now).toISOString() : new Date().toISOString(),
  });
}

function _followUpTask(input) {
  const { followUpChoice, fsmCtx, now, farmId } = input;
  const ch = _safeStr(followUpChoice);
  if (!ch || ch === FOLLOW_UP_CHOICES.NONE) return null;
  const at = Number.isFinite(now) ? now : Date.now();
  const dueAt = ch === FOLLOW_UP_CHOICES.RETAKE_IN_DAYLIGHT
                ? new Date(at + _MS_PER_DAY).toISOString()
                : new Date(at + _MS_PER_DAY).toISOString();
  const title = ch === FOLLOW_UP_CHOICES.RETAKE_IN_DAYLIGHT
                ? 'Retake the scan in daylight'
                : ch === FOLLOW_UP_CHOICES.CHECK_TOMORROW
                  ? 'Check the same area again tomorrow'
                  : 'Follow up on this scan';
  return Object.freeze({
    id:     'task_followup_' + at.toString(36),
    title,
    farmId: _safeStr(farmId),
    scanId: _safeStr(fsmCtx && fsmCtx.runId),
    dueAt,
    source: 'scan_follow_up',
  });
}

function _scanHistoryEntry(input, journal) {
  const { fsmCtx, previewUrl, confidence } = input;
  return Object.freeze({
    id:         journal.scanId,
    category:   _firstStr(fsmCtx && fsmCtx.result && fsmCtx.result.category, 'unknown'),
    noticed:    journal.summary,
    createdAt:  journal.createdAt,
    experience: 'farm',
    imageUrl:   _renderablePreview(previewUrl, fsmCtx),
    confidence: confidence.tier,
    taskAdded:  false,
  });
}

/**
 * Compose every output the scan-result surface + persistence
 * layer needs from one set of inputs. Pure, frozen, never throws.
 *
 * @param {object} input
 * @param {object} [input.fsmCtx]        FSM ctx snapshot
 * @param {object} [input.qualityReport] scanImageQuality output
 * @param {string} [input.previewUrl]    blob: or remote URL
 * @param {string} [input.manualSelection]  one of MANUAL_FALLBACK_SYMPTOMS ids
 * @param {string} [input.followUpChoice]   one of FOLLOW_UP_CHOICES
 * @param {number} [input.retryAttempts]
 * @param {string} [input.farmId]
 * @param {number} [input.now]
 * @returns {object} frozen { render, persist, debug }
 */
export function composeScanResult(input) {
  try {
    const safe = (input && typeof input === 'object') ? input : {};
    const confidence = resolveScanConfidence({
      apiConfidence: safe.fsmCtx && safe.fsmCtx.result && safe.fsmCtx.result.confidence,
      qualityReport: safe.qualityReport,
      retryAttempts: Number.isFinite(safe.retryAttempts) ? safe.retryAttempts : 0,
    });
    const display = _displayResult(safe.fsmCtx, safe.manualSelection);
    const guidance = _guidanceFor(confidence, safe.qualityReport, safe.fsmCtx);
    const previewUrl = _renderablePreview(safe.previewUrl, safe.fsmCtx);

    const render = Object.freeze({
      previewUrl,
      displayResult:     Object.freeze(display),
      confidence:        confidence.tier,
      reason:            confidence.reason,
      guidance:          guidance,
      manualSymptoms:    MANUAL_FALLBACK_SYMPTOMS.slice(),
      allowSave:         confidence.allowSave,
      allowManualSelect: confidence.allowManualSelect,
      allowFollowUp:     confidence.allowFollowUp,
      allowRetry:        confidence.allowRetry,
      promote:           confidence.promote,
    });

    const journal = _journalEntry({
      farmId:          safe.farmId,
      fsmCtx:          safe.fsmCtx,
      qualityReport:   safe.qualityReport,
      confidence,
      manualSelection: safe.manualSelection,
      previewUrl,
      now:             safe.now,
    });
    const followUp = _followUpTask({
      followUpChoice: safe.followUpChoice,
      fsmCtx:         safe.fsmCtx,
      farmId:         safe.farmId,
      now:            safe.now,
    });
    const scanHistory = _scanHistoryEntry({
      fsmCtx:     safe.fsmCtx,
      previewUrl,
      confidence,
    }, journal);

    const persist = Object.freeze({
      journalEntry:    journal,
      followUpTask:    followUp,
      scanHistoryEntry: scanHistory,
    });

    const debug = Object.freeze({
      imagePreviewExists: previewUrl !== PREVIEW_FALLBACK,
      imageUrl:           previewUrl,
      confidence:         confidence.tier,
      qualityFlags:       (safe.qualityReport && Array.isArray(safe.qualityReport.issues))
                            ? safe.qualityReport.issues.slice()
                            : [],
      savedToJournal:     true,   // composer hands the caller the journal entry;
                                  // caller writes via existing helpers
      followUpCreated:    followUp != null,
      manualSelection:    _safeStr(safe.manualSelection),
      retryAttempts:      Number.isFinite(safe.retryAttempts) ? safe.retryAttempts : 0,
    });

    return Object.freeze({ render, persist, debug });
  } catch {
    return _emptyEnvelope(input);
  }
}

function _emptyEnvelope(input) {
  const previewUrl = (input && input.previewUrl) || PREVIEW_FALLBACK;
  return Object.freeze({
    render: Object.freeze({
      previewUrl,
      displayResult: Object.freeze({
        title:   'No clear result',
        summary: 'Retake the photo or pick a symptom below.',
        source:  'needs_review',
      }),
      confidence:        CONFIDENCE_TIERS.NEEDS_REVIEW,
      reason:            'This needs a closer look.',
      guidance:          'Retake the photo or pick a symptom below.',
      manualSymptoms:    MANUAL_FALLBACK_SYMPTOMS.slice(),
      allowSave:         true,
      allowManualSelect: true,
      allowFollowUp:     true,
      allowRetry:        true,
      promote:           'manual_select',
    }),
    persist: Object.freeze({
      journalEntry:    null,
      followUpTask:    null,
      scanHistoryEntry: null,
    }),
    debug: Object.freeze({
      imagePreviewExists: false,
      imageUrl:           previewUrl,
      confidence:         CONFIDENCE_TIERS.NEEDS_REVIEW,
      qualityFlags:       [],
      savedToJournal:     false,
      followUpCreated:    false,
      manualSelection:    null,
      retryAttempts:      0,
    }),
  });
}

/**
 * Dev-only trace — emits a single tagged line so ops can grep
 * [SCAN_RESULT_DEBUG] for the per-result envelope. No-op in
 * production builds.
 */
export function debugTraceScanResult(debug) {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env || !import.meta.env.DEV) return;
    if (!debug || typeof debug !== 'object') return;

    console.log('[SCAN_RESULT_DEBUG]', debug);
  } catch { /* swallow */ }
}

const _module = {
  PREVIEW_FALLBACK,
  FOLLOW_UP_CHOICES,
  composeScanResult,
  debugTraceScanResult,
};
export default _module;
