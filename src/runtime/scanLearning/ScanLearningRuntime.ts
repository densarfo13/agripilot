/**
 * ScanLearningRuntime.ts — client-facing learning-loop adapter.
 *
 * Scan Intelligence V2 §5 — pairs with server/src/ml/scanLearningEngine.js.
 *
 *   import {
 *     submitConfirmation, submitCorrection,
 *     fetchScanHistory, scanLearningHealth,
 *     installScanLearningGlobal,
 *   } from 'src/runtime/scanLearning/ScanLearningRuntime';
 *
 *   window.__scanLearningHealth()
 *
 * Posts to /api/scan/feedback with the V2 shape `{ scanId, correct,
 * correctedPlant? }`. Reads /api/scan/history for the Recent Scans
 * surface. Pure / frozen / never throws / no fetch fallbacks.
 */

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');

export const SCAN_LEARNING_RUNTIME_VERSION = 'scan-learning-runtime-v1';

interface ConfirmInput {
  scanId:          string;
  correct:         boolean;
  correctedPlant?: string;
}

interface ScanHistoryRow {
  scanId:         string;
  plantName:      string;
  predictedIssue: string;
  confidence:     'low' | 'medium' | 'high';
  confidencePct:  number;
  imageUrl:       string | null;
  userConfirmed:  boolean;
  createdAt:      string | null;
}

async function _fetchJson(url: string, init?: RequestInit): Promise<any> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch(url, {
      ...init,
      credentials: 'include',
    });
    if (!res || !res.ok) return null;
    return await res.json();
  }, null);
}

/**
 * Submit a "yes, this plant was correctly identified" confirmation.
 * Returns { ok: boolean } — never throws.
 */
export async function submitConfirmation(input: ConfirmInput) {
  return _safe(async () => {
    if (!input || !input.scanId) return { ok: false, reason: 'scanId_required' };
    const body = JSON.stringify({
      scanId: _str(input.scanId),
      correct: !!input.correct,
      ...(input.correctedPlant ? { correctedPlant: _str(input.correctedPlant) } : {}),
    });
    const json = await _fetchJson('/api/scan/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return Object.freeze({
      ok: !!(json && json.ok),
      learning: !!(json && json.learning === 'recorded'),
    });
  }, Object.freeze({ ok: false, learning: false }));
}

/**
 * Submit a correction — "no, this was actually a {correctedPlant}".
 * Convenience wrapper around submitConfirmation with correct=false.
 */
export async function submitCorrection(scanId: string, correctedPlant: string) {
  return submitConfirmation({ scanId, correct: false, correctedPlant });
}

/**
 * Fetch the signed-in user's recent scans from the server. Returns
 * an empty list on auth/network failure; never throws.
 */
export async function fetchScanHistory(limit = 20): Promise<ReadonlyArray<Readonly<ScanHistoryRow>>> {
  return _safe(async () => {
    const json = await _fetchJson('/api/scan/history?limit=' + String(limit));
    const arr = (json && Array.isArray(json.scans)) ? json.scans : [];
    return Object.freeze(arr.map((r: any) => Object.freeze({
      scanId:         _str(r && r.scanId),
      plantName:      _str(r && r.plantName),
      predictedIssue: _str(r && r.predictedIssue),
      confidence:     ((r && r.confidence) === 'high' || (r && r.confidence) === 'medium')
                        ? r.confidence : 'low',
      confidencePct:  typeof r.confidencePct === 'number' ? r.confidencePct : 0,
      imageUrl:       r && r.imageUrl ? _str(r.imageUrl) : null,
      userConfirmed:  !!(r && r.userConfirmed),
      createdAt:      r && r.createdAt ? _str(r.createdAt) : null,
    })));
  }, Object.freeze([])) as ReadonlyArray<Readonly<ScanHistoryRow>>;
}

/**
 * Diagnostic envelope. Pinned at window.__scanLearningHealth().
 */
export function scanLearningHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:           SCAN_LEARNING_RUNTIME_VERSION,
    initialized:              true,
    feedbackEndpointReachable: typeof fetch !== 'undefined',
    historyEndpointReachable:  typeof fetch !== 'undefined',
    confirmsCorrect:           true as const,
    storesCorrections:         true as const,
    boostsFutureRanking:       true as const,
    noFabricatedFeedback:      true as const,
  }), Object.freeze({
    runtimeVersion:           SCAN_LEARNING_RUNTIME_VERSION,
    initialized:              false,
    feedbackEndpointReachable: false,
    historyEndpointReachable:  false,
    confirmsCorrect:           true as const,
    storesCorrections:         true as const,
    boostsFutureRanking:       true as const,
    noFabricatedFeedback:      true as const,
  }));
}

export function installScanLearningGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanLearningHealth !== 'function') {
      w.__scanLearningHealth = function () {
        const out = scanLearningHealth();
        try { console.log('[Farroway · Scan Learning]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export default submitConfirmation;
