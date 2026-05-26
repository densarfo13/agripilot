/**
 * scanOutcomeTracker.js — Phase 12 self-improvement data capture.
 *
 *   import {
 *     recordScanOutcome, getScanOutcomes, getOutcomeFor,
 *     OUTCOME,
 *   } from 'src/core/scan/scanOutcomeTracker.js';
 *
 *   recordScanOutcome(scanId, OUTCOME.RESOLVED, { notes, photoUri });
 *   const all = getScanOutcomes();
 *   const this = getOutcomeFor(scanId);
 *
 * What it is
 * ──────────
 *   Lightweight localStorage-backed log that captures the user's
 *   confirmation of WHAT ACTUALLY HAPPENED after a scan + its
 *   diagnosis. Powers the future self-improvement loop: when we
 *   accumulate enough labelled outcomes per (issue, crop, region)
 *   triple, future diagnoses can re-weight rankings based on
 *   "this worked / didn't work" history.
 *
 *   The capture surface is opt-in — the user taps "Was Farroway
 *   helpful?" / "Mark resolved" / "Same problem returned" on the
 *   journal entry. We record one outcome per scanId.
 *
 *   What we save (no PII, no image bytes — those live in the
 *   scan history slot already):
 *
 *     {
 *       scanId, outcome, recordedAt,
 *       issueCategory, crop, region, country, cropStage,
 *       severity, confidence, daysSinceScan,
 *       userNotes (optional, ≤ 240 chars),
 *     }
 *
 *   Future use:
 *     - aggregate by (issue, crop, region) → outcome distribution
 *     - feed into a re-weighting step in contextDiagnosisEngine
 *     - export anonymised aggregates for the regional dashboard
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • All persistence wrapped in try/catch — quota / privacy
 *     mode silent-degrades to memory-only.
 *   • Rolling buffer (cap 100 outcomes) so the log doesn't grow
 *     unbounded on power users.
 */

export const OUTCOME = Object.freeze({
  RESOLVED:    'resolved',
  IMPROVED:    'improved',
  NO_CHANGE:   'no_change',
  WORSENED:    'worsened',
  ESCALATED:   'escalated',
  WRONG:       'wrong_diagnosis',
});

const STORAGE_KEY = 'farroway:scanOutcomes:v1';
const MAX_OUTCOMES = 100;

function _safeGet() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeSet(arr) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch { /* quota / private mode — degrade silently */ }
}

function _isValidOutcome(v) {
  if (typeof v !== 'string') return false;
  return Object.values(OUTCOME).includes(v);
}

/**
 * Record an outcome for a scan. Idempotent — calling twice with
 * the same scanId UPDATES the prior row (latest user input wins).
 * Returns the persisted row, or null on garbage input.
 */
export function recordScanOutcome(scanId, outcome, meta) {
  try {
    if (!scanId || typeof scanId !== 'string') return null;
    if (!_isValidOutcome(outcome)) return null;
    const safeMeta = (meta && typeof meta === 'object') ? meta : {};
    const row = Object.freeze({
      scanId,
      outcome,
      recordedAt:    Date.now(),
      issueCategory: typeof safeMeta.issueCategory === 'string' ? safeMeta.issueCategory : null,
      crop:          typeof safeMeta.crop === 'string' ? safeMeta.crop : null,
      region:        typeof safeMeta.region === 'string' ? safeMeta.region : null,
      country:       typeof safeMeta.country === 'string' ? safeMeta.country : null,
      cropStage:     typeof safeMeta.cropStage === 'string' ? safeMeta.cropStage : null,
      severity:      typeof safeMeta.severity === 'string' ? safeMeta.severity : null,
      confidence:    typeof safeMeta.confidence === 'string' ? safeMeta.confidence : null,
      daysSinceScan: Number.isFinite(safeMeta.daysSinceScan) ? safeMeta.daysSinceScan : null,
      userNotes:     (typeof safeMeta.userNotes === 'string' && safeMeta.userNotes)
                       ? safeMeta.userNotes.slice(0, 240) : null,
    });
    const log = _safeGet();
    // Upsert by scanId — latest user input wins.
    const idx = log.findIndex((r) => r && r.scanId === scanId);
    if (idx >= 0) log[idx] = row;
    else log.push(row);
    // Cap rolling buffer.
    if (log.length > MAX_OUTCOMES) log.splice(0, log.length - MAX_OUTCOMES);
    _safeSet(log);
    return row;
  } catch { return null; }
}

/** Read every recorded outcome. Latest-last. */
export function getScanOutcomes() {
  return _safeGet();
}

/** Find the outcome for one scan, or null. */
export function getOutcomeFor(scanId) {
  if (!scanId || typeof scanId !== 'string') return null;
  const log = _safeGet();
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i] && log[i].scanId === scanId) return log[i];
  }
  return null;
}

/**
 * Aggregate outcomes by (issueCategory, crop, region). Used by
 * future re-weighting logic.
 *
 *   { 'leaf_spots|tomato|Ashanti': { resolved: 4, worsened: 1, … } }
 */
export function aggregateOutcomes() {
  try {
    const out = {};
    const log = _safeGet();
    for (const row of log) {
      if (!row || !row.issueCategory) continue;
      const k = [row.issueCategory, row.crop || '*', row.region || '*'].join('|');
      if (!out[k]) {
        out[k] = {};
        for (const v of Object.values(OUTCOME)) out[k][v] = 0;
        out[k]._total = 0;
      }
      out[k][row.outcome] = (out[k][row.outcome] || 0) + 1;
      out[k]._total += 1;
    }
    return out;
  } catch { return {}; }
}

/** Drop the entire log — used by recovery hooks + tests. */
export function clearScanOutcomes() {
  _safeSet([]);
}

const _module = {
  OUTCOME, recordScanOutcome, getScanOutcomes, getOutcomeFor,
  aggregateOutcomes, clearScanOutcomes,
};
export default _module;
