/**
 * trendStore.js — daily snapshots of region risk for trend
 * deltas ("+5 farms compared to yesterday").
 *
 *   recordSnapshot(insights)
 *   getSnapshots()
 *   getYesterdayCounts(country, region)
 *     -> { pestHigh, droughtHigh } | null
 *   getTrendDelta(insights, opts?)
 *     -> { region, country, pestDelta, droughtDelta, ... }[]
 *
 * Storage: localStorage `farroway_trend_snapshots`. Capped at
 * MAX_SNAPSHOTS = 90 daily rows per region (~3 months) so the
 * store stays bounded.
 *
 * Strict-rule audit
 *   * works offline (localStorage only)
 *   * never throws (try/catch wrapped)
 *   * lightweight: ~80 bytes per snapshot row
 *   * doesn't expose raw ML - only risk counts
 */

export const STORAGE_KEY    = 'farroway_trend_snapshots';
export const MAX_SNAPSHOTS  = 90 * 200;   // 90 days x ~200 regions cap
export const SCHEMA_VERSION = 1;

const MS_PER_DAY = 86_400_000;

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
  const trimmed = rows.length > MAX_SNAPSHOTS
    ? rows.slice(rows.length - MAX_SNAPSHOTS)
    : rows;
  try { _safeSet(STORAGE_KEY, JSON.stringify(trimmed)); }
  catch { /* swallow */ }
}

function _utcDay(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function _key(country, region, day) {
  return `${day}|${country}|${region}`;
}

/**
 * recordSnapshot(insights)
 *
 * Append today's per-region snapshot. Idempotent inside a UTC
 * day - re-running on the same day overwrites instead of
 * stacking duplicates.
 */
export function recordSnapshot(insights) {
  if (!Array.isArray(insights) || insights.length === 0) return 0;
  const day = _utcDay();
  const rows = _read();

  // Build an index of existing rows for today by (region, country)
  const existingIdx = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    if (!r || r.date !== day) continue;
    existingIdx.set(_key(r.country, r.region, day), i);
  }

  for (const ins of insights) {
    if (!ins || typeof ins !== 'object') continue;
    const record = {
      date:        day,
      country:     ins.country,
      region:      ins.region,
      farms:       Number(ins.farms)        || 0,
      pestHigh:    Number(ins.pestHigh)     || 0,
      droughtHigh: Number(ins.droughtHigh)  || 0,
      v:           SCHEMA_VERSION,
    };
    const k = _key(ins.country, ins.region, day);
    if (existingIdx.has(k)) {
      rows[existingIdx.get(k)] = record;
    } else {
      rows.push(record);
      existingIdx.set(k, rows.length - 1);
    }
  }

  _write(rows);
  return insights.length;
}

export function getSnapshots() { return _read(); }
export function clearSnapshots() { _safeRemove(STORAGE_KEY); }

/**
 * getYesterdayCounts(country, region)
 *   -> { pestHigh, droughtHigh } | null
 *
 * Looks for a snapshot dated exactly one UTC day before today;
 * returns null when none exists. Useful for the "+5 farms vs
 * yesterday" line in the dashboard.
 */
export function getYesterdayCounts(country, region) {
  const yesterday = _utcDay(new Date(Date.now() - MS_PER_DAY));
  const rows = _read();
  for (const r of rows) {
    if (!r || r.date !== yesterday) continue;
    if (r.country !== country)       continue;
    if (r.region  !== region)        continue;
    return { pestHigh: r.pestHigh, droughtHigh: r.droughtHigh };
  }
  return null;
}

/**
 * getTrendDelta(insights, opts?)
 *   -> Array<{ region, country, pestDelta, droughtDelta,
 *              direction, sinceDate }>
 *
 * direction: 'up' | 'down' | 'flat'
 *
 * Compares each insight row to yesterday's snapshot. When no
 * yesterday row exists, the entry is omitted.
 */
export function getTrendDelta(insights, opts = {}) {
  if (!Array.isArray(insights) || insights.length === 0) return [];
  const yesterday = _utcDay(new Date(Date.now() - MS_PER_DAY));

  // Pre-index yesterday for O(1) lookup.
  const yMap = new Map();
  for (const r of _read()) {
    if (!r || r.date !== yesterday) continue;
    yMap.set(_key(r.country, r.region, yesterday), r);
  }

  const out = [];
  for (const ins of insights) {
    if (!ins) continue;
    const k = _key(ins.country, ins.region, yesterday);
    const y = yMap.get(k);
    if (!y) continue;
    const pestDelta    = Number(ins.pestHigh)    - Number(y.pestHigh    || 0);
    const droughtDelta = Number(ins.droughtHigh) - Number(y.droughtHigh || 0);
    const sum = pestDelta + droughtDelta;
    const direction = sum > 0 ? 'up' : sum < 0 ? 'down' : 'flat';
    out.push(Object.freeze({
      region:       ins.region,
      country:      ins.country,
      pestDelta,
      droughtDelta,
      direction,
      sinceDate:    yesterday,
    }));
  }

  return out;
}
