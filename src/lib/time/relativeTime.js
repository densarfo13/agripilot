/**
 * relativeTime.js — tiny, pure helper that turns a timestamp into
 * an i18n-friendly "X ago" payload.
 *
 *   formatRelativeTime(1_713_600_000_000, Date.now())
 *   → { key: 'time.minutes_ago', vars: { n: 5 } }
 *
 * The caller (UI) runs t(payload.key, payload.vars) — the helper
 * itself returns only stable keys, so no English leaks. A tiny
 * fallback string (`fallback`) is included for callers without i18n.
 *
 * Buckets (spec §7 — trust signal):
 *   < 60 s       → time.just_now
 *   < 60 min     → time.minutes_ago  { n }
 *   < 24 h       → time.hours_ago    { n }
 *   ≥ 24 h       → time.days_ago     { n }
 *   0 / invalid  → time.no_activity
 */

const MIN_MS  = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS  = 24 * HOUR_MS;

function toMs(x) {
  if (x == null) return 0;
  if (x instanceof Date) return x.getTime();
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function formatRelativeTime(ts, now) {
  const t = toMs(ts);
  const n = toMs(now) || Date.now();
  if (!t) return { key: 'time.no_activity', vars: null, fallback: 'No activity yet' };
  const diff = Math.max(0, n - t);

  if (diff < MIN_MS) {
    return { key: 'time.just_now', vars: null, fallback: 'Just now' };
  }
  if (diff < HOUR_MS) {
    const mins = Math.max(1, Math.floor(diff / MIN_MS));
    return { key: 'time.minutes_ago', vars: { n: mins }, fallback: `${mins} min ago` };
  }
  if (diff < DAY_MS) {
    const hours = Math.max(1, Math.floor(diff / HOUR_MS));
    return { key: 'time.hours_ago', vars: { n: hours }, fallback: `${hours} h ago` };
  }
  const days = Math.max(1, Math.floor(diff / DAY_MS));
  return { key: 'time.days_ago', vars: { n: days }, fallback: `${days} d ago` };
}

export default formatRelativeTime;
