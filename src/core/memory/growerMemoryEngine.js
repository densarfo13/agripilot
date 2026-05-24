/**
 * growerMemoryEngine.js — facade over the persistent stores
 * Farroway already ships, exposed at the spec-named path.
 *
 *   import { getGrowerMemorySnapshot }
 *     from 'src/core/memory/growerMemoryEngine.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A read-only facade that calls into the existing memory
 *   stores (analyticsStore, retentionEngine, journalStore-shape
 *   data, scan history) and returns ONE typed snapshot the
 *   recommendation surfaces can consume. It does NOT create a
 *   new store, NOT duplicate any state, and NOT make any
 *   prediction.
 *
 *   Memory pieces it surfaces (spec §9):
 *     • plantingDate, mode, region
 *     • scan history summary
 *     • watering patterns (counts + last watered)
 *     • disease + harvest history
 *     • yield outcomes (read from journal entries when present)
 *     • weather event memory (retention cohort + scan trust)
 *
 * Strict-rule audit
 *   • Pure facade. Never throws. SSR-safe (delegates read to
 *     stores that already guard storage).
 */

import {
  computeRetentionMetrics,
  computeScanTrustMetrics,
  computeRetentionCohorts,
} from '../retention/retentionEngine.js';

function _safe(fn, fallback) {
  try { return fn(); }
  catch { return fallback; }
}

const _str = (v) => String(v == null ? '' : v).toLowerCase();

function _summariseScanHistory(history) {
  try {
    const list = Array.isArray(history) ? history : [];
    const total = list.length;
    if (total === 0) {
      return {
        total: 0, lastCategory: null, lastAtIso: null,
        diseaseHistory: [], totalLowConfidence: 0,
      };
    }
    const byCategory = new Map();
    let lowConf = 0;
    for (const e of list) {
      if (!e) continue;
      const cat = _str(e.issueCategory || e.category);
      if (cat) byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
      if (_str(e.confidence || e.confidenceLabel) === 'low'
          || _str(e.confidence || e.confidenceLabel) === 'needs review'
          || _str(e.confidenceLabel) === 'needs_review') lowConf += 1;
    }
    const last = list[list.length - 1];
    return {
      total,
      lastCategory: _str(last && (last.issueCategory || last.category)) || null,
      lastAtIso:    (last && (last.at || last.timestamp || last.createdAt)) || null,
      diseaseHistory: [...byCategory.entries()]
        .filter(([cat]) => cat && cat !== 'healthy' && cat !== 'unknown_needs_clearer_photo')
        .map(([cat, count]) => ({ category: cat, count })),
      totalLowConfidence: lowConf,
    };
  } catch {
    return { total: 0, lastCategory: null, lastAtIso: null, diseaseHistory: [], totalLowConfidence: 0 };
  }
}

function _summariseWatering(taskHistory, lastWateredAt) {
  try {
    const list = Array.isArray(taskHistory) ? taskHistory : [];
    const watered = list.filter((t) => _str(t && t.actionType) === 'water').length;
    return {
      totalCompleted: watered,
      lastWateredAt:  lastWateredAt || null,
    };
  } catch {
    return { totalCompleted: 0, lastWateredAt: null };
  }
}

function _summariseHarvests(journal) {
  try {
    const list = Array.isArray(journal) ? journal : [];
    const harvests = list.filter((j) => _str(j && j.kind) === 'harvest');
    const totalYieldKg = harvests.reduce((acc, j) => {
      const kg = Number(j && j.yieldKg);
      return Number.isFinite(kg) && kg > 0 ? acc + kg : acc;
    }, 0);
    return {
      totalHarvests:  harvests.length,
      lastHarvestAt:  harvests.length > 0
        ? (harvests[harvests.length - 1].at || harvests[harvests.length - 1].timestamp || null)
        : null,
      totalYieldKg:   totalYieldKg > 0 ? Math.round(totalYieldKg * 10) / 10 : 0,
    };
  } catch {
    return { totalHarvests: 0, lastHarvestAt: null, totalYieldKg: 0 };
  }
}

/**
 * Build the memory snapshot.
 *
 * @param {object} args
 * @param {string} [args.crop]
 * @param {string} [args.plantingDate]
 * @param {string} [args.mode]
 * @param {string} [args.region]
 * @param {Array}  [args.scanHistory]
 * @param {Array}  [args.taskHistory]
 * @param {Array}  [args.journal]         entries with optional { kind, yieldKg, at }
 * @param {string|number} [args.lastWateredAt]
 * @returns {object}
 */
export function getGrowerMemorySnapshot(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const scanSummary    = _summariseScanHistory(a.scanHistory);
    const wateringSummary = _summariseWatering(a.taskHistory, a.lastWateredAt);
    const harvestSummary = _summariseHarvests(a.journal);

    const retentionMetrics = _safe(() => computeRetentionMetrics(), null);
    const scanTrust       = _safe(() => computeScanTrustMetrics(), null);
    const cohorts         = _safe(() => computeRetentionCohorts(), null);

    return Object.freeze({
      ok:               true,
      crop:             a.crop || null,
      plantingDate:     a.plantingDate || null,
      mode:             a.mode || null,
      region:           a.region || null,
      scan:             scanSummary,
      watering:         wateringSummary,
      harvests:         harvestSummary,
      retentionMetrics,            // distinct active days etc.
      scanTrust,                   // failure rate / journal save rate
      cohorts,                     // day 1/3/7 return
      generatedAt:      new Date().toISOString(),
      disclaimer:       'Memory is read-only — it informs guidance, not promises.',
    });
  } catch {
    return Object.freeze({
      ok: false, reason: 'exception',
      generatedAt: new Date().toISOString(),
      disclaimer: 'Memory snapshot is not available right now.',
    });
  }
}

const _module = { getGrowerMemorySnapshot };
export default _module;
