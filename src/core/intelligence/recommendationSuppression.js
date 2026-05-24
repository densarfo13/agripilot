/**
 * recommendationSuppression.js — quietly removes duplicate,
 * stale, conflicting, or repeatedly-ignored recommendations
 * (spec §4).
 *
 *   import { suppressRecommendations }
 *     from 'src/core/intelligence/recommendationSuppression.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure filter over a candidate list. It does NOT generate any
 *   recommendation; the upstream engines do. It removes ones that
 *   contradict each other (water + skip-rain), repeat what the
 *   user already did (water today after a watering already
 *   completed), or have been ignored too many times.
 *
 *   Every suppression is REASONED — the caller can read which
 *   candidates were dropped and why.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const DAY_MS = 24 * 60 * 60 * 1000;

const REASON = Object.freeze({
  DUPLICATE:          'duplicate',
  CONFLICTS_RAIN:     'conflicts_with_rain_skip',
  ALREADY_DONE:       'already_completed_recently',
  REPEATEDLY_IGNORED: 'repeatedly_ignored',
  STALE:              'stale',
});

function _key(rec) {
  const t = _str(rec && rec.type);
  const id = rec && rec.id != null ? String(rec.id) : _str(rec && (rec.title || rec.label || ''));
  return `${t}::${id}`;
}

function _hoursAgo(iso, nowMs) {
  const t = (typeof iso === 'number') ? iso : Date.parse(String(iso || ''));
  if (!Number.isFinite(t)) return Infinity;
  return Math.max(0, ((nowMs || Date.now()) - t) / 3600000);
}

/**
 * Filter a candidate list. Returns the cleaned list AND a
 * structured suppression report.
 *
 * @param {Array<object>} candidates
 * @param {object} [opts]
 * @param {object} [opts.signals]     { rainSkip:boolean, lastWateredAt, … }
 * @param {object} [opts.ignoreLog]   { [`${type}::${id}`]: numTimesIgnored }
 * @param {number} [opts.maxIgnores]  default 3
 * @param {number} [opts.maxAgeMs]    default 24h
 * @param {number} [opts.nowMs]
 * @returns {{ kept:Array, suppressed:Array }}
 */
export function suppressRecommendations(candidates, opts) {
  try {
    const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    const o = (opts && typeof opts === 'object') ? opts : {};
    const signals = (o.signals && typeof o.signals === 'object') ? o.signals : {};
    const ignoreLog = (o.ignoreLog && typeof o.ignoreLog === 'object') ? o.ignoreLog : {};
    const maxIgnores = Number.isFinite(o.maxIgnores) ? o.maxIgnores : 3;
    const maxAge = Number.isFinite(o.maxAgeMs) ? o.maxAgeMs : DAY_MS;
    const nowMs = Number.isFinite(o.nowMs) ? o.nowMs : Date.now();

    const seen = new Set();
    const kept = [];
    const suppressed = [];

    for (const rec of list) {
      if (!rec || typeof rec !== 'object') continue;
      const key = _key(rec);
      const type = _str(rec.type);

      // 1. Duplicate by (type, id/title).
      if (seen.has(key)) {
        suppressed.push({ rec, reason: REASON.DUPLICATE });
        continue;
      }

      // 2. Conflict — never recommend WATERING when the rules
      //    independently say "skip because rain".
      if (type === 'watering' && signals.rainSkip === true) {
        suppressed.push({ rec, reason: REASON.CONFLICTS_RAIN });
        continue;
      }

      // 3. Already-done — water already happened in the last 6h.
      if (type === 'watering' && signals.lastWateredAt != null
          && _hoursAgo(signals.lastWateredAt, nowMs) < 6) {
        suppressed.push({ rec, reason: REASON.ALREADY_DONE });
        continue;
      }

      // 4. Repeatedly ignored.
      const ignores = Number(ignoreLog[key]);
      if (Number.isFinite(ignores) && ignores >= maxIgnores) {
        suppressed.push({ rec, reason: REASON.REPEATEDLY_IGNORED });
        continue;
      }

      // 5. Stale by createdAt.
      const created = (typeof rec.createdAt === 'number')
        ? rec.createdAt
        : Date.parse(String(rec.createdAt || ''));
      if (Number.isFinite(created) && (nowMs - created) > maxAge) {
        suppressed.push({ rec, reason: REASON.STALE });
        continue;
      }

      seen.add(key);
      kept.push(rec);
    }

    return { kept, suppressed };
  } catch {
    return { kept: Array.isArray(candidates) ? candidates.slice() : [], suppressed: [] };
  }
}

export const SUPPRESSION_REASON = REASON;

const _module = { suppressRecommendations, SUPPRESSION_REASON };
export default _module;
