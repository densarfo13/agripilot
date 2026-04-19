/**
 * relativeTime — map a past timestamp to a translation key + params.
 *
 * Spec §8: the Tasks screen shows a trust signal ("Updated 2 hours
 * ago", "Last saved yesterday") so the farmer knows how stale the
 * cached view is. We return a key + params so the i18n layer can
 * format properly per language rather than concatenating strings
 * here.
 *
 *   < 60s          → { key: 'time.updated_just_now' }
 *   < 60m          → { key: 'time.updated_minutes_ago', params: { n } }
 *   < 24h          → { key: 'time.updated_hours_ago',   params: { n } }
 *   yesterday      → { key: 'time.last_saved_yesterday' }
 *   else           → { key: 'time.updated_days_ago',    params: { n } }
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeUpdate(ts, now = Date.now()) {
  if (!Number.isFinite(ts) || ts <= 0) {
    return { key: 'time.updated_unknown' };
  }
  const delta = Math.max(0, now - ts);

  if (delta < MINUTE) {
    return { key: 'time.updated_just_now' };
  }
  if (delta < HOUR) {
    const n = Math.max(1, Math.floor(delta / MINUTE));
    return { key: 'time.updated_minutes_ago', params: { n } };
  }
  if (delta < DAY) {
    const n = Math.max(1, Math.floor(delta / HOUR));
    return { key: 'time.updated_hours_ago', params: { n } };
  }
  if (delta < 2 * DAY) {
    return { key: 'time.last_saved_yesterday' };
  }
  const n = Math.floor(delta / DAY);
  return { key: 'time.updated_days_ago', params: { n } };
}
