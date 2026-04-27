/**
 * outcomes.js — append-only labels for the future training set.
 *
 *   logOutcome(farmId, outcome, payload?)
 *   getOutcomes()
 *   getOutcomesForFarm(farmId)
 *   clearOutcomes()
 *
 * Outcomes are the "ground truth" labels we'll train against:
 * given the features observed up to time T, did the farm end up
 * pest-detected / healthy / drought-affected / harvested-ok?
 *
 * Strict-rule audit:
 *   * works offline (localStorage only)
 *   * never throws (every storage call try/catch wrapped)
 *   * lightweight: capped array; ~150 bytes per row
 *   * structured: enum + SCHEMA_VERSION so the Python
 *     ingestion job can validate batches
 */

export const STORAGE_KEY    = 'farroway_outcomes';
export const SCHEMA_VERSION = 1;
export const MAX_OUTCOMES   = 5000;

/**
 * Canonical outcome labels. Add new entries as the prediction
 * surface grows. Keep the JS side + the Python ingestion code
 * in sync.
 */
export const OUTCOME_LABELS = Object.freeze({
  PEST_DETECTED:        'pest_detected',
  DISEASE_DETECTED:     'disease_detected',
  HEALTHY:              'healthy',
  DROUGHT_AFFECTED:     'drought_affected',
  HARVEST_OK:           'harvest_ok',
  HARVEST_LOSS:         'harvest_loss',
  ABANDONED:            'abandoned',
});

const _LABEL_VALUES = Object.values(OUTCOME_LABELS);

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch { /* swallow */ }
}

function _safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}

function _read() {
  const raw = _safeGet(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    _safeRemove(STORAGE_KEY);
    return [];
  }
}

function _write(rows) {
  const trimmed = rows.length > MAX_OUTCOMES
    ? rows.slice(rows.length - MAX_OUTCOMES)
    : rows;
  try { _safeSet(STORAGE_KEY, JSON.stringify(trimmed)); }
  catch { /* swallow */ }
}

function _normaliseOutcome(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  return _LABEL_VALUES.includes(s) ? s : null;
}

function _mintId() {
  const ts = Date.now();
  let rand = '';
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(4);
      crypto.getRandomValues(buf);
      rand = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* ignore */ }
  if (!rand) rand = Math.random().toString(36).slice(2, 10);
  return `o_${ts}_${rand}`;
}

/**
 * logOutcome(farmId, outcome, payload?)
 *
 *   farmId: required, coerced to string.
 *   outcome: must match an OUTCOME_LABELS value (case-insensitive);
 *            unknown labels are silently dropped to keep the
 *            training set clean.
 *   payload: optional dict (e.g. { source: 'agent_visit',
 *            severity: 'medium', cropStage: 'flowering' }).
 */
export function logOutcome(farmId, outcome, payload = null) {
  if (!farmId) return null;
  const label = _normaliseOutcome(outcome);
  if (!label) return null;
  const record = Object.freeze({
    id:        _mintId(),
    farmId:    String(farmId),
    outcome:   label,
    payload:   payload == null ? null : payload,
    timestamp: Date.now(),
    v:         SCHEMA_VERSION,
  });
  const rows = _read();
  rows.push(record);
  _write(rows);
  return record;
}

/** All outcomes, oldest first. */
export function getOutcomes() { return _read(); }

/** Outcomes for one farm. */
export function getOutcomesForFarm(farmId) {
  if (!farmId) return [];
  const target = String(farmId);
  return _read().filter((r) => r && String(r.farmId) === target);
}

/** Test / admin helper. */
export function clearOutcomes() { _safeRemove(STORAGE_KEY); }
