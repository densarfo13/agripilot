/**
 * attributionMetrics.js — by-source breakdown of installs,
 * first_action_rate, and day2_return.
 *
 * Spec coverage (Attribution + funnel §4)
 *   • Dashboard: first_action_rate by source / installs by
 *     source / day2_return by source.
 *
 *   getAttributionBySource() → Array<{
 *     source:           string,
 *     installs:         number,         // count of first_visit
 *     firstActions:     number,         // count of first_action_completed
 *     firstActionRate:  number,         // 0..1
 *     day2Returns:      number,
 *     day2ReturnRate:   number,         // 0..1 of installs
 *     avgTimeToValueMs: number | null,
 *   }>
 *
 * Source
 *   Reads the canonical analyticsStore log at
 *   `farroway_events`. Every funnel event payload now carries
 *   a `source` field auto-attached by funnelEvents (via
 *   attribution.getAttributionContext), so partition is a
 *   client-side reduce.
 *
 * Strict-rule audit
 *   • Pure read; never throws.
 *   • Aggregate is bounded by the local event log (max 300
 *     entries by analyticsStore default).
 */

const EVENTS_KEY = 'farroway_events';

function _safeReadJsonArray(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _bumpMap(map, key, field) {
  const id = String(key || 'direct');
  const slot = map.get(id) || { installs: 0, firstActions: 0, day2Returns: 0, ttvSum: 0, ttvCount: 0 };
  slot[field] += 1;
  map.set(id, slot);
  return slot;
}

export function getAttributionBySource() {
  const events = _safeReadJsonArray(EVENTS_KEY);
  const slots = new Map();

  for (const e of events) {
    if (!e || !e.eventName) continue;
    const payload = e.payload || {};
    const source = String(payload.source || 'direct');

    if (e.eventName === 'first_visit') {
      _bumpMap(slots, source, 'installs');
    } else if (e.eventName === 'first_action_completed') {
      const slot = _bumpMap(slots, source, 'firstActions');
      const ttv = Number(payload.timeToValueMs);
      if (Number.isFinite(ttv) && ttv >= 0) {
        slot.ttvSum   += ttv;
        slot.ttvCount += 1;
      }
    } else if (e.eventName === 'day2_return') {
      _bumpMap(slots, source, 'day2Returns');
    }
  }

  const rows = [];
  for (const [source, s] of slots) {
    rows.push({
      source,
      installs:         s.installs,
      firstActions:     s.firstActions,
      firstActionRate:  s.installs > 0 ? s.firstActions / s.installs : 0,
      day2Returns:      s.day2Returns,
      day2ReturnRate:   s.installs > 0 ? s.day2Returns / s.installs : 0,
      avgTimeToValueMs: s.ttvCount > 0
        ? Math.round(s.ttvSum / s.ttvCount)
        : null,
    });
  }
  // Sort by installs desc — most-active channels at the top.
  rows.sort((a, b) => b.installs - a.installs);
  return rows;
}

export default { getAttributionBySource };
