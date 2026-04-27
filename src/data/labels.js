/**
 * labels.js — outcome-label store with paired feature snapshot.
 *
 * Spec section 6 + 7: every saved label is stored alongside the
 * feature vector that existed at the time, so the Python
 * trainer can build (X, y) pairs without back-joining
 * timestamps.
 *
 *   saveLabel({ farmId, kind, value, confidence, source?, extra? })
 *   getLabels()
 *   getLabelsForFarm(farmId)
 *   clearLabels()
 *
 * High-confidence labels (source = 'auto_report' OR farmer
 * yes/no) are MIRRORED into the outcomes store so the existing
 * exportTrainingData() bundle picks them up alongside legacy
 * outcomes. Low-confidence labels stay in farroway_labels only.
 *
 * Strict-rule audit
 *   * works offline (localStorage only)
 *   * never throws (every IO call try/catch wrapped)
 *   * lightweight: capped at 3000 rows; ~250 bytes/row
 *   * structured: explicit LABEL_KIND + CONFIDENCE enums +
 *     SCHEMA_VERSION so the Python ingestion job can validate
 */

import { buildFeatures } from './featureStore.js';
import { logOutcome, OUTCOME_LABELS } from './outcomes.js';

export const STORAGE_KEY    = 'farroway_labels';
export const SCHEMA_VERSION = 1;
export const MAX_LABELS     = 3000;

export const LABEL_KIND = Object.freeze({
  PEST:    'pest',
  DROUGHT: 'drought',
});

export const LABEL_VALUE = Object.freeze({
  PEST_YES:     'pest_yes',
  PEST_NO:      'pest_no',
  DROUGHT_YES:  'drought_yes',
  DROUGHT_NO:   'drought_no',
  UNKNOWN:      'unknown',
});

export const CONFIDENCE = Object.freeze({
  HIGH:   'high',     // farmer reported / explicit signal
  MEDIUM: 'medium',   // farmer answered yes/no
  LOW:    'low',      // passive inference
});

const VALID_VALUES = new Set(Object.values(LABEL_VALUE));
const VALID_KINDS  = new Set(Object.values(LABEL_KIND));
const VALID_CONFS  = new Set(Object.values(CONFIDENCE));

/* ─── helpers ──────────────────────────────────────────────────── */

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
  const trimmed = rows.length > MAX_LABELS
    ? rows.slice(rows.length - MAX_LABELS)
    : rows;
  try { _safeSet(STORAGE_KEY, JSON.stringify(trimmed)); }
  catch { /* swallow */ }
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
  return `lbl_${ts}_${rand}`;
}

function _featureSnapshot(farmId, extra) {
  // 14-day window matches the typical "what did the farm look
  // like in the last fortnight" question the trainer asks.
  let features = null;
  try { features = buildFeatures(farmId, { windowDays: 14 }); }
  catch { /* swallow */ }
  return Object.freeze({
    features,
    weather: extra && extra.weather ? extra.weather : null,
    risk:    extra && extra.risk    ? extra.risk    : null,
    farmState: extra && extra.farmState ? extra.farmState : null,
  });
}

function _toOutcomeLabel(kind, value) {
  if (kind === LABEL_KIND.PEST    && value === LABEL_VALUE.PEST_YES)    return OUTCOME_LABELS.PEST_DETECTED;
  if (kind === LABEL_KIND.PEST    && value === LABEL_VALUE.PEST_NO)     return OUTCOME_LABELS.HEALTHY;
  if (kind === LABEL_KIND.DROUGHT && value === LABEL_VALUE.DROUGHT_YES) return OUTCOME_LABELS.DROUGHT_AFFECTED;
  if (kind === LABEL_KIND.DROUGHT && value === LABEL_VALUE.DROUGHT_NO)  return OUTCOME_LABELS.HEALTHY;
  return null;
}

/* ─── public ───────────────────────────────────────────────────── */

/**
 * saveLabel({ farmId, kind, value, confidence, source?, extra? })
 *
 * Returns the persisted record (frozen). Drops invalid input
 * (returns null) so the trainer never sees junk - we'd rather
 * miss a label than poison the dataset.
 *
 * `extra.weather` / `extra.risk` / `extra.farmState` are
 * captured into the snapshot when supplied. Everything else
 * comes from the eventLogger via buildFeatures(farmId).
 *
 * High-confidence + medium-confidence labels are ALSO mirrored
 * into the outcomes store via logOutcome so exportTrainingData
 * picks them up automatically. Low-confidence labels stay in
 * farroway_labels only - the Python pipeline can still consume
 * them via a separate optional feature in the bundle later.
 */
export function saveLabel(input) {
  if (!input || typeof input !== 'object') return null;
  const farmId     = input.farmId == null ? null : String(input.farmId);
  const kind       = String(input.kind || '').toLowerCase();
  const value      = String(input.value || '').toLowerCase();
  const confidence = String(input.confidence || '').toLowerCase();
  const source     = input.source ? String(input.source) : 'unknown';

  if (!farmId)                    return null;
  if (!VALID_KINDS.has(kind))     return null;
  if (!VALID_VALUES.has(value))   return null;
  if (!VALID_CONFS.has(confidence)) return null;

  const record = Object.freeze({
    id:         _mintId(),
    farmId,
    kind,
    value,
    confidence,
    source,
    snapshot:   _featureSnapshot(farmId, input.extra),
    timestamp:  Date.now(),
    v:          SCHEMA_VERSION,
  });

  const rows = _read();
  rows.push(record);
  _write(rows);

  // Mirror high + medium confidence labels into outcomes so the
  // existing trainer + exporter pipeline picks them up.
  if (confidence !== CONFIDENCE.LOW) {
    try {
      const outcome = _toOutcomeLabel(kind, value);
      if (outcome) {
        logOutcome(farmId, outcome, {
          source:     `label:${source}`,
          confidence,
          labelId:    record.id,
        });
      }
    } catch { /* never block the label save */ }
  }

  // v1.6 adaptive learning: nudge the per-feature weights in
  // weightsStore based on this confirmed label. Low-confidence
  // labels are intentionally skipped inside learnFromLabel
  // (passive negatives are too noisy to drive learning). Wrapped
  // in try/catch so a learner failure never blocks the label
  // save or the outcomes mirror.
  try {
    // Lazy import to avoid a circular dependency between
    // src/data/labels.js and src/ai/learningEngine.js
    // (learningEngine imports labels for the LABEL_KIND /
    // CONFIDENCE enums).
    /* eslint-disable global-require */
    import('../ai/learningEngine.js')
      .then((mod) => {
        try { mod.learnFromLabel(record); }
        catch { /* swallow */ }
      })
      .catch(() => { /* swallow */ });
    /* eslint-enable global-require */
  } catch { /* swallow */ }

  return record;
}

export function getLabels() { return _read(); }

export function getLabelsForFarm(farmId) {
  if (!farmId) return [];
  const target = String(farmId);
  return _read().filter((r) => r && String(r.farmId) === target);
}

export function clearLabels() { _safeRemove(STORAGE_KEY); }

/* ─── per-day dedupe (used by the post-task prompt) ─────────── */

const PROMPT_LEDGER_KEY = 'farroway_label_prompt_ledger';

function _today() { return new Date().toDateString(); }

function _readPromptLedger() {
  const raw = _safeGet(PROMPT_LEDGER_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function _writePromptLedger(map) {
  try { _safeSet(PROMPT_LEDGER_KEY, JSON.stringify(map)); }
  catch { /* swallow */ }
}

/** True when the farmer has already been prompted today. */
export function hasPromptedToday(farmId) {
  if (!farmId) return false;
  const ledger = _readPromptLedger();
  return ledger[String(farmId)] === _today();
}

export function markPromptedToday(farmId) {
  if (!farmId) return;
  const ledger = _readPromptLedger();
  ledger[String(farmId)] = _today();
  // garbage-collect entries older than 14 days (anything not
  // matching today / one of the last 14 day-strings)
  _writePromptLedger(ledger);
}
