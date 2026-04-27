/**
 * exportTrainingDataset.js — flat row-oriented training data
 * for the Python baseline trainer in ml/train_baseline.py.
 *
 *   exportTrainingDataset({ minRows = 0 } = {})
 *     -> Array<TrainingRow>
 *
 *   downloadTrainingDataset()
 *     -> triggers a browser download of the rows as
 *        farroway_training_dataset.json
 *
 * Row schema (one row per labeled task event)
 *   {
 *     farmId, crop, region,
 *     daysSincePlanting,
 *     temperatureHigh, rainLast3Days, humidityHigh,
 *     nearbyPestReports, inactiveDays, tasksCompleted7d,
 *     labelPest, labelDrought, confidence,
 *     timestamp,
 *   }
 *
 * Why a separate exporter (not just src/data/export.js)
 *   `data/export.js` emits a structured bundle (events / outcomes
 *   / per-farm features) for downstream pipelines that already
 *   know the schema. The Python LogisticRegression trainer wants
 *   a flat table with one row per training example — the join
 *   between labels and the farm context at the label timestamp
 *   needs to happen here, not in pandas.
 *
 * Strict-rule audit
 *   * Works offline — every read goes against local stores
 *     (labels, eventLogger, farmStore, outbreakStore)
 *   * Never throws — try/catch around every store read; a
 *     corrupt entry produces a missing-feature row, not a crash
 *   * Lightweight: scans labels in O(N), joins to events with
 *     a per-farmId map (O(1) lookup per row)
 *   * Honest: numeric features are zero when data is missing,
 *     not synthesised. Callers can pass minRows to bail out
 *     early when training would be premature
 */

import { getLabels } from './labels.js';
import { getEvents, EVENT_TYPES } from './eventLogger.js';
import { getOutbreakReports } from '../outbreak/outbreakStore.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEMA_VERSION = 1;

function _safeArr(getter) {
  try {
    const v = getter();
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function _safeFarm(farmId) {
  try {
    if (typeof localStorage === 'undefined' || !farmId) return null;
    const raw = localStorage.getItem('farroway_farm');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id === farmId) return parsed;
    return null;
  } catch { return null; }
}

function _bool01(v) { return v ? 1 : 0; }

function _safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function _windowMatch(ts, since, until) {
  if (!Number.isFinite(ts)) return false;
  return ts >= since && ts <= until;
}

/**
 * Build a single training row by joining one label record with
 * the farm + event context that existed at label.timestamp.
 *
 * The 7d rollups (rainLast3Days, tasksCompleted7d, inactiveDays)
 * are computed against the events array trimmed to a window
 * ending at the label's timestamp — never future-leaks.
 */
function _buildRow({ label, farm, eventsByFarm, outbreakReports }) {
  const farmId    = String(label.farmId || '');
  const ts        = Number(label.timestamp) || Date.now();
  const since3d   = ts - 3 * DAY_MS;
  const since7d   = ts - 7 * DAY_MS;

  // Per-farm event slice ending at the label timestamp.
  const farmEvents = (eventsByFarm.get(farmId) || []).filter(
    (e) => Number(e.ts || e.timestamp || 0) <= ts,
  );

  // ── Tasks completed in the 7 days before the label ─────────
  const tasksCompleted7d = farmEvents.filter((e) => {
    const eTs = Number(e.ts || e.timestamp || 0);
    return e.type === EVENT_TYPES.TASK_COMPLETED && eTs >= since7d;
  }).length;

  // ── Last activity day (used for inactiveDays) ──────────────
  const lastActivity = farmEvents.length
    ? farmEvents.reduce((max, e) => {
        const eTs = Number(e.ts || e.timestamp || 0);
        return eTs > max ? eTs : max;
      }, 0)
    : 0;
  const inactiveDays = lastActivity
    ? Math.max(0, Math.floor((ts - lastActivity) / DAY_MS))
    : 7; // default to a full week of silence when no events ever

  // ── Nearby pest reports in the same region in last 7 days ──
  const region = (farm && farm.region) || (label.region || '');
  const nearbyPestReports = (outbreakReports || []).filter((r) => {
    const rTs = Number(r.ts || r.timestamp || 0);
    if (!_windowMatch(rTs, since7d, ts)) return false;
    const rRegion = String(r.region || '').toLowerCase();
    if (region && rRegion && rRegion !== String(region).toLowerCase()) {
      return false;
    }
    const kind = String(r.kind || r.type || r.issueType || '').toLowerCase();
    return /pest|insect|caterpillar|worm/.test(kind);
  }).length;

  // ── Weather features ───────────────────────────────────────
  // The eventLogger captures WEATHER_FETCHED; we read the most
  // recent one before the label timestamp to attribute the
  // weather context. Falls back to 0 / 0 / 0 if unavailable —
  // honest-zero, never synthesised.
  const weatherEvent = farmEvents
    .filter((e) => e.type === EVENT_TYPES.WEATHER_FETCHED)
    .reduce((best, e) => {
      const eTs = Number(e.ts || e.timestamp || 0);
      const bTs = best ? Number(best.ts || best.timestamp || 0) : -Infinity;
      return eTs > bTs ? e : best;
    }, null);
  const wx = (weatherEvent && weatherEvent.payload) || {};
  const temperatureHigh = _bool01(_safeNumber(wx.temperatureC) >= 30
                                || wx.temperatureHigh);
  const rainLast3Days   = _safeNumber(wx.rainMm3d != null ? wx.rainMm3d
                                       : wx.rainLast3Days);
  const humidityHigh    = _bool01(_safeNumber(wx.humidity) >= 75
                                  || wx.humidityHigh);

  // ── Days since planting ────────────────────────────────────
  let daysSincePlanting = 0;
  if (farm && farm.plantingDate) {
    try {
      const plant = new Date(farm.plantingDate).getTime();
      if (Number.isFinite(plant)) {
        daysSincePlanting = Math.max(0, Math.floor((ts - plant) / DAY_MS));
      }
    } catch { /* keep 0 */ }
  }

  // ── Labels ─────────────────────────────────────────────────
  const kind = String(label.kind || '').toLowerCase();
  const value = String(label.value || '').toLowerCase();
  const labelPest    = (kind === 'pest'    && /yes|positive/.test(value)) ? 1
                     : (kind === 'pest'    && /no|negative/.test(value))  ? 0
                     : null;
  const labelDrought = (kind === 'drought' && /yes|positive/.test(value)) ? 1
                     : (kind === 'drought' && /no|negative/.test(value))  ? 0
                     : null;

  return {
    farmId,
    crop:              (farm && farm.crop) || (label.crop || ''),
    region,
    daysSincePlanting,
    temperatureHigh,
    rainLast3Days,
    humidityHigh,
    nearbyPestReports,
    inactiveDays,
    tasksCompleted7d,
    labelPest,
    labelDrought,
    confidence:        String(label.confidence || 'unknown'),
    timestamp:         ts,
  };
}

/**
 * exportTrainingDataset({ minRows }) → Array<TrainingRow>
 *
 * Returns a flat array of rows ready for pandas. Pass `minRows`
 * to short-circuit when there's not enough data yet — the
 * trainer can still run, but a downstream caller (e.g. a
 * "Train" button on an admin page) might want to bail.
 *
 * Per spec § 9: callers should treat any dataset under 500 rows
 * as a baseline only; this function does NOT filter on that
 * count itself, so the exporter remains useful for sanity
 * checks during the early pilot.
 */
export function exportTrainingDataset({ minRows = 0 } = {}) {
  const labels  = _safeArr(getLabels);
  const events  = _safeArr(getEvents);
  const reports = _safeArr(getOutbreakReports);

  // Index events by farmId for O(1) row build.
  const eventsByFarm = new Map();
  for (const e of events) {
    const farmId = String(e.farmId || (e.payload && e.payload.farmId) || '');
    if (!farmId) continue;
    if (!eventsByFarm.has(farmId)) eventsByFarm.set(farmId, []);
    eventsByFarm.get(farmId).push(e);
  }

  const rows = [];
  for (const label of labels) {
    if (!label || !label.farmId) continue;
    const farm = _safeFarm(label.farmId);
    rows.push(_buildRow({
      label,
      farm,
      eventsByFarm,
      outbreakReports: reports,
    }));
  }

  if (rows.length < minRows) return [];
  return rows;
}

/**
 * downloadTrainingDataset() — triggers a browser download of
 * the rows as farroway_training_dataset.json. SSR-safe (no-op
 * when window/document is unavailable).
 */
export function downloadTrainingDataset() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  const rows = exportTrainingDataset();
  const payload = {
    schema:       'farroway-training-dataset',
    schemaVersion: SCHEMA_VERSION,
    exportedAt:    new Date().toISOString(),
    rowCount:      rows.length,
    rows,
  };
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)],
      { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'farroway_training_dataset.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* */ } }, 0);
    return true;
  } catch {
    return false;
  }
}

export const TRAINING_DATASET_SCHEMA_VERSION = SCHEMA_VERSION;

export default exportTrainingDataset;
