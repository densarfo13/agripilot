/**
 * exportTrainingRows.js — flat per-event training-row export
 * matching the v2 data-foundation spec exactly.
 *
 *   exportTrainingRows()         -> Array<TrainingRow>
 *   downloadTrainingRowsAsJSON() -> triggers JSON download
 *   downloadTrainingRowsAsCSV()  -> triggers CSV download
 *
 * Row shape (per spec § 10):
 *   {
 *     farmId,
 *     crop,
 *     region,
 *     daysSincePlanting,
 *     taskType,
 *     urgency,
 *     weatherRisk,    // 'LOW' | 'MEDIUM' | 'HIGH'
 *     pestRisk,
 *     droughtRisk,
 *     nearbyReports,  // count of pest/drought reports in same region in last 7d
 *     taskCompleted,  // boolean
 *     label,          // 'pest' | 'drought' | 'none' | 'unknown' | null
 *     outcome,        // 'helped' | 'not_helpful' | ... | null
 *     timestamp,      // ms since epoch
 *   }
 *
 * Why a separate exporter from src/data/exportTrainingDataset.js
 *   exportTrainingDataset emits one row per labeled task event
 *   (label-driven). This module emits one row per TASK_GENERATED /
 *   TASK_COMPLETED event (action-driven), with the label + outcome
 *   joined from the same event log when available. The two views
 *   serve different ML targets: the existing one trains pest /
 *   drought classifiers; the new one trains task-effectiveness +
 *   action-prediction models. Both pull from the same canonical
 *   event log + share helper functions.
 *
 * Strict-rule audit
 *   * Pure: every read goes against the local stores (eventLogger,
 *     labels, outbreakStore, farm record); no network
 *   * Never throws — try/catch around every store read, missing
 *     fields collapse to null / 0
 *   * Never future-leaks — features computed for an event are
 *     capped at the event's timestamp
 *   * Lightweight: rows are plain objects so JSON.stringify is
 *     the entire serialiser
 */

import { getEvents, EVENT_TYPES } from './eventLogger.js';
import { getLabels } from './labels.js';
import { getOutbreakReports } from '../outbreak/outbreakStore.js';
import { getRegionKey } from '../location/geoUtils.js';
import { safeParse } from '../utils/safeParse.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEMA_VERSION = 1;

function _safeArr(getter) {
  try {
    const v = getter();
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function _safeFarm(farmId) {
  if (!farmId) return null;
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_farm');
    if (!raw) return null;
    const parsed = safeParse(raw, null);
    if (parsed && parsed.id === farmId) return parsed;
    return null;
  } catch { return null; }
}

function _ts(e) {
  if (!e) return null;
  if (Number.isFinite(e.timestamp)) return e.timestamp;
  if (Number.isFinite(e.ts)) return e.ts;
  return null;
}

/**
 * Find the matching label + outcome for a given (farmId, taskId,
 * timestamp) tuple. The match window is 24h after the task event
 * — labels submitted later are stale signals for action-prediction
 * training and shouldn't pollute the row.
 */
function _findLabel({ labels, farmId, taskId, ts }) {
  if (!Array.isArray(labels) || !farmId || !ts) return null;
  for (const l of labels) {
    if (!l) continue;
    if (String(l.farmId || '') !== String(farmId)) continue;
    if (taskId && l.extra && l.extra.farmState
        && l.extra.farmState.taskType
        && String(l.extra.farmState.taskType) !== String(taskId)) {
      continue;
    }
    const lts = Number(l.timestamp);
    if (!Number.isFinite(lts)) continue;
    if (lts < ts) continue;
    if (lts > ts + DAY_MS) continue;
    // Map (kind, value) onto the spec's compact label vocabulary.
    const kind = String(l.kind || '').toLowerCase();
    const value = String(l.value || '').toLowerCase();
    if (kind === 'pest'    && /yes|positive/.test(value)) return 'pest';
    if (kind === 'drought' && /yes|positive/.test(value)) return 'drought';
    if (/no/.test(value)) return 'none';
  }
  return null;
}

function _findOutcome({ events, farmId, taskId, ts }) {
  if (!Array.isArray(events) || !farmId || !ts) return null;
  for (const e of events) {
    if (e.type !== EVENT_TYPES.OUTCOME_SUBMITTED) continue;
    const p = e.payload || {};
    if (String(p.farmId || '') !== String(farmId)) continue;
    if (taskId && p.taskId && String(p.taskId) !== String(taskId)) continue;
    const ots = _ts(e);
    if (!Number.isFinite(ots)) continue;
    // Outcomes can land days later — extend the join window to
    // 14 days so a late "did this help?" still attaches.
    if (ots < ts) continue;
    if (ots > ts + 14 * DAY_MS) continue;
    return p.outcome ? String(p.outcome) : null;
  }
  return null;
}

function _nearbyReportCount({ reports, regionKey, ts }) {
  if (!Array.isArray(reports) || !regionKey || !ts) return 0;
  const since = ts - 7 * DAY_MS;
  let n = 0;
  for (const r of reports) {
    if (!r) continue;
    const rts = Number(r.ts || r.timestamp || 0);
    if (!Number.isFinite(rts)) continue;
    if (rts < since || rts > ts) continue;
    const rKey = getRegionKey({
      country: r.country, region: r.region, district: r.district,
    });
    if (rKey === regionKey) n += 1;
  }
  return n;
}

function _daysSincePlanting(farm, ts) {
  if (!farm || !farm.plantingDate || !ts) return 0;
  try {
    const plant = new Date(farm.plantingDate).getTime();
    if (!Number.isFinite(plant)) return 0;
    return Math.max(0, Math.floor((ts - plant) / DAY_MS));
  } catch { return 0; }
}

function _findCompletion({ events, farmId, taskId, ts }) {
  if (!Array.isArray(events) || !farmId || !taskId || !ts) return false;
  for (const e of events) {
    if (e.type !== EVENT_TYPES.TASK_COMPLETED) continue;
    const p = e.payload || {};
    if (String(p.farmId || '') !== String(farmId)) continue;
    const cts = _ts(e);
    if (!Number.isFinite(cts)) continue;
    if (cts < ts) continue;
    if (cts > ts + 7 * DAY_MS) continue;
    // Match on payload.task or .taskId — older callers used either.
    const pt = String(p.task || p.taskId || '');
    if (!pt || pt === String(taskId)) return true;
  }
  return false;
}

/**
 * exportTrainingRows() → Array<TrainingRow>
 *
 * One row per TASK_GENERATED event (or, when no TASK_GENERATED
 * event exists for a completion, one row per TASK_COMPLETED so
 * historical data still produces rows). Joins:
 *   * crop / region / plantingDate from the local farm record
 *   * weather / pest / drought risks from the event payload (if
 *     a RISK_COMPUTED event was captured at the same time —
 *     fields default to 'LOW' otherwise)
 *   * nearbyReports counted in the SAME region across last 7d
 *   * label from the labels store within 24h of the task
 *   * outcome from the outcome events within 14d of the task
 */
export function exportTrainingRows() {
  const events  = _safeArr(getEvents);
  const labels  = _safeArr(getLabels);
  const reports = _safeArr(getOutbreakReports);

  // Index TASK_GENERATED + TASK_COMPLETED events. Use a Map so a
  // task with both events doesn't produce a duplicate row.
  const seen = new Map();
  const taskEvents = [];
  for (const e of events) {
    if (e.type !== EVENT_TYPES.TASK_GENERATED
     && e.type !== EVENT_TYPES.TASK_COMPLETED) continue;
    const p = e.payload || {};
    const farmId = p.farmId != null ? String(p.farmId) : '';
    const taskId = String(p.taskId || p.task || '');
    if (!farmId || !taskId) continue;
    const ts = _ts(e);
    if (ts == null) continue;
    const key = `${farmId}|${taskId}|${ts}`;
    if (seen.has(key)) continue;
    seen.set(key, true);
    taskEvents.push({ farmId, taskId, ts, payload: p });
  }

  const rows = [];
  for (const t of taskEvents) {
    const farm = _safeFarm(t.farmId);
    const country  = (farm && farm.country)  || t.payload.country  || '';
    const region   = (farm && farm.region)   || t.payload.region   || '';
    const district = (farm && farm.district) || t.payload.district || '';
    const regionKey = getRegionKey({ country, region, district });

    const labelMatch = _findLabel({ labels, farmId: t.farmId,
                                     taskId: t.taskId, ts: t.ts });
    const outcomeMatch = _findOutcome({ events, farmId: t.farmId,
                                         taskId: t.taskId, ts: t.ts });
    const completed = (t.payload.completed === true)
      || _findCompletion({ events, farmId: t.farmId,
                            taskId: t.taskId, ts: t.ts });

    rows.push({
      farmId:           t.farmId,
      crop:             (farm && farm.crop) || t.payload.crop || '',
      region:           [country, region].filter(Boolean).join(' / '),
      daysSincePlanting: _daysSincePlanting(farm, t.ts),
      taskType:         t.taskId,
      urgency:          String(t.payload.urgency || 'MEDIUM').toUpperCase(),
      weatherRisk:      String(t.payload.weatherRisk || 'LOW').toUpperCase(),
      pestRisk:         String(t.payload.pestRisk    || 'LOW').toUpperCase(),
      droughtRisk:      String(t.payload.droughtRisk || 'LOW').toUpperCase(),
      nearbyReports:    _nearbyReportCount({ reports, regionKey, ts: t.ts }),
      taskCompleted:    !!completed,
      label:            labelMatch,
      outcome:          outcomeMatch,
      timestamp:        t.ts,
    });
  }

  // Stable order: oldest first so the trainer can index by row.
  rows.sort((a, b) => a.timestamp - b.timestamp);
  return rows;
}

function _csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function _toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const head = cols.join(',');
  const body = rows.map((r) => cols.map((c) => _csvEscape(r[c])).join(','));
  return [head, ...body].join('\n');
}

function _download({ filename, mime, body }) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const blob = new Blob([body], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* */ } }, 0);
    return true;
  } catch {
    return false;
  }
}

export function downloadTrainingRowsAsJSON() {
  const rows = exportTrainingRows();
  const payload = {
    schema:        'farroway-training-rows',
    schemaVersion: SCHEMA_VERSION,
    exportedAt:    new Date().toISOString(),
    rowCount:      rows.length,
    rows,
  };
  return _download({
    filename: 'farroway_training_rows.json',
    mime:     'application/json',
    body:     JSON.stringify(payload, null, 2),
  });
}

export function downloadTrainingRowsAsCSV() {
  const rows = exportTrainingRows();
  return _download({
    filename: 'farroway_training_rows.csv',
    mime:     'text/csv',
    body:     _toCSV(rows),
  });
}

export const TRAINING_ROWS_SCHEMA_VERSION = SCHEMA_VERSION;

export default exportTrainingRows;
