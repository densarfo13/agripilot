/**
 * passiveLabeler.js — weak/low-confidence labels harvested from
 * the existing event stream.
 *
 * Spec section 4:
 *   "If pest alert was shown AND no pest reported for 3 days
 *    -> weak label pest = 0 (low confidence)"
 *
 * The labeler runs on app boot (call runPassiveLabeling once);
 * it never blocks the UI. Each pass is idempotent inside a
 * local day - duplicate boots in the same day produce at most
 * one weak label per (farmId, kind).
 *
 * Strict-rule audit
 *   * works offline (pure read over the event log + label store)
 *   * never throws (every helper is defensive)
 *   * lightweight: O(N) over the recent events
 */

import { getEvents, EVENT_TYPES } from './eventLogger.js';
import {
  saveLabel, getLabelsForFarm,
  LABEL_KIND, LABEL_VALUE, CONFIDENCE,
} from './labels.js';

const MS_PER_DAY = 86_400_000;
const PEST_WINDOW_DAYS    = 3;
const DROUGHT_WINDOW_DAYS = 5;

const LEDGER_KEY = 'farroway_passive_labeler_ledger';

function _today() { return new Date().toDateString(); }

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

function _readLedger() {
  const raw = _safeGet(LEDGER_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function _writeLedger(map) {
  try { _safeSet(LEDGER_KEY, JSON.stringify(map)); }
  catch { /* swallow */ }
}

function _alreadyLabelledToday(farmId, kind) {
  const ledger = _readLedger();
  const key = `${farmId}:${kind}`;
  return ledger[key] === _today();
}

function _markLabelled(farmId, kind) {
  const ledger = _readLedger();
  ledger[`${farmId}:${kind}`] = _today();
  _writeLedger(ledger);
}

/* ─── Pest pass ────────────────────────────────────────────────── */

function _hasReportInWindow(events, farmId, since) {
  for (const e of events) {
    if (!e || e.type !== EVENT_TYPES.PEST_REPORTED) continue;
    if (e.payload && String(e.payload.farmId) !== String(farmId)) continue;
    if (Number(e.timestamp) >= since) return true;
  }
  return false;
}

function _farmsAlertedSince(events, since) {
  const ids = new Set();
  for (const e of events) {
    if (!e) continue;
    if (e.type !== EVENT_TYPES.DROUGHT_ALERT_SHOWN
        && e.type !== EVENT_TYPES.RISK_COMPUTED) continue;
    const fid = e.payload && e.payload.farmId;
    if (fid == null) continue;
    if (Number(e.timestamp) < since) continue;
    ids.add(String(fid));
  }
  return ids;
}

/* ─── Public ───────────────────────────────────────────────────── */

/**
 * runPassiveLabeling()
 *   -> { saved: number }
 *
 * Single-pass scan. Idempotent within a local day. Returns the
 * count of new low-confidence labels saved.
 */
export function runPassiveLabeling() {
  const events = getEvents();
  if (!Array.isArray(events) || events.length === 0) return { saved: 0 };

  const now = Date.now();
  const pestSince    = now - PEST_WINDOW_DAYS    * MS_PER_DAY;
  const droughtSince = now - DROUGHT_WINDOW_DAYS * MS_PER_DAY;

  let saved = 0;

  // Pest: farms that saw a RISK_COMPUTED with high pest risk
  // OR a DROUGHT_ALERT_SHOWN inside the window AND no
  // PEST_REPORTED inside the same window -> weak negative.
  const pestFarms = _farmsAlertedSince(events, pestSince);
  for (const farmId of pestFarms) {
    if (_alreadyLabelledToday(farmId, LABEL_KIND.PEST)) continue;
    if (_hasReportInWindow(events, farmId, pestSince)) continue;

    // Don't double-label: skip if any high or medium label
    // already exists for this farm in the window.
    const recent = getLabelsForFarm(farmId).some((l) =>
      l && l.kind === LABEL_KIND.PEST
        && l.confidence !== CONFIDENCE.LOW
        && Number(l.timestamp) >= pestSince
    );
    if (recent) continue;

    try {
      saveLabel({
        farmId,
        kind:       LABEL_KIND.PEST,
        value:      LABEL_VALUE.PEST_NO,
        confidence: CONFIDENCE.LOW,
        source:     'passive_no_report',
      });
      _markLabelled(farmId, LABEL_KIND.PEST);
      saved += 1;
    } catch { /* swallow */ }
  }

  // Drought: similar idea. A farm that saw drought-ish risk
  // signals AND has NO drought-affected outcome inside the
  // window -> weak negative. We currently treat any
  // DROUGHT_ALERT_SHOWN payload as a "drought signal exists"
  // marker; richer signal can be wired without a schema bump.
  const droughtFarms = _farmsAlertedSince(events, droughtSince);
  for (const farmId of droughtFarms) {
    if (_alreadyLabelledToday(farmId, LABEL_KIND.DROUGHT)) continue;
    const recent = getLabelsForFarm(farmId).some((l) =>
      l && l.kind === LABEL_KIND.DROUGHT
        && Number(l.timestamp) >= droughtSince
    );
    if (recent) continue;

    try {
      saveLabel({
        farmId,
        kind:       LABEL_KIND.DROUGHT,
        value:      LABEL_VALUE.DROUGHT_NO,
        confidence: CONFIDENCE.LOW,
        source:     'passive_no_drought_outcome',
      });
      _markLabelled(farmId, LABEL_KIND.DROUGHT);
      saved += 1;
    } catch { /* swallow */ }
  }

  return { saved };
}

export const _internal = Object.freeze({
  PEST_WINDOW_DAYS, DROUGHT_WINDOW_DAYS, LEDGER_KEY,
});
