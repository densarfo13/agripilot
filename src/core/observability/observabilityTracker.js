/**
 * observabilityTracker.js — lightweight operational monitoring
 * (Final Readiness §8).
 *
 *   import { recordObservation, getObservabilitySnapshot, OBSERVABILITY }
 *     from 'src/core/observability/observabilityTracker.js';
 *
 * What it is
 * ──────────
 *   A tiny in-memory + localStorage counter for operational
 *   signals the pilot team needs to see: runtime errors, scan /
 *   upload / auth failures, API 500s, asset + language fallback
 *   usage, offline-queue failures.
 *
 *   It does NOT replace Sentry (src/lib/sentry.js) — Sentry is the
 *   detailed crash pipeline. This is the cheap on-device tally an
 *   admin/debug screen can read without a network call.
 *
 * THE HARD RULE
 *   Analytics failure must NEVER break the app. Every function is
 *   fully wrapped; the worst case is a missed count.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (guards `localStorage`). Bounded —
 *     just a small map of integer counters.
 */

const STORE_KEY = 'farroway_observability_v1';

export const OBSERVABILITY = Object.freeze({
  RUNTIME_ERROR:        'runtime_error',
  SCAN_FAILURE:         'scan_failure',
  UPLOAD_FAILURE:       'upload_failure',
  AUTH_FAILURE:         'auth_failure',
  API_500:              'api_500',
  ASSET_FALLBACK:       'asset_fallback',
  LANGUAGE_FALLBACK:    'language_fallback',
  OFFLINE_QUEUE_FAILURE:'offline_queue_failure',
});

const _VALID = new Set(Object.values(OBSERVABILITY));

// In-memory counters — always available even when storage is not.
const _counts = {};

function _readStored() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function _writeStored(map) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch { /* quota / private mode — ignore */ }
}

/**
 * Record one occurrence of an observability category.
 * Unknown categories are accepted but bucketed under 'other' so a
 * typo never throws. Returns true if it was counted.
 *
 * @param {string} category  one of OBSERVABILITY
 * @returns {boolean}
 */
export function recordObservation(category) {
  try {
    const cat = _VALID.has(category) ? category : 'other';
    _counts[cat] = (_counts[cat] || 0) + 1;
    const stored = _readStored();
    stored[cat] = (stored[cat] || 0) + 1;
    stored.__updatedAt = new Date().toISOString();
    _writeStored(stored);
    return true;
  } catch {
    return false; // observability failure NEVER breaks the app
  }
}

/**
 * Read-only snapshot of all counters (merges in-memory + stored).
 *
 * @returns {{ counts: object, total: number, updatedAt: string|null }}
 */
export function getObservabilitySnapshot() {
  try {
    const stored = _readStored();
    const counts = {};
    let total = 0;
    // Merge stored + in-memory (max) so the snapshot is correct
    // whether or not localStorage is available (SSR / private mode).
    for (const cat of _VALID) {
      const n = Math.max(stored[cat] || 0, _counts[cat] || 0);
      counts[cat] = n;
      total += n;
    }
    const other = Math.max(stored.other || 0, _counts.other || 0);
    if (other > 0) {
      counts.other = other;
      total += other;
    }
    return {
      counts,
      total,
      updatedAt: stored.__updatedAt || null,
    };
  } catch {
    return { counts: {}, total: 0, updatedAt: null };
  }
}

/** Wipe the counters. */
export function resetObservability() {
  try {
    for (const k of Object.keys(_counts)) delete _counts[k];
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORE_KEY);
  } catch { /* ignore */ }
}

const _module = {
  OBSERVABILITY,
  recordObservation,
  getObservabilitySnapshot,
  resetObservability,
};
export default _module;
