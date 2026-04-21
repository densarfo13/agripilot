/**
 * reportFilters.js — shared filter + aggregation helpers for the
 * NGO reporting layer. Pure — no IO, no UI.
 *
 *   filterFarms(farms, { crop?, region?, status?, from?, to?, events? })
 *     → Farm[]                       // post-filter list
 *
 *   aggregateReport({ farms, events, completions, now })
 *     → {
 *         totals:        { total, active, inactive },
 *         crops:         [{ crop, count }],
 *         regions:       [{ region, count }],
 *         stages:        [{ stage, count }],
 *         recentSignups: number,          // last 30 days
 *         tasksCompleted: number,
 *       }
 *
 * Same active-farmer + event-walk rules the rest of the NGO layer
 * already uses (src/lib/ngo/analytics.js) so the dashboard, export
 * CSV, and printable report stay consistent.
 */

const DAY_MS = 24 * 3600 * 1000;

function toMs(x) {
  if (x == null) return null;
  if (x instanceof Date) return x.getTime();
  const n = Number(x);
  if (Number.isFinite(n)) return n;
  const parsed = Date.parse(String(x));
  return Number.isFinite(parsed) ? parsed : null;
}

function lastActivityFor(farmId, events) {
  if (!farmId || !Array.isArray(events)) return 0;
  const id = String(farmId);
  let max = 0;
  for (const e of events) {
    if (!e || e.farmId !== id) continue;
    if ((e.timestamp || 0) > max) max = e.timestamp || 0;
  }
  return max;
}

/**
 * filterFarms — applies the NGO report filters in a predictable
 * order. Missing / null filter values are treated as "don't filter".
 *
 *   crop:   case-insensitive exact match on farm.crop / farm.cropType
 *   region: case-insensitive exact match on farm.state / farm.stateCode
 *   status: 'active' | 'inactive' (requires `events` + `now`)
 *   from/to: ms or ISO — clamps on `farm.createdAt`
 */
export function filterFarms(farms, {
  crop, region, status, from, to,
  events = [],
  now,
  activityWindowDays = 7,
} = {}) {
  if (!Array.isArray(farms)) return [];
  const cropKey   = crop   ? String(crop).toLowerCase() : null;
  const regionKey = region ? String(region).toLowerCase() : null;
  const fromTs    = toMs(from);
  const toTs      = toMs(to);
  const nowTs     = toMs(now) || Date.now();
  const cutoff    = nowTs - Math.max(0, activityWindowDays) * DAY_MS;

  return farms.filter((f) => {
    if (!f) return false;

    if (cropKey) {
      const c = String(f.crop || f.cropType || '').toLowerCase();
      if (c !== cropKey) return false;
    }
    if (regionKey) {
      const r = String(f.state || f.stateCode || '').toLowerCase();
      if (r !== regionKey) return false;
    }

    if (status === 'active' || status === 'inactive') {
      const last = lastActivityFor(f.id, events);
      const isActive = last >= cutoff;
      if (status === 'active'   && !isActive) return false;
      if (status === 'inactive' &&  isActive) return false;
    }

    if (fromTs != null) {
      const created = toMs(f.createdAt);
      if (created != null && created < fromTs) return false;
    }
    if (toTs != null) {
      const created = toMs(f.createdAt);
      if (created != null && created > toTs) return false;
    }
    return true;
  });
}

/**
 * aggregateReport — rolls the filtered farms + events into the
 * shape the printable report + export need.
 */
export function aggregateReport({
  farms = [],
  events = [],
  completions = [],
  now = null,
  activityWindowDays = 7,
  recentSignupDays   = 30,
} = {}) {
  const nowTs = toMs(now) || Date.now();
  const cutoffActive = nowTs - Math.max(0, activityWindowDays) * DAY_MS;
  const cutoffRecent = nowTs - Math.max(0, recentSignupDays) * DAY_MS;

  const byCrop   = new Map();
  const byRegion = new Map();
  const byStage  = new Map();
  let   active   = 0;
  let   recentSignups = 0;

  for (const f of farms || []) {
    if (!f) continue;

    const crop = String(f.crop || f.cropType || '').toLowerCase() || 'unknown';
    byCrop.set(crop, (byCrop.get(crop) || 0) + 1);

    const region = String(f.state || f.stateCode || f.country || '').toUpperCase() || 'UNKNOWN';
    byRegion.set(region, (byRegion.get(region) || 0) + 1);

    const stage = String(f.stage || f.cropStage || '').toLowerCase() || 'unknown';
    byStage.set(stage, (byStage.get(stage) || 0) + 1);

    const last = lastActivityFor(f.id, events);
    if (last >= cutoffActive) active += 1;

    const created = toMs(f.createdAt);
    if (created != null && created >= cutoffRecent) recentSignups += 1;
  }

  const total = Array.isArray(farms) ? farms.length : 0;
  const inactive = Math.max(0, total - active);

  let tasksCompleted = 0;
  for (const e of events || []) {
    if (e && e.type === 'task_completed') tasksCompleted += 1;
  }
  if (tasksCompleted === 0 && Array.isArray(completions)) {
    // Fall back to the legacy completions store.
    for (const c of completions) if (c && c.completed !== false) tasksCompleted += 1;
  }

  return Object.freeze({
    totals:         Object.freeze({ total, active, inactive }),
    crops:          Object.freeze(fromMap(byCrop,   'crop')),
    regions:        Object.freeze(fromMap(byRegion, 'region')),
    stages:         Object.freeze(fromMap(byStage,  'stage')),
    recentSignups,
    tasksCompleted,
    generatedAt:    nowTs,
  });
}

function fromMap(m, key) {
  const out = [];
  for (const [k, v] of m.entries()) out.push({ [key]: k, count: v });
  out.sort((a, b) => b.count - a.count);
  return out;
}

export const _internal = Object.freeze({ DAY_MS, lastActivityFor, fromMap });
