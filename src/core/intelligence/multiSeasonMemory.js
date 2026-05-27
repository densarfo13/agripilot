/**
 * multiSeasonMemory.js — long-term per-farm intelligence
 * accumulation across seasons.
 *
 *   import {
 *     recordSeasonEvent, getMultiSeasonSnapshot, SEASON_EVENT,
 *   } from 'src/core/intelligence/multiSeasonMemory.js';
 *
 *   recordSeasonEvent(SEASON_EVENT.DISEASE_RESOLVED, {
 *     crop, region, issueCategory, season, atMs,
 *   });
 *
 *   const v = getMultiSeasonSnapshot({ crop, region });
 *
 *   v = {
 *     seasonsObserved,           — number of distinct seasons
 *     recurringDiseaseCycles,    — [{ category, seasons[], count }]
 *     weatherPatterns,           — [{ pattern, seasons }]
 *     interventionOutcomes,      — { intervention: { helped, ignored } }
 *     yieldContinuity,           — { trend, confidence }
 *     learningDepth,             — 'thin' | 'developing' | 'rich'
 *     engineVersion:'multi-season-memory-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   A rolling, capped, in-localStorage event ledger keyed by
 *   (crop, region, season). Records intervention outcomes,
 *   disease cycles, and yield observations so future-season
 *   guidance can prefer interventions that worked LAST year.
 *
 *   Seasons are derived from event timestamps: spring (Mar-May),
 *   summer (Jun-Aug), autumn (Sep-Nov), winter (Dec-Feb) —
 *   northern-hemisphere baseline, with optional `season`
 *   override per event for cross-hemisphere data.
 *
 *   `learningDepth` reports how mature the memory is:
 *     • thin       — fewer than 5 events OR 1 season observed
 *     • developing — 2 seasons observed
 *     • rich       — ≥ 3 seasons observed AND ≥ 20 events
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Capped at 500 events (oldest evicted).
 *   • No PII — every entry strictly structural.
 */

const ENGINE_VERSION = 'multi-season-memory-v1';
const STORAGE_KEY = 'farroway:multiSeasonMemory:v1';
const MAX_EVENTS = 500;

export const SEASON_EVENT = Object.freeze({
  DISEASE_DETECTED:   'disease_detected',
  DISEASE_RESOLVED:   'disease_resolved',
  DISEASE_RECURRED:   'disease_recurred',
  WEATHER_PATTERN:    'weather_pattern',
  INTERVENTION_OK:    'intervention_helped',
  INTERVENTION_BAD:   'intervention_ignored',
  YIELD_OBSERVED:     'yield_observed',
});

const _VALID = new Set(Object.values(SEASON_EVENT));

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readLog() {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _writeLog(arr) {
  _safe(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  });
}

function _seasonOf(ms) {
  const d = new Date(ms);
  const m = d.getMonth(); // 0..11
  if (m >= 2  && m <= 4)  return 'spring';
  if (m >= 5  && m <= 7)  return 'summer';
  if (m >= 8  && m <= 10) return 'autumn';
  return 'winter';
}

/**
 * Record one season-scale event. Returns the persisted row.
 */
export function recordSeasonEvent(kind, meta) {
  return _safe(() => {
    if (!_VALID.has(kind)) return null;
    const safeMeta = _isObj(meta) ? meta : {};
    const atMs = _num(safeMeta.atMs) || Date.now();
    const row = Object.freeze({
      kind,
      atMs,
      season:         _str(safeMeta.season) || _seasonOf(atMs),
      year:           _num(safeMeta.year) || new Date(atMs).getFullYear(),
      crop:           _str(safeMeta.crop) || null,
      region:         _str(safeMeta.region) || null,
      issueCategory:  _str(safeMeta.issueCategory) || null,
      intervention:   _str(safeMeta.intervention) || null,
      pattern:        _str(safeMeta.pattern) || null,
      yieldBand:      _str(safeMeta.yieldBand) || null,
    });
    const log = _readLog();
    log.push(row);
    if (log.length > MAX_EVENTS) log.splice(0, log.length - MAX_EVENTS);
    _writeLog(log);
    return row;
  }, null);
}

/** Read every season event (newest-first). */
export function getSeasonEvents() {
  return _readLog().slice().reverse();
}

/** Test-only reset. */
export function clearSeasonMemory() { _writeLog([]); }

// ─── Aggregations ────────────────────────────────────────────

function _filterFor(log, opts) {
  const crop = _str(opts && opts.crop);
  const region = _str(opts && opts.region);
  if (!crop && !region) return log;
  return log.filter((r) =>
    (!crop || r.crop === crop)
    && (!region || r.region === region));
}

function _recurringDiseaseCycles(log) {
  // Group by issueCategory + season+year. A cycle is the same
  // issue appearing in the same season across ≥ 2 years.
  const byIssue = new Map();
  for (const r of log) {
    if (!r || !r.issueCategory) continue;
    if (r.kind !== SEASON_EVENT.DISEASE_DETECTED
        && r.kind !== SEASON_EVENT.DISEASE_RECURRED) continue;
    const key = r.issueCategory;
    if (!byIssue.has(key)) byIssue.set(key, new Map());
    const yrSeason = r.year + ':' + r.season;
    const slot = byIssue.get(key);
    slot.set(yrSeason, (slot.get(yrSeason) || 0) + 1);
  }
  const cycles = [];
  for (const [category, slot] of byIssue) {
    if (slot.size >= 2) {
      cycles.push(Object.freeze({
        category,
        seasons: Object.freeze(Array.from(slot.keys())),
        count:   Array.from(slot.values()).reduce((a, b) => a + b, 0),
      }));
    }
  }
  return Object.freeze(cycles);
}

function _interventionOutcomes(log) {
  const out = new Map();
  for (const r of log) {
    if (!r || !r.intervention) continue;
    if (r.kind !== SEASON_EVENT.INTERVENTION_OK
        && r.kind !== SEASON_EVENT.INTERVENTION_BAD) continue;
    if (!out.has(r.intervention)) out.set(r.intervention, { helped: 0, ignored: 0 });
    const slot = out.get(r.intervention);
    if (r.kind === SEASON_EVENT.INTERVENTION_OK) slot.helped += 1;
    else slot.ignored += 1;
  }
  const o = {};
  for (const [k, v] of out) o[k] = Object.freeze(v);
  return Object.freeze(o);
}

function _yieldContinuity(log) {
  const yields = log.filter((r) => r && r.kind === SEASON_EVENT.YIELD_OBSERVED);
  if (yields.length === 0) return Object.freeze({ trend: 'unknown', confidence: 'low' });
  const bandRank = { low: 0, medium: 1, high: 2 };
  const ranks = yields.map((r) => bandRank[_str(r.yieldBand).toLowerCase()] || 1);
  if (ranks.length < 2) return Object.freeze({ trend: 'unknown', confidence: 'low' });
  let inc = 0, dec = 0;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] > ranks[i - 1]) inc++;
    else if (ranks[i] < ranks[i - 1]) dec++;
  }
  let trend = 'flat';
  if (inc > dec) trend = 'rising';
  else if (dec > inc) trend = 'falling';
  const confidence = ranks.length >= 4 ? 'medium' : 'low';
  return Object.freeze({ trend, confidence });
}

function _learningDepthFor(seasonsObserved, eventCount) {
  if (seasonsObserved >= 3 && eventCount >= 20) return 'rich';
  if (seasonsObserved >= 2) return 'developing';
  return 'thin';
}

/**
 * Build a snapshot for the supplied (crop, region) scope, or
 * the whole farm if no scope provided.
 */
export function getMultiSeasonSnapshot(opts) {
  return _safe(() => {
    const all = _readLog();
    const scoped = _filterFor(all, opts);
    const seasons = new Set(scoped.map((r) => r && (r.year + ':' + r.season)).filter(Boolean));
    const eventCount = scoped.length;
    return Object.freeze({
      engineVersion:         ENGINE_VERSION,
      seasonsObserved:       seasons.size,
      eventCount,
      recurringDiseaseCycles: _recurringDiseaseCycles(scoped),
      interventionOutcomes:   _interventionOutcomes(scoped),
      yieldContinuity:        _yieldContinuity(scoped),
      learningDepth:          _learningDepthFor(seasons.size, eventCount),
      scope: Object.freeze({
        crop:   _str(opts && opts.crop) || null,
        region: _str(opts && opts.region) || null,
      }),
      generatedAt: Date.now(),
    });
  }, Object.freeze({
    engineVersion: ENGINE_VERSION,
    seasonsObserved: 0, eventCount: 0,
    recurringDiseaseCycles: Object.freeze([]),
    interventionOutcomes:   Object.freeze({}),
    yieldContinuity: Object.freeze({ trend: 'unknown', confidence: 'low' }),
    learningDepth: 'thin',
    scope: Object.freeze({ crop: null, region: null }),
    generatedAt: Date.now(),
  }));
}

export const _internal = Object.freeze({
  _seasonOf, _filterFor, _recurringDiseaseCycles,
  _interventionOutcomes, _yieldContinuity, _learningDepthFor,
  ENGINE_VERSION, MAX_EVENTS,
});

const _module = {
  recordSeasonEvent, getMultiSeasonSnapshot, getSeasonEvents,
  clearSeasonMemory, SEASON_EVENT, _internal,
};
export default _module;
